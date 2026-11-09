import { config } from './config.js';
import { openDatabase, applySchema, closeDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { createAuthService } from './services/authService.js';
import { createCatalogService } from './services/catalogService.js';
import { createProductService } from './services/productService.js';
import { createCategoryService } from './services/categoryService.js';
import { createRecreoService } from './services/recreoService.js';
import { createOrderService } from './services/orderService.js';
import { createPaymentService } from './services/paymentService.js';
import { createApiRouter } from './api/index.js';
import { createStaticHandler } from './api/staticFiles.js';
import { normalizeError } from './lib/errors.js';
import { sendJson, securityHeaders } from './lib/http.js';

/** Ensambla base de datos + backend + API + frontend en un unico servidor. */
export function createApp({ dbPath = config.dbPath } = {}) {
  const db = openDatabase(dbPath);
  applySchema(db);
  const seedResult = seedDatabase(db);

  const ctx = {
    db,
    config,
    auth: createAuthService({ db, config }),
    catalog: createCatalogService({ db }),
    products: createProductService({ db }),
    categories: createCategoryService({ db }),
    recreos: createRecreoService({ db }),
    orders: createOrderService({ db, config }),
    payments: createPaymentService({ db, config }),
  };

  const handleApi = createApiRouter(ctx);
  const serveStatic = createStaticHandler(config.publicDir);

  const cleanupTimer = setInterval(() => ctx.auth.cleanup(), 60 * 60 * 1000);
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

  async function handle(req, res) {
    const startedAt = performance.now();
    const baseHeaders = securityHeaders();
    for (const [name, value] of Object.entries(baseHeaders)) {
      res.setHeader(name, value);
    }

    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      sendJson(res, 400, { error: { code: 'BAD_REQUEST', message: 'Solicitud inválida.' } });
      return;
    }

    try {
      const isApi = url.pathname === '/api' || url.pathname.startsWith('/api/');

      if (isApi) {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, { Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' });
          res.end();
          return;
        }
        const matched = await handleApi(req, res, url);
        if (!matched) {
          sendJson(res, 404, {
            error: { code: 'ROUTE_NOT_FOUND', message: 'La ruta solicitada no existe.' },
          });
        }
        return;
      }

      const served = await serveStatic(req, res, url);
      if (!served) {
        sendJson(res, 404, {
          error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' },
        });
      }
    } catch (error) {
      const appError = normalizeError(error);
      if (appError.status >= 500) {
        console.error(`[error] ${req.method} ${url.pathname}:`, error);
      }
      if (!res.headersSent) {
        sendJson(res, appError.status, appError.toJSON());
      } else {
        res.end();
      }
    } finally {
      const elapsed = Math.round(performance.now() - startedAt);
      const status = res.statusCode || 0;
      console.log(`${req.method.padEnd(6)} ${url.pathname.padEnd(34)} ${status} ${elapsed}ms`);
    }
  }

  function close() {
    clearInterval(cleanupTimer);
    closeDatabase(db);
  }

  return { handle, ctx, db, seedResult, close };
}
