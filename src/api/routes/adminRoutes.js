import { readJsonBody, sendJson } from '../../lib/http.js';
import { requireAdmin } from '../guards.js';

export function registerAdminRoutes(routes, ctx) {
  const { products, categories, recreos, orders, auth, db } = ctx;

  const admin = (req) => requireAdmin(ctx, req);

  // --- Productos -----------------------------------------------------------
  routes.push({
    method: 'GET',
    path: '/api/admin/products',
    handler: async (req, res, { url }) => {
      admin(req);
      const search = url.searchParams.get('search')?.trim() || null;
      sendJson(res, 200, { products: products.listAll({ search }) });
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/admin/products',
    handler: async (req, res) => {
      admin(req);
      const body = await readJsonBody(req);
      sendJson(res, 201, { product: products.create(body) });
    },
  });

  routes.push({
    method: 'PUT',
    path: '/api/admin/products/:id',
    handler: async (req, res, { params }) => {
      admin(req);
      const body = await readJsonBody(req);
      sendJson(res, 200, { product: products.update(params.id, body) });
    },
  });

  routes.push({
    method: 'PATCH',
    path: '/api/admin/products/:id/stock',
    handler: async (req, res, { params }) => {
      admin(req);
      const body = await readJsonBody(req);
      sendJson(res, 200, { product: products.updateStock(params.id, body) });
    },
  });

  routes.push({
    method: 'DELETE',
    path: '/api/admin/products/:id',
    handler: async (req, res, { params }) => {
      admin(req);
      sendJson(res, 200, products.remove(params.id));
    },
  });

  // --- Categorias ----------------------------------------------------------
  routes.push({
    method: 'GET',
    path: '/api/admin/categories',
    handler: async (req, res) => {
      admin(req);
      sendJson(res, 200, { categories: categories.list() });
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/admin/categories',
    handler: async (req, res) => {
      admin(req);
      const body = await readJsonBody(req);
      sendJson(res, 201, { category: categories.create(body) });
    },
  });

  routes.push({
    method: 'PUT',
    path: '/api/admin/categories/:id',
    handler: async (req, res, { params }) => {
      admin(req);
      const body = await readJsonBody(req);
      sendJson(res, 200, { category: categories.update(params.id, body) });
    },
  });

  routes.push({
    method: 'DELETE',
    path: '/api/admin/categories/:id',
    handler: async (req, res, { params }) => {
      admin(req);
      sendJson(res, 200, categories.remove(params.id));
    },
  });

  // --- Recreos -------------------------------------------------------------
  routes.push({
    method: 'GET',
    path: '/api/admin/recreos',
    handler: async (req, res) => {
      admin(req);
      sendJson(res, 200, { recreos: recreos.listAll() });
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/admin/recreos',
    handler: async (req, res) => {
      admin(req);
      const body = await readJsonBody(req);
      sendJson(res, 201, { recreo: recreos.create(body) });
    },
  });

  routes.push({
    method: 'PUT',
    path: '/api/admin/recreos/:id',
    handler: async (req, res, { params }) => {
      admin(req);
      const body = await readJsonBody(req);
      sendJson(res, 200, { recreo: recreos.update(params.id, body) });
    },
  });

  routes.push({
    method: 'DELETE',
    path: '/api/admin/recreos/:id',
    handler: async (req, res, { params }) => {
      admin(req);
      sendJson(res, 200, recreos.remove(params.id));
    },
  });

  // --- Pedidos -------------------------------------------------------------
  routes.push({
    method: 'GET',
    path: '/api/admin/orders',
    handler: async (req, res, { url }) => {
      admin(req);
      const status = url.searchParams.get('status') || null;
      const recreoId = url.searchParams.get('recreoId') || null;
      const dateParam = url.searchParams.get('date') || null;
      const serviceDate = dateParam && dateParam !== 'all' ? dateParam : null;
      const list = orders.listAdmin({ status, recreoId, serviceDate, limit: 300 });
      sendJson(res, 200, { orders: list });
    },
  });

  routes.push({
    method: 'PATCH',
    path: '/api/admin/orders/:id/status',
    handler: async (req, res, { params }) => {
      admin(req);
      const body = await readJsonBody(req);
      sendJson(res, 200, { order: orders.updateStatus(params.id, body.status) });
    },
  });

  routes.push({
    method: 'PATCH',
    path: '/api/admin/orders/:id/payment',
    handler: async (req, res, { params }) => {
      admin(req);
      const body = await readJsonBody(req);
      sendJson(res, 200, { order: orders.updatePaymentStatus(params.id, body.status) });
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/admin/stats',
    handler: async (req, res) => {
      admin(req);
      sendJson(res, 200, { stats: orders.getStats() });
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/admin/users',
    handler: async (req, res) => {
      admin(req);
      sendJson(res, 200, { users: auth.listUsers() });
    },
  });

  // Crea cuentas (admin o cliente) con cualquier correo, desde el panel.
  routes.push({
    method: 'POST',
    path: '/api/admin/users',
    handler: async (req, res) => {
      admin(req);
      const body = await readJsonBody(req);
      const user = auth.createAccount(body);
      sendJson(res, 201, { user });
    },
  });

  // Borra una cuenta (y sus pedidos y sesiones). No se puede borrar la propia.
  routes.push({
    method: 'DELETE',
    path: '/api/admin/users/:id',
    handler: async (req, res, { params }) => {
      const session = admin(req);
      const result = auth.deleteAccount(params.id, { actorId: session.user.id });
      sendJson(res, 200, result);
    },
  });

  // Ejecuta consultas SQL (solo admin). Conectado a la base real del servidor.
  routes.push({
    method: 'POST',
    path: '/api/admin/sql',
    handler: async (req, res) => {
      admin(req);
      const body = await readJsonBody(req);
      const sql = typeof body?.sql === 'string' ? body.sql.trim() : '';
      if (!sql) {
        sendJson(res, 400, { error: { code: 'BAD_REQUEST', message: 'Ingresá una consulta SQL.' } });
        return;
      }

      try {
        const isRead = /^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(sql);
        if (isRead) {
          const rows = db.query(sql).all();
          const columns = rows.length ? Object.keys(rows[0]) : [];
          sendJson(res, 200, { kind: 'rows', columns, rows, count: rows.length });
          return;
        }

        const result = db.run(sql);
        sendJson(res, 200, {
          kind: 'run',
          changes: result?.changes ?? 0,
          lastInsertRowid:
            result?.lastInsertRowid === null || result?.lastInsertRowid === undefined
              ? null
              : Number(result.lastInsertRowid),
        });
      } catch (error) {
        sendJson(res, 400, {
          error: {
            code: 'SQL_ERROR',
            message: error?.message || 'Error al ejecutar la consulta SQL.',
          },
        });
      }
    },
  });
}
