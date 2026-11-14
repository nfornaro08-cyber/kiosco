const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const SCOPE = 'openid email profile';

export function googleConfigured(config) {
  return Boolean(config.auth?.google?.clientId && config.auth?.google?.clientSecret);
}

/** URL para redirigir al usuario a la pantalla de eleccion de cuenta de Google. */
export function buildAuthorizeUrl({ config, redirectUri, state }) {
  if (!googleConfigured(config)) {
    throw new Error('GOOGLE_NOT_CONFIGURED');
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.auth.google.clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    state,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

/** Intercambia el codigo de autorizacion por un id_token (y access token). */
export async function exchangeCode({ code, redirectUri, config }) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.auth.google.clientId,
      client_secret: config.auth.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GOOGLE_TOKEN_ERROR: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Valida el id_token contra Google (tokeninfo) y devuelve los claims.
 * Rechaza tokens de otra app, expirados o sin email verificado.
 */
export async function verifyIdToken({ idToken, config }) {
  const response = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    throw new Error(`GOOGLE_IDTOKEN_INVALID: ${response.status}`);
  }

  const claims = await response.json();
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (claims.aud !== config.auth.google.clientId) {
    throw new Error('GOOGLE_AUD_MISMATCH');
  }
  if (Number(claims.exp) < nowSeconds) {
    throw new Error('GOOGLE_TOKEN_EXPIRED');
  }
  const verified = claims.email_verified === true || String(claims.email_verified) === 'true';
  if (!claims.email || !verified) {
    throw new Error('GOOGLE_EMAIL_NOT_VERIFIED');
  }

  return {
    sub: String(claims.sub),
    email: String(claims.email).toLowerCase(),
    name: String(claims.name || claims.email.split('@')[0] || 'Usuario'),
  };
}