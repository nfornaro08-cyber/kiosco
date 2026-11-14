import { AppError } from '../lib/errors.js';
import { dateISO, integer, list, oneOf, text } from '../lib/validation.js';
import { localDateISO } from '../lib/dates.js';
import { createOrderRepository } from '../repositories/orderRepository.js';
import { createProductRepository } from '../repositories/productRepository.js';
import { createRecreoRepository } from '../repositories/recreoRepository.js';

export const ORDER_STATUSES = ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado'];

const TRANSITIONS = {
  pendiente: ['preparando', 'listo', 'cancelado'],
  preparando: ['listo', 'cancelado'],
  listo: ['entregado', 'cancelado'],
  entregado: [],
  cancelado: [],
};

function parseOrderItems(rawItems) {
  const items = list(rawItems, 'items', { min: 1, max: 40 });
  const merged = new Map();

  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Cada item debe tener productId y quantity.', {
        items: 'Formato de ítem inválido.',
      });
    }
    const productId = integer(raw.productId, 'items.productId', { min: 1 });
    const quantity = integer(raw.quantity, 'items.quantity', { min: 1, max: 99 });
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }

  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export function createOrderService({ db, config }) {
  const orders = createOrderRepository(db);
  const products = createProductRepository(db);
  const recreos = createRecreoRepository(db);

  function restoreStock(order) {
    if (order.stockRestored) return;
    for (const item of order.items) {
      if (item.productId) {
        products.incrementStock(item.productId, item.quantity);
      }
    }
  }

  function getForActor(orderId, actor) {
    const id = integer(orderId, 'orderId', { min: 1 });
    const order = orders.findById(id);
    if (!order) throw AppError.notFound('ORDER_NOT_FOUND', 'El pedido no existe.');
    if (actor.role !== 'admin' && order.userId !== actor.id) {
      throw AppError.forbidden('ORDER_FORBIDDEN', 'No tenes acceso a este pedido.');
    }
    return order;
  }

  /** Crea el pedido, valida stock y descuenta existencias en una sola transaccion. */
  function create({ userId, recreoId, items, notes, paymentMethod = 'mercadopago' }) {
    const cleanRecreoId = integer(recreoId, 'recreoId', { min: 1 });
    const cleanNotes = text(notes, 'notes', { required: false, max: 200 }) ?? '';
    const cleanPaymentMethod = oneOf(paymentMethod ?? 'mercadopago', 'paymentMethod', ['cash', 'mercadopago']);
    const lines = parseOrderItems(items);
    const serviceDate = localDateISO(new Date(), config.timeZone);

    const transaction = db.transaction(() => {
      const recreo = recreos.findActiveById(cleanRecreoId);
      if (!recreo) {
        throw AppError.badRequest('RECREO_NOT_AVAILABLE', 'El recreo seleccionado no está disponible.', {
          recreoId: 'Elegí un recreo habilitado.',
        });
      }

      let totalCents = 0;
      const preparedLines = [];

      for (const line of lines) {
        const product = products.findById(line.productId);
        if (!product || !product.active) {
          throw AppError.conflict('PRODUCT_NOT_AVAILABLE', 'Uno de los productos elegidos ya no está disponible.');
        }
        if (product.stock < line.quantity) {
          throw AppError.conflict('INSUFFICIENT_STOCK', `No hay stock suficiente de "${product.name}".`, {
            productId: product.id,
            productName: product.name,
            available: product.stock,
            requested: line.quantity,
          });
        }

        const subtotalCents = product.priceCents * line.quantity;
        totalCents += subtotalCents;
        preparedLines.push({
          productId: product.id,
          productName: product.name,
          unitPriceCents: product.priceCents,
          quantity: line.quantity,
          subtotalCents,
        });
      }

      const orderId = orders.create({
        userId,
        recreoId: cleanRecreoId,
        serviceDate,
        totalCents,
        notes: cleanNotes,
        paymentMethod: cleanPaymentMethod,
      });

      for (const line of preparedLines) {
        const reserved = products.decrementStock(line.productId, line.quantity);
        if (!reserved) {
          throw AppError.conflict('INSUFFICIENT_STOCK', `No hay stock suficiente de "${line.productName}".`);
        }
        orders.addItem(orderId, line);
      }

      return orders.findById(orderId);
    });

    return transaction.immediate();
  }

  function listMine(userId) {
    return orders.listByUser(userId);
  }

  function cancel(orderId, actor) {
    const transaction = db.transaction(() => {
      const order = getForActor(orderId, actor);

      if (order.status === 'cancelado') {
        throw AppError.conflict('ORDER_ALREADY_CANCELLED', 'Este pedido ya estaba cancelado.');
      }
      if (order.status === 'entregado') {
        throw AppError.conflict('ORDER_DELIVERED', 'Un pedido entregado no se puede cancelar.');
      }
      if (actor.role !== 'admin' && order.status !== 'pendiente') {
        throw AppError.conflict(
          'ORDER_IN_PROGRESS',
          'El pedido ya está en preparación. Pedile al kiosco que lo cancele.',
        );
      }

      restoreStock(order);
      return orders.updateStatus(order.id, 'cancelado', { stockRestored: true });
    });

    return transaction.immediate();
  }

  function updateStatus(orderId, status) {
    const nextStatus = oneOf(status, 'status', ORDER_STATUSES);

    const transaction = db.transaction(() => {
      const id = integer(orderId, 'orderId', { min: 1 });
      const order = orders.findById(id);
      if (!order) throw AppError.notFound('ORDER_NOT_FOUND', 'El pedido no existe.');

      const allowed = TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(nextStatus)) {
        throw AppError.conflict(
          'INVALID_TRANSITION',
          `No se puede pasar un pedido de "${order.status}" a "${nextStatus}".`,
          { from: order.status, to: nextStatus, allowed },
        );
      }

      if (nextStatus === 'cancelado') {
        restoreStock(order);
        return orders.updateStatus(id, nextStatus, { stockRestored: true });
      }
      return orders.updateStatus(id, nextStatus);
    });

    return transaction.immediate();
  }

  function updatePaymentStatus(orderId, paymentStatus) {
    const id = integer(orderId, 'orderId', { min: 1 });
    const status = oneOf(paymentStatus, 'paymentStatus', ['unpaid', 'pending', 'approved', 'rejected', 'cancelled', 'refunded']);
    const order = orders.findById(id);
    if (!order) throw AppError.notFound('ORDER_NOT_FOUND', 'El pedido no existe.');
    return orders.updatePaymentStatus(id, status);
  }

  function listAdmin({ status = null, recreoId = null, serviceDate = null, limit = 200 } = {}) {
    const filters = { limit: integer(limit, 'limit', { min: 1, max: 500 }) };
    if (status) filters.status = oneOf(status, 'status', ORDER_STATUSES);
    if (recreoId) filters.recreoId = integer(recreoId, 'recreoId', { min: 1 });
    if (serviceDate) filters.serviceDate = dateISO(serviceDate, 'serviceDate');
    return orders.list(filters);
  }

  function getStats() {
    const serviceDate = localDateISO(new Date(), config.timeZone);
    const rows = orders.statsByStatus(serviceDate);

    const byStatus = Object.fromEntries(ORDER_STATUSES.map((status) => [status, { count: 0, amountCents: 0 }]));
    for (const row of rows) {
      byStatus[row.status] = { count: row.count, amountCents: row.amountCents };
    }

    const weekStart = localDateISO(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), config.timeZone);

    return {
      serviceDate,
      ordersToday: rows.reduce((total, row) => total + row.count, 0),
      activeOrders: byStatus.pendiente.count + byStatus.preparando.count + byStatus.listo.count,
      deliveredTodayCents: byStatus.entregado.amountCents,
      byStatus,
      lowStock: products.lowStock(5),
      topProducts: orders.topProducts(weekStart, 5).map((row) => ({
        name: row.name,
        quantity: row.quantity,
        amountCents: row.amount,
      })),
      recentOrders: orders.list({ limit: 8 }),
    };
  }

  return {
    create,
    getForActor,
    listMine,
    listAdmin,
    cancel,
    updateStatus,
    updatePaymentStatus,
    getStats,
  };
}
