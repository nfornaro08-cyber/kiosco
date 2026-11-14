import { readJsonBody, sendJson, serializeCookie } from '../../lib/http.js';
import { optionalSession, requireUser } from '../guards.js';

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

  routes.push({
    method: 'GET',
    path: '/api/auth/google',
    handler: async (req, res) => {
      if (!auth.googleConfigured()) {
        sendJson(res, 503, { error: { code: 'GOOGLE_NOT_CONFIGURED', message: 'Google login no está configurado.' } });
        return;
      }
      const proto = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost:3000';
      const redirectUri = `${proto}://${host}/api/auth/google/callback`;
      const state = Math.random().toString(36).slice(2);
      const url = auth.getGoogleAuthorizeUrl(redirectUri, state);
      res.writeHead(302, { Location: url });
      res.end();
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/auth/google/callback',
    handler: async (req, res, { url }) => {
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (error || !code) {
        res.writeHead(302, { Location: '/#/auth?error=google' });
        res.end();
        return;
      }
      const proto = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost:3000';
      const redirectUri = `${proto}://${host}/api/auth/google/callback`;
      try {
        const result = await auth.handleGoogleCallback(code, redirectUri);
        sessionCookie(res, result.token, result.expiresAt);
        res.writeHead(302, { Location: '/' });
        res.end();
      } catch (err) {
        res.writeHead(302, { Location: '/#/auth?error=google' });
        res.end();
      }
    },
  });

  routes.push({
    method: 'PUT',
    path: '/api/auth/password',
    handler: async (req, res) => {
      const session = requireUser(ctx, req);
      const body = await readJsonBody(req);
      auth.changePassword(session.user.id, {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });
      sendJson(res, 200, { ok: true });
    },
  });
}
