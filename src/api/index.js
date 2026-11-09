import { createRouter } from './router.js';
import { registerAuthRoutes } from './routes/authRoutes.js';
import { registerCatalogRoutes } from './routes/catalogRoutes.js';
import { registerOrderRoutes } from './routes/orderRoutes.js';
import { registerAdminRoutes } from './routes/adminRoutes.js';
import { registerPaymentRoutes } from './routes/paymentRoutes.js';

/** Construye la capa API completa (todas las rutas /api). */
export function createApiRouter(ctx) {
  const routes = [];
  registerAuthRoutes(routes, ctx);
  registerCatalogRoutes(routes, ctx);
  registerOrderRoutes(routes, ctx);
  registerAdminRoutes(routes, ctx);
  registerPaymentRoutes(routes, ctx);
  return createRouter(routes);
}
