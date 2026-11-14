import { createHmac, timingSafeEqual } from 'node:crypto';
import { readJsonBody, sendJson } from '../../lib/http.js';
import { requireUser } from '../guards.js';

/**
 * Valida la firma x-signature que Mercado Pago incluye en sus webhooks.
 * Manifest: "id:{dataId};request-id:{x-request-id};ts:{ts};" firmado con HMAC-SHA256.
 * Solo se exige si PAYMENT_WEBHOOK_SECRET esta configurado.
 */
function validWebhookSignature(req, url, payload, secret) {
  const header = String(req.headers['x-signature'] ?? '');
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((piece) => piece.split('=').map((value) => value.trim())),
  );
  const ts = parts.ts;
  if (!ts) return false;
  const provided = header
    .split(',')
    .filter((piece) => piece.trim().startsWith('v1='))
    .map((piece) => piece.trim().slice(3));
  if (provided.length === 0) return false;

  const dataId =
    payload?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? '';
  const requestId = String(req.headers['x-request-id'] ?? '');
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  return provided.some((value) => {
    try {
      const buffer = Buffer.from(value, 'hex');
      return buffer.length === expected.length / 2 && timingSafeEqual(buffer, Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  });
}

export function registerPaymentRoutes(routes, ctx) {
  const { payments, config } = ctx;

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

  // Webhook publico del proveedor de pagos. Si hay secreto configurado se
  // valida la firma x-signature; una notificacion sin firma valida se rechaza.
  routes.push({
    method: 'POST',
    path: '/api/webhooks/payments',
    handler: async (req, res, { url }) => {
      const body = await readJsonBody(req);
      if (config.payments.webhookSecret && !validWebhookSignature(req, url, body, config.payments.webhookSecret)) {
        sendJson(res, 401, {
          error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Firma de notificacion invalida.' },
        });
        return;
      }
      const result = await payments.handleWebhook(body);
      sendJson(res, 200, result);
    },
  });
}