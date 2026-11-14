const API_BASE = 'https://api.mercadopago.com';

export async function createOrder({ accessToken, order, config }) {
  if (!accessToken) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }

  const idempotencyKey = crypto.randomUUID();

  const body = {
    type: 'online',
    total_amount: (order.totalCents / 100).toFixed(2),
    external_reference: `order-${order.id}`,
    processing_mode: 'manual',
    capture_mode: 'automatic_async',
    description: `Pedido #${order.id}`,
    payer: {
      email: order.userEmail || undefined,
    },
    config: {
      statement_descriptor: 'Kiosco Recreo',
      online: {
        success_url: `${config.payments.baseUrl}/#/pedidos?pago=exito`,
        failure_url: `${config.payments.baseUrl}/#/pedidos?pago=error`,
        pending_url: `${config.payments.baseUrl}/#/pedidos?pago=pendiente`,
        auto_return: 'approved',
      },
    },
    items: order.items.map((item) => ({
      title: item.productName,
      quantity: item.quantity,
      unit_price: (item.unitPriceCents / 100).toFixed(2),
      external_code: String(item.productId),
    })),
  };

  const response = await fetch(`${API_BASE}/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MERCADOPAGO_ERROR: ${response.status} ${text}`);
  }

  const data = await response.json();
  return {
    orderId: data.id,
    checkoutUrl: data.checkout_url,
  };
}

export async function getOrder({ accessToken, orderId }) {
  if (!accessToken) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }

  const response = await fetch(`${API_BASE}/v1/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MERCADOPAGO_ERROR: ${response.status} ${text}`);
  }

  return response.json();
}

export async function getPayment({ accessToken, paymentId }) {
  if (!accessToken) {
    throw new Error('PAYMENT_NOT_CONFIGURED');
  }

  const response = await fetch(`${API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MERCADOPAGO_ERROR: ${response.status} ${text}`);
  }

  return response.json();
}