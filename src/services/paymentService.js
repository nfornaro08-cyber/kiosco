import { AppError } from '../lib/errors.js';
import { integer } from '../lib/validation.js';
import { createPaymentRepository } from '../repositories/paymentRepository.js';
import { createOrderRepository } from '../repositories/orderRepository.js';
import { createOrder, getOrder, getPayment } from '../lib/payments/mercadopago.js';

export function createPaymentService({ db, config }) {
  const payments = createPaymentRepository(db);
  const orders = createOrderRepository(db);

  function getOrderForActor(orderId, actor) {
    const id = integer(orderId, 'orderId', { min: 1 });
    const order = orders.findById(id);
    if (!order) throw AppError.notFound('ORDER_NOT_FOUND', 'El pedido no existe.');
    if (actor.role !== 'admin' && order.userId !== actor.id) {
      throw AppError.forbidden('ORDER_FORBIDDEN', 'No tenés acceso a este pedido.');
    }
    return order;
  }

  async function createCheckout(orderId, actor) {
    const order = getOrderForActor(orderId, actor);

    if (order.status === 'cancelado' || order.status === 'entregado') {
      throw AppError.conflict('ORDER_FINAL', 'No se puede pagar un pedido cancelado o entregado.');
    }

    if (!config.payments.accessToken) {
      throw AppError.internal('Los pagos no están configurados en el servidor.');
    }

    const existing = payments.findByOrder(order.id);
    if (existing && existing.status === 'approved') {
      throw AppError.conflict('PAYMENT_ALREADY_APPROVED', 'Este pedido ya fue pagado.');
    }

    // Permite reintentar aunque el intento anterior haya quedado pendiente/no pagado.
    const payment =
      existing && existing.status !== 'approved'
        ? payments.updateStatus(existing.id, 'pending', { paymentMethod: null })
        : payments.create({
            orderId: order.id,
            provider: config.payments.provider,
            amountCents: order.totalCents,
            externalReference: `order-${order.id}`,
          });

    let result;
    try {
      result = await createOrder({
        accessToken: config.payments.accessToken,
        order,
        config,
      });
    } catch (error) {
      console.error('[mercadopago] createOrder:', error?.message ?? error);
      throw AppError.internal('No se pudo crear la orden de pago. Intentá nuevamente.');
    }

    payments.setPreference(payment.id, result.orderId);

    orders.updatePaymentStatus(order.id, 'pending');

    return {
      payment: payments.findById(payment.id),
      checkoutUrl: result.checkoutUrl,
    };
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

      // Unificar: sumar ítems del pedido actual al pedido aprobado existente.
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
          // Ítem sin productId: agregar como línea nueva.
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

      // Mover pagos del pedido unificado al pedido destino y eliminar el duplicado.
      payments.reassignByOrder(order.id, target.id);
      orders.delete(order.id);
      return orders.findById(target.id);
    });

    return tx.immediate();
  }

  async function handleWebhook(payload) {
    if (!payload || !payload.data?.id) {
      return { ok: true, ignored: true };
    }

    if (!config.payments.accessToken) {
      return { ok: true, ignored: true };
    }

    const type = payload.type || payload.topic || '';

    // Checkout Pro via Orders API: notificacion de orden.
    if (type === 'order' || type === 'orders') {
      let mpOrder;
      try {
        mpOrder = await getOrder({ accessToken: config.payments.accessToken, orderId: payload.data.id });
      } catch (error) {
        throw AppError.badRequest('WEBHOOK_INVALID', 'No se pudo validar la orden con el proveedor.');
      }

      const statusMap = {
        processed: 'approved',
        cancelled: 'cancelled',
        expired: 'cancelled',
        created: 'pending',
        action_required: 'pending',
      };

      const nextStatus = statusMap[mpOrder.status] ?? 'pending';
      const externalReference = mpOrder.external_reference || '';

      const payment = payments.findByExternalReference(externalReference);
      if (!payment) {
        return { ok: true, ignored: true };
      }

      if (payment.status === 'approved' && nextStatus === 'approved') {
        return { ok: true, duplicate: true };
      }

      payments.updateStatus(payment.id, nextStatus, {
        paymentMethod: mpOrder.payment_method_id ?? null,
      });

      orders.updatePaymentStatus(payment.orderId, nextStatus);
      if (nextStatus === 'approved') {
        const merged = mergeApprovedMpOrders(payment.orderId);
        if (merged) return { ok: true, mergedInto: merged.id };
      }

      return { ok: true };
    }

    // Notificacion de pago individual (fallback).
    if (type === 'payment') {
      let mpPayment;
      try {
        mpPayment = await getPayment({ accessToken: config.payments.accessToken, paymentId: payload.data.id });
      } catch (error) {
        throw AppError.badRequest('WEBHOOK_INVALID', 'No se pudo validar el pago con el proveedor.');
      }

      const statusMap = {
        approved: 'approved',
        rejected: 'rejected',
        cancelled: 'cancelled',
        refunded: 'refunded',
        pending: 'pending',
        in_process: 'pending',
      };

      const nextStatus = statusMap[mpPayment.status] ?? 'pending';
      const externalReference = mpPayment.external_reference || '';

      const payment = payments.findByExternalReference(externalReference);
      if (!payment) {
        return { ok: true, ignored: true };
      }

      if (payment.status === 'approved' && nextStatus === 'approved') {
        return { ok: true, duplicate: true };
      }

      payments.updateStatus(payment.id, nextStatus, {
        paymentMethod: mpPayment.payment_method_id ?? null,
      });

      orders.updatePaymentStatus(payment.orderId, nextStatus);
      if (nextStatus === 'approved') {
        const merged = mergeApprovedMpOrders(payment.orderId);
        if (merged) return { ok: true, mergedInto: merged.id };
      }

      return { ok: true };
    }

    return { ok: true, ignored: true };
  }

  function getStatus(orderId, actor) {
    const order = getOrderForActor(orderId, actor);
    const payment = payments.findByOrder(order.id);
    return { order, payment };
  }

  return {
    createCheckout,
    handleWebhook,
    getStatus,
  };
}