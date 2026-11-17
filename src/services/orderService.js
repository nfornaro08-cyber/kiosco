import { AppError } from '../lib/errors.js';
import { dateISO, integer, list, oneOf, text } from '../lib/validation.js';
import { localDateISO } from '../lib/dates.js';
import { generateOrderCode } from '../lib/orderCode.js';
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

      // Unificación: si es efectivo y ya existe un pedido en efectivo para el mismo usuario/recreo/fecha, se unifican.
      if (cleanPaymentMethod === 'cash') {
        const mergeTarget = orders.findMergeCandidate({
          userId,
          recreoId: cleanRecreoId,
          serviceDate,
          paymentMethod: 'cash',
        });

        if (mergeTarget) {
          for (const line of preparedLines) {
            const reserved = products.decrementStock(line.productId, line.quantity);
            if (!reserved) {
              throw AppError.conflict('INSUFFICIENT_STOCK', `No hay stock suficiente de "${line.productName}".`);
            }
            const existingItem = orders.getItem(mergeTarget.id, line.productId);
            if (existingItem) {
              const newQty = existingItem.quantity + line.quantity;
              orders.updateItem(existingItem.id, {
                quantity: newQty,
                subtotalCents: existingItem.unitPriceCents * newQty,
              });
            } else {
              orders.addItem(mergeTarget.id, line);
            }
          }
          const updated = orders.findById(mergeTarget.id);
          const total = (updated?.items || []).reduce((sum, it) => sum + (it.subtotalCents || 0), 0);
          orders.updateTotals(mergeTarget.id, total);
          orders.appendNotes(mergeTarget.id, cleanNotes);
          return orders.findById(mergeTarget.id);
        }
      }

      let orderId = null;
      for (let attempt = 0; attempt < 20 && orderId === null; attempt += 1) {
        const code = generateOrderCode();
        try {
          orderId = orders.create({
            code,
            userId,
            recreoId: cleanRecreoId,
            serviceDate,
            totalCents,
            notes: cleanNotes,
            paymentMethod: cleanPaymentMethod,
          });
        } catch (error) {
          if (!String(error?.message ?? '').includes('UNIQUE')) throw error;
        }
      }
      if (orderId === null) {
        throw AppError.internal('No se pudo generar un código de pedido único. Intentá nuevamente.');
      }

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

  function mergeApprovedMpOrders(orderId) {
    const tx = db.transaction(() => {
      const order = orders.findById(orderId);
      if (!order) return null;
      if (order.paymentMethod !== 'mercadopago' || order.paymentStatus !== 'approved') return null;
      if (!['pendiente', 'preparando', 'listo'].includes(order.status)) return null;

      const target = orders.findMergeCandidate({
        userId: order.userId,
        recreoId: order.recreoId,
        serviceDate: order.serviceDate,
        paymentMethod: 'mercadopago',
        paymentStatus: 'approved',
        excludeId: order.id,
      });
      if (!target) return null;

      for (const item of order.items || []) {
        const existingItem = orders.getItem(target.id, item.productId);
        if (existingItem) {
          const newQty = existingItem.quantity + item.quantity;
          orders.updateItem(existingItem.id, {
            quantity: newQty,
            subtotalCents: existingItem.unitPriceCents * newQty,
          });
        } else if (item.productId) {
          orders.addItem(target.id, {
            productId: item.productId,
            productName: item.productName,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
            subtotalCents: item.subtotalCents,
          });
        } else {
          orders.addItem(target.id, {
            productId: null,
            productName: item.productName,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
            subtotalCents: item.subtotalCents,
          });
        }
      }

      const updatedTarget = orders.findById(target.id);
      const total = (updatedTarget?.items || []).reduce((sum, it) => sum + (it.subtotalCents || 0), 0);
      orders.updateTotals(target.id, total);
      orders.appendNotes(target.id, order.notes);

      const now = new Date().toISOString();
      db.prepare('UPDATE payments SET order_id = ?, updated_at = ? WHERE order_id = ?').run(target.id, now, order.id);
      orders.delete(order.id);
      return orders.findById(target.id);
    });

    return tx.immediate();
  }

  function updatePaymentStatus(orderId, paymentStatus) {
    const id = integer(orderId, 'orderId', { min: 1 });
    const status = oneOf(paymentStatus, 'paymentStatus', ['unpaid', 'pending', 'approved', 'rejected', 'cancelled', 'refunded']);
    const order = orders.findById(id);
    if (!order) throw AppError.notFound('ORDER_NOT_FOUND', 'El pedido no existe.');
    const updated = orders.updatePaymentStatus(id, status);
    if (status === 'approved' && updated?.paymentMethod === 'mercadopago') {
      const merged = mergeApprovedMpOrders(updated.id);
      if (merged) return merged;
    }
    return updated;
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
