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

  function listUsers() {
    return users.list().map(publicUser);
  }

  return { register, login, resolveSession, logout, cleanup, listUsers, publicUser };
}
