import { readJsonBody, sendJson, serializeCookie } from '../../lib/http.js';
import { optionalSession } from '../guards.js';

export function registerAuthRoutes(routes, ctx) {
  const { auth, config } = ctx;

  function sessionCookie(res, token, expiresAt) {
    const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    res.setHeader(
      'Set-Cookie',
      serializeCookie(config.cookieName, token, {
        maxAge,
        httpOnly: true,
        sameSite: 'Lax',
        secure: config.isProduction,
      }),
    );
  }

  function clearCookie(res) {
    res.setHeader(
      'Set-Cookie',
      serializeCookie(config.cookieName, '', {
        maxAge: 0,
        httpOnly: true,
        sameSite: 'Lax',
        secure: config.isProduction,
      }),
    );
  }

  routes.push({
    method: 'POST',
    path: '/api/auth/register',
    handler: async (req, res) => {
      const body = await readJsonBody(req);
      const result = auth.register(body);
      sessionCookie(res, result.token, result.expiresAt);
      sendJson(res, 201, { user: result.user });
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/auth/login',
    handler: async (req, res) => {
      const body = await readJsonBody(req);
      const result = auth.login(body, req.socket?.remoteAddress || 'desconocida');
      sessionCookie(res, result.token, result.expiresAt);
      sendJson(res, 200, { user: result.user });
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/auth/logout',
    handler: async (req, res) => {
      const { token } = optionalSession(ctx, req);
      auth.logout(token);
      clearCookie(res);
      sendJson(res, 200, { ok: true });
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/auth/me',
    handler: async (req, res) => {
      const { user } = optionalSession(ctx, req);
      sendJson(res, 200, { user });
    },
  });
}
