import { AppError } from '../lib/errors.js';
import { parseCookies } from '../lib/http.js';

export function getSessionToken(ctx, req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[ctx.config.cookieName] ?? null;
}

export function optionalSession(ctx, req) {
  const token = getSessionToken(ctx, req);
  return { user: ctx.auth.resolveSession(token), token };
}

export function requireUser(ctx, req) {
  const session = optionalSession(ctx, req);
  if (!session.user) {
    throw AppError.unauthorized('AUTH_REQUIRED', 'Iniciá sesión para continuar.');
  }
  return session;
}

export function requireAdmin(ctx, req) {
  const session = requireUser(ctx, req);
  if (session.user.role !== 'admin') {
    throw AppError.forbidden('ADMIN_REQUIRED', 'Necesitas una cuenta de administrador para hacer esto.');
  }
  return session;
}
