import { api } from '../api.js';
import { errorBlock, emptyState, spinnerBlock } from '../ui.js';
import { escapeHtml, formatDateTime, formatLongDate, money, STATUS_META, statusBadge } from '../utils.js';

const STEPS = [
  { key: 'pendiente', label: 'Pedido recibido' },
  { key: 'preparando', label: 'En preparación' },
  { key: 'listo', label: 'Listo para retirar' },
  { key: 'entregado', label: 'Entregado' },
];

function renderTimeline(order) {
  if (order.status === 'cancelado') {
    return `<p class="order-cancelled">✕ Pedido cancelado · el stock fue devuelto al kiosco</p>`;
  }
  const currentStep = STATUS_META[order.status]?.step ?? 1;
  return `
    <ol class="timeline">
      ${STEPS.map((step, index) => {
        const position = index + 1;
        const classes = ['timeline-step'];
        if (position <= currentStep) classes.push('is-done');
        if (position === currentStep) classes.push('is-current');
        return `<li class="${classes.join(' ')}"><span class="timeline-dot">${position <= currentStep ? '✓' : position}</span><span class="timeline-label">${step.label}</span></li>`;
      }).join('')}
    </ol>
  `;
}

function renderOrderCard(order) {
  return `
    <article class="order-card" data-order-card="${order.id}">
      <header class="order-head">
        <div>
          <p class="order-code">${escapeHtml(order.code)}</p>
          <p class="order-when">
            ${escapeHtml(order.recreoName ?? 'Recreo')} · ${escapeHtml(order.recreoStartTime ?? '')}–${escapeHtml(order.recreoEndTime ?? '')}
            · ${escapeHtml(formatLongDate(order.serviceDate))}
          </p>
        </div>
        ${statusBadge(order.status)}
      </header>

      <div class="order-body">
        <ul class="order-items">
          ${order.items
            .map(
              (item) => `
              <li>
                <span class="order-item-qty">${item.quantity}×</span>
                <span class="order-item-name">${escapeHtml(item.productName)}</span>
                <span class="order-item-amount">${money(item.subtotalCents)}</span>
              </li>`,
            )
            .join('')}
        </ul>
        ${order.notes ? `<p class="order-notes">📝 ${escapeHtml(order.notes)}</p>` : ''}
        ${renderTimeline(order)}
      </div>

      <footer class="order-foot">
        <div class="order-total"><span>Total</span><strong>${money(order.totalCents)}</strong></div>
        <div class="order-actions">
          <span class="order-time">Creado ${escapeHtml(formatDateTime(order.createdAt))}</span>
          ${
            order.paymentStatus && order.paymentStatus !== 'unpaid'
              ? `<span class="badge badge-plain">Pago: ${escapeHtml(order.paymentStatus)}</span>`
              : ''
          }
          ${
            order.status === 'pendiente' && (!order.paymentStatus || order.paymentStatus === 'unpaid' || order.paymentStatus === 'rejected')
              ? `<button type="button" class="btn btn-primary btn-sm" data-action="pay-order" data-id="${order.id}">Pagar</button>`
              : ''
          }
          ${
            order.status === 'pendiente'
              ? `<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-order" data-id="${order.id}">Cancelar pedido</button>`
              : ''
          }
        </div>
      </footer>
    </article>
  `;
}

export async function renderOrders(app, container) {
  container.innerHTML = `
    <section class="orders">
      <header class="page-head">
        <div>
          <p class="eyebrow">Tus reservas</p>
          <h1>Mis pedidos</h1>
          <p class="page-sub">Seguí el estado de cada pedido. La lista se actualiza sola cada 20 segundos.</p>
        </div>
        <button type="button" class="btn btn-soft" data-action="open-cart">🛒 Armar otro pedido</button>
      </header>
      <div id="orders-list">${spinnerBlock('Cargando tus pedidos...')}</div>
    </section>
  `;

  const list = container.querySelector('#orders-list');

  function paint() {
    const { orders } = app.state;
    if (!orders.length) {
      list.innerHTML = emptyState({
        icon: '🧾',
        title: 'Todavía no hiciste pedidos',
        text: 'Armá tu pedido, elegí el recreo y seguí su estado desde acá.',
        action: '<button type="button" class="btn btn-primary" data-action="open-cart">Ver el catálogo</button>',
      });
      return;
    }
    list.innerHTML = `<div class="orders-grid">${orders.map(renderOrderCard).join('')}</div>`;
  }

  async function load() {
    try {
      await app.loadOrders();
      paint();
    } catch (error) {
      list.innerHTML = errorBlock(error.message, 'refresh-orders');
    }
  }

  await load();
  app.poll(load, 20000);
}
