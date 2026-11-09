import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** Sirve el frontend estatico (public/) sin exponer archivos fuera de esa carpeta. */
export function createStaticHandler(publicDir) {
  const root = resolve(publicDir);

  return async function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return false;
    }

    if (pathname === '/' || pathname === '') pathname = '/index.html';
    if (pathname.includes('\0')) return false;

    let filePath = resolve(join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + sep)) return false;

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      // Rutas del frontend (sin extension) vuelven al index.
      if (extname(pathname)) return false;
      filePath = join(root, 'index.html');
      if (!existsSync(filePath)) return false;
    }

    const extension = extname(filePath).toLowerCase();
    const stats = statSync(filePath);
    const headers = {
      'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
      'Content-Length': stats.size,
      'Last-Modified': stats.mtime.toUTCString(),
      'Cache-Control': ['.html', '.css', '.js', '.mjs'].includes(extension)
        ? 'no-cache'
        : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    };

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return true;
    }
    createReadStream(filePath).pipe(res);
    return true;
  };
}
