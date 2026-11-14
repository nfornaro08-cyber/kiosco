import { randomBytes } from 'node:crypto';
import { readJsonBody, sendJson, parseCookies, serializeCookie } from '../../lib/http.js';
import { optionalSession, requireUser } from '../guards.js';
import {
  buildAuthorizeUrl,
  exchangeCode,
  googleConfigured,
  verifyIdToken,
} from '../../lib/google.js';

const OAUTH_STATE_COOKIE = 'kiosco_oauth_state';
const OAUTH_STATE_MAX_AGE = 600;

/** Origen publico de la app: usa los headers del proxy (Railway) o el Host local. */
function publicOrigin(req) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = typeof forwardedHost === 'string' && forwardedHost ? forwardedHost.split(',')[0].trim() : req.headers.host;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwardedProto === 'string' && forwardedProto ? forwardedProto.split(',')[0].trim() : 'http';
  return `${proto}://${host}`;
}

/** Redireccion 302 simple (Google vuelve por URL, no por JSON). */
function redirect(res, location, extraHeaders = {}) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...extraHeaders });
  res.end();
}

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

  // Le dice al frontend si el login con Google esta disponible.
  routes.push({
    method: 'GET',
    path: '/api/auth/google/status',
    handler: async (req, res) => {
      sendJson(res, 200, {
        configured: googleConfigured(config),
        allowedDomain: config.auth.google.allowedDomains[0] ?? null,
      });
    },
  });

  // Paso 1: manda al usuario a elegir su cuenta en Google.
  routes.push({
    method: 'GET',
    path: '/api/auth/google/start',
    handler: async (req, res) => {
      if (!googleConfigured(config)) {
        redirect(res, `${publicOrigin(req)}/?google=error#/catalogo`);
        return;
      }
      const state = randomBytes(16).toString('hex');
      const redirectUri = `${publicOrigin(req)}/api/auth/google/callback`;
      const authorizeUrl = buildAuthorizeUrl({ config, redirectUri, state });
      redirect(res, authorizeUrl, {
        'Set-Cookie': serializeCookie(OAUTH_STATE_COOKIE, state, {
          maxAge: OAUTH_STATE_MAX_AGE,
          httpOnly: true,
          sameSite: 'Lax',
          secure: config.isProduction,
        }),
      });
    },
  });

  // Paso 2: Google vuelve con el codigo; se valida, se crea la sesion y se manda al catalogo.
  routes.push({
    method: 'GET',
    path: '/api/auth/google/callback',
    handler: async (req, res) => {
      const origin = publicOrigin(req);
      const params = req.url ? new URL(req.url, origin).searchParams : new URLSearchParams();
      const clearState = {
        'Set-Cookie': serializeCookie(OAUTH_STATE_COOKIE, '', {
          maxAge: 0,
          httpOnly: true,
          sameSite: 'Lax',
          secure: config.isProduction,
        }),
      };

      if (params.get('error')) {
        redirect(res, `${origin}/?google=denegado#/catalogo`, clearState);
        return;
      }

      const cookies = parseCookies(req.headers.cookie ?? '');
      const state = params.get('state') ?? '';
      if (!state || state !== cookies[OAUTH_STATE_COOKIE]) {
        redirect(res, `${origin}/?google=error#/catalogo`, clearState);
        return;
      }

      try {
        const tokens = await exchangeCode({ code: params.get('code') ?? '', redirectUri: `${origin}/api/auth/google/callback`, config });
        const profile = await verifyIdToken({ idToken: tokens.id_token, config });
        const result = auth.loginWithGoogle(profile);
        const maxAge = Math.max(0, Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000));
        redirect(res, `${origin}/#/catalogo`, {
          // Dos cookies: se borra el state de OAuth y se crea la sesion.
          'Set-Cookie': [
            serializeCookie(OAUTH_STATE_COOKIE, '', {
              maxAge: 0,
              httpOnly: true,
              sameSite: 'Lax',
              secure: config.isProduction,
            }),
            serializeCookie(config.cookieName, result.token, {
              maxAge,
              httpOnly: true,
              sameSite: 'Lax',
              secure: config.isProduction,
            }),
          ],
        });
      } catch (error) {
        const isDomain = String(error?.code ?? error?.message ?? '').includes('DOMAIN');
        const domain = config.auth.google.allowedDomains[0] ?? '';
        redirect(res, `${origin}/?google=${isDomain ? 'dominio' : 'error'}&dominio=${encodeURIComponent(domain)}#/catalogo`, clearState);
      }
    },
  });
}
