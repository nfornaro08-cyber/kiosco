import { readJsonBody, sendJson } from '../../lib/http.js';
import { requireUser } from '../guards.js';

export function registerOrderRoutes(routes, ctx) {
  const { orders } = ctx;

  routes.push({
    method: 'GET',
    path: '/api/orders',
    handler: async (req, res) => {
      const { user } = requireUser(ctx, req);
      sendJson(res, 200, { orders: orders.listMine(user.id) });
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/orders',
    handler: async (req, res) => {
      const { user } = requireUser(ctx, req);
      const body = await readJsonBody(req);
      const order = orders.create({
        userId: user.id,
        recreoId: body.recreoId,
        items: body.items,
        notes: body.notes,
      });
      sendJson(res, 201, { order });
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/orders/:id',
    handler: async (req, res, { params }) => {
      const { user } = requireUser(ctx, req);
      sendJson(res, 200, { order: orders.getForActor(params.id, user) });
    },
  });

  routes.push({
    method: 'POST',
    path: '/api/orders/:id/cancel',
    handler: async (req, res, { params }) => {
      const { user } = requireUser(ctx, req);
      sendJson(res, 200, { order: orders.cancel(params.id, user) });
    },
  });
}
