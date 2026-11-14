import { randomBytes } from 'node:crypto';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { buildAuthorizeUrl, exchangeCode, verifyIdToken } from '../lib/google.js';
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

  function register({ name, email, password }) {
    const cleanName = text(name, 'name', { min: 2, max: 60 });
    const cleanEmail = parseEmail(email);
    const cleanPassword = parsePassword(password);

    const allowedDomains = config.auth?.google?.allowedDomains ?? [];
    if (allowedDomains.length > 0) {
      const domain = cleanEmail.split('@')[1]?.toLowerCase() ?? '';
      if (!allowedDomains.includes(domain)) {
        throw AppError.forbidden(
          'DOMAIN_NOT_ALLOWED',
          `Solo pueden registrarse cuentas ${allowedDomains.map((d) => `@${d}`).join(', ')}.`,
        );
      }
    }

    if (users.findByEmail(cleanEmail)) {
      throw AppError.conflict('EMAIL_IN_USE', 'Ya existe una cuenta registrada con ese correo.');
    }

    const user = users.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash: hashPassword(cleanPassword),
      role: 'cliente',
    });

    const session = createSession(user.id);
    return { user: publicUser(user), ...session };
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

  function resetAdminPassword(newPassword) {
    const clean = parsePassword(newPassword);
    const admin = users.list().find((u) => u.role === 'admin');
    if (!admin) throw AppError.notFound('ADMIN_NOT_FOUND', 'No hay cuenta de administración.');
    users.updatePassword(admin.id, hashPassword(clean));
    return publicUser(admin);
  }

  function googleLogin(profile) {
    let user = users.findByGoogleSub(profile.sub);
    if (!user) {
      user = users.findByEmail(profile.email);
      if (user) {
        users.updateGoogleSub(user.id, profile.sub);
        user = users.findById(user.id);
      } else {
        user = users.create({
          name: profile.name,
          email: profile.email,
          passwordHash: '',
          role: 'cliente',
          googleSub: profile.sub,
        });
      }
    }

    if (!user.active) {
      throw AppError.forbidden('USER_INACTIVE', 'La cuenta está desactivada.');
    }

    const session = createSession(user.id);
    return { user: publicUser(user), ...session };
  }

  function getGoogleAuthorizeUrl(redirectUri, state) {
    return buildAuthorizeUrl({ config, redirectUri, state });
  }

  async function handleGoogleCallback(code, redirectUri) {
    const tokenData = await exchangeCode({ code, redirectUri, config });
    const profile = await verifyIdToken({ idToken: tokenData.id_token, config });
    return googleLogin(profile);
  }

  function deleteAccount(id, { actorId } = {}) {
    const target = users.findById(Number(id));
    if (!target) throw AppError.notFound('USER_NOT_FOUND', 'El usuario no existe.');
    if (Number(id) === Number(actorId)) {
      throw AppError.badRequest('DELETE_SELF', 'No podés borrar tu propia cuenta mientras estás logueado.');
    }

    db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)').run(target.id);
    db.prepare('DELETE FROM orders WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(target.id);

    return { deleted: true, email: target.email };
  }

  function listUsers() {
    return users.list().map(publicUser);
  }

  return { register, login, resolveSession, logout, cleanup, listUsers, publicUser, changePassword, resetAdminPassword, deleteAccount, googleConfigured: () => (config.auth?.google?.clientId && config.auth?.google?.clientSecret) ? true : false, getGoogleAuthorizeUrl, handleGoogleCallback };
}
