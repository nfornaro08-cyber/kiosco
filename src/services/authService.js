import { randomBytes } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { hashToken } from '../lib/tokens.js';
import { addDays } from '../lib/dates.js';
import { email as parseEmail, password as parsePassword, text } from '../lib/validation.js';
import { createUserRepository } from '../repositories/userRepository.js';
import { createSessionRepository } from '../repositories/sessionRepository.js';

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    authProvider: user.authProvider ?? 'local',
    createdAt: user.createdAt,
  };
}

export function createAuthService({ db, config }) {
  const users = createUserRepository(db);
  const sessions = createSessionRepository(db);
  const attempts = new Map();

  function checkRateLimit(key) {
    const record = attempts.get(key);
    if (!record) return;
    if (record.blockedUntil && record.blockedUntil > Date.now()) {
      throw AppError.tooManyRequests(
        'TOO_MANY_ATTEMPTS',
        'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.',
      );
    }
  }

  function recordFailure(key) {
    const now = Date.now();
    const record = attempts.get(key) ?? { count: 0, firstAt: now, blockedUntil: 0 };
    if (now - record.firstAt > WINDOW_MS) {
      record.count = 0;
      record.firstAt = now;
    }
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.blockedUntil = now + WINDOW_MS;
      record.count = 0;
      record.firstAt = now;
    }
    attempts.set(key, record);
  }

  function createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = addDays(new Date(), config.sessionDays).toISOString();
    sessions.create({ tokenHash: hashToken(token), userId, expiresAt });
    return { token, expiresAt };
  }

  /**
   * Crea una cuenta con contrasena. Solo se usa desde el panel de administracion:
   * acepta cualquier correo y el rol lo define quien crea la cuenta.
   * No inicia sesion con la cuenta nueva.
   */
  function createAccount({ name, email, password, role = 'cliente' }) {
    const cleanName = text(name, 'name', { min: 2, max: 60 });
    const cleanEmail = parseEmail(email);
    const cleanPassword = parsePassword(password);
    const cleanRole = role === 'admin' ? 'admin' : 'cliente';

    if (users.findByEmail(cleanEmail)) {
      throw AppError.conflict('EMAIL_IN_USE', 'Ya existe una cuenta registrada con ese correo.');
    }

    const user = users.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash: hashPassword(cleanPassword),
      role: cleanRole,
    });

    return publicUser(user);
  }

  /**
   * Borra una cuenta y todo lo que le pertenece (pedidos, items, sesiones).
   * No permite borrar la propia cuenta del admin logueado.
   */
  function deleteAccount(id, { actorId } = {}) {
    const target = users.findById(Number(id));
    if (!target) {
      throw AppError.notFound('USER_NOT_FOUND', 'El usuario no existe.');
    }
    if (Number(id) === Number(actorId)) {
      throw AppError.badRequest('DELETE_SELF', 'No podés borrar tu propia cuenta mientras estás logueado.');
    }

    const items = db
      .prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)')
      .run(target.id);
    const orders = db.prepare('DELETE FROM orders WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(target.id);

    return { deleted: true, email: target.email, ordersDeleted: orders.changes, itemsDeleted: items.changes };
  }

  function login({ email, password }, ip = 'desconocida') {
    const cleanEmail = parseEmail(email);
    const key = `${ip}|${cleanEmail}`;
    checkRateLimit(key);

    if (typeof password !== 'string' || password.length === 0) {
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
    }

    const user = users.findByEmail(cleanEmail);
    const valid = Boolean(user) && user.active && verifyPassword(password, user.passwordHash);

    if (!valid) {
      recordFailure(key);
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
    }

    attempts.delete(key);
    const session = createSession(user.id);
    return { user: publicUser(user), ...session };
  }

  /**
   * Login federado con Google. El perfil ya viene validado (id_token verificado).
   * Solo acepta correos de los dominios permitidos y vincula o crea la cuenta.
   */
  function loginWithGoogle(profile) {
    const { email, name, sub } = profile;

    const domains = config.auth.google.allowedDomains;
    const domain = String(email).split('@')[1]?.toLowerCase() ?? '';
    if (domains.length > 0 && !domains.includes(domain)) {
      const allowed = domains.map((d) => `@${d}`).join(', ');
      throw AppError.forbidden(
        'GOOGLE_DOMAIN_NOT_ALLOWED',
        `Solo pueden ingresar cuentas ${allowed}. Tu cuenta es @${domain}.`,
      );
    }

    let user = users.findByGoogleSub(sub) ?? users.findByEmail(email);

    if (user && !user.active) {
      throw AppError.forbidden('USER_INACTIVE', 'La cuenta está desactivada.');
    }

    if (!user) {
      // Password inutilizable: la cuenta solo se ingresa via Google.
      const unusable = hashPassword(randomBytes(24).toString('hex'));
      user = users.create({
        name: text(name, 'name', { required: false, max: 60 }) ?? email.split('@')[0],
        email,
        passwordHash: unusable,
        role: 'cliente',
        authProvider: 'google',
        googleSub: sub,
      });
    } else if (!user.googleSub || user.googleSub !== sub) {
      user = users.linkGoogleAccount(user.id, sub);
    }

    const session = createSession(user.id);
    return { user: publicUser(user), ...session };
  }

  function resolveSession(token) {
    if (!token) return null;
    const user = sessions.findUserByTokenHash(hashToken(token));
    return publicUser(user);
  }

  function logout(token) {
    if (!token) return;
    sessions.deleteByTokenHash(hashToken(token));
  }

  function cleanup() {
    sessions.deleteExpired();
  }

  function changePassword(userId, { currentPassword, newPassword }) {
    const id = Number(userId);
    const user = users.findById(id);
    if (!user) throw AppError.notFound('USER_NOT_FOUND', 'El usuario no existe.');
    if (!user.active) throw AppError.forbidden('USER_INACTIVE', 'La cuenta está desactivada.');

    if (user.authProvider === 'google' && !currentPassword) {
      throw AppError.badRequest('GOOGLE_ACCOUNT', 'Tu cuenta ingresa con Google. Usá ese botón para entrar.');
    }
    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      throw AppError.badRequest('INVALID_PASSWORD', 'Ingresá tu contraseña actual.');
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw AppError.unauthorized('INVALID_CREDENTIALS', 'La contraseña actual es incorrecta.');
    }

    const cleanNew = parsePassword(newPassword);
    if (cleanNew === currentPassword) {
      throw AppError.badRequest('SAME_PASSWORD', 'La nueva contraseña debe ser diferente a la actual.');
    }

    users.updatePassword(id, hashPassword(cleanNew));
    return { ok: true };
  }

  function listUsers() {
    return users.list().map(publicUser);
  }

  return { login, loginWithGoogle, createAccount, deleteAccount, resolveSession, logout, cleanup, listUsers, changePassword };
}
