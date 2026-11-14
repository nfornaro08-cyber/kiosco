import { AppError } from './errors.js';

const MAX_BODY_BYTES = 1_000_000;

export function sendJson(res, status, payload, extraHeaders = {}) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    const value = part.slice(index + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

export function serializeCookie(name, value, options = {}) {
  const { maxAge, httpOnly = true, sameSite = 'Lax', path = '/', secure = false } = options;
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let drained = 0;
    let rejected = false;
    const chunks = [];

    req.on('data', (chunk) => {
      // Si ya rechazamos por tamaño, seguimos drenando (descartando) para
      // poder responder 413 sin cortar el socket de golpe.
      if (rejected) {
        drained += chunk.length;
        if (drained > 10_000_000) req.destroy();
        return;
      }
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        chunks.length = 0;
        reject(new AppError(413, 'PAYLOAD_TOO_LARGE', 'El contenido enviado es demasiado grande.'));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (rejected) return;
      if (size === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(AppError.badRequest('INVALID_BODY', 'El cuerpo de la solicitud debe ser un objeto JSON.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(AppError.badRequest('INVALID_JSON', 'El cuerpo de la solicitud no es JSON válido.'));
      }
    });

    req.on('error', reject);
  });
}

export function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  };
}
