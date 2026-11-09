import { readJsonBody, sendJson } from '../../lib/http.js';
import { requireUser } from '../guards.js';

export function registerPaymentRoutes(routes, ctx) {
  const { payments } = ctx;

  routes.push({
    method: 'POST',
    path: '/api/orders/:id/pay',
    handler: async (req, res, { params }) => {
      const session = requireUser(ctx, req);
      const result = await payments.createCheckout(params.id, session.user);
      sendJson(res, 201, result);
    },
  });

  routes.push({
    method: 'GET',
    path: '/api/orders/:id/payment',
    handler: async (req, res, { params }) => {
      const session = requireUser(ctx, req);
      const result = await payments.getStatus(params.id, session.user);
      sendJson(res, 200, result);
    },
  });

  // Webhook publico del proveedor de pagos.
  routes.push({
    method: 'POST',
    path: '/api/webhooks/payments',
    handler: async (req, res) => {
      const body = await readJsonBody(req);
      const result = await payments.handleWebhook(body);
      sendJson(res, 200, result);
    },
  });
}