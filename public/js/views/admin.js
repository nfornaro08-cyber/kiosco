import { api } from '../api.js';
import {
  confirmAction,
  emptyState,
  errorBlock,
  openModal,
  setButtonLoading,
  spinnerBlock,
  toast,
} from '../ui.js';
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatTime,
  money,
  STATUS_META,
  statusBadge,
  stockLabel,
  todayISO,
} from '../utils.js';

const TABS = [
  { id: 'resumen', label: 'Resumen', icon: '' },
  { id: 'productos', label: 'Productos', icon: '' },
  { id: 'pedidos', label: 'Pedidos', icon: '' },
  { id: 'recreos', label: 'Recreos', icon: '' },
  { id: 'categorias', label: 'Categorías', icon: '' },
  { id: 'usuarios', label: 'Usuarios', icon: '' },
  { id: 'sql', label: 'SQL', icon: '' },
];

const filters = {
  productsSearch: '',
  orders: { status: '', recreoId: '', date: todayISO() },
};

const cache = {
  products: [],
  categories: [],
  recreos: [],
  orders: [],
};

const NEXT_STATUS = {
  pendiente: [
    { status: 'preparando', label: 'Empezar preparación', className: 'btn-primary' },
    { status: 'listo', label: 'Marcar listo', className: 'btn-soft' },
  ],
  preparando: [{ status: 'listo', label: 'Marcar listo', className: 'btn-primary' }],
  listo: [{ status: 'entregado', label: 'Entregar pedido (código)', className: 'btn-primary' }],
  entregado: [],
  cancelado: [],
};

async function run(main, loader) {
  main.innerHTML = spinnerBlock('Cargando información...');
  try {
    await loader();
  } catch (error) {
    main.innerHTML = errorBlock(error.message);
  }
}

function statCard(label, value, icon, note = '') {
  return `
    <article class="stat-card">
      <span class="stat-icon" aria-hidden="true">${icon}</span>
      <div>
        <p class="stat-label">${escapeHtml(label)}</p>
        <p class="stat-value">${escapeHtml(String(value))}</p>
        ${note ? `<p class="stat-note">${escapeHtml(note)}</p>` : ''}
      </div>
    </article>
  `;
}

export async function renderAdmin(app, container, activeTab = 'resumen') {
  const tab = TABS.some((item) => item.id === activeTab) ? activeTab : 'resumen';

  container.innerHTML = `
    <section class="admin">
      <aside class="admin-side">
        <div class="admin-brand">
          <span class="admin-brand-icon">‍</span>
          <div>
            <strong>Administración</strong>
            <small>Kiosco del Recreo</small>
          </div>
        </div>
        <nav class="admin-nav" aria-label="Secciones de administración">
          ${TABS.map(
            (item) => `
            <a class="admin-nav-link ${item.id === tab ? 'is-active' : ''}" href="#/admin/${item.id}">
              <span aria-hidden="true">${item.icon}</span> ${item.label}
            </a>`,
          ).join('')}
        </nav>
        <div class="admin-side-foot">
          <p>Gestioná el catálogo, el stock y los pedidos del kiosco.</p>
          <a class="link-btn" href="#/catalogo">← Volver al catálogo</a>
        </div>
      </aside>

      <div class="admin-main" id="admin-main"></div>
    </section>
  `;

  const main = container.querySelector('#admin-main');

  main.addEventListener('click', (event) => {
    handleAdminClick(event, { app, main, tab }).catch((error) => {
      toast(error.message, 'error');
    });
  });
  main.addEventListener('change', (event) => {
    handleAdminChange(event, { app, main, tab }).catch((error) => toast(error.message, 'error'));
  });

  await paint(tab, main, app);
}

async function paint(tab, main, app) {
  if (tab === 'resumen') return paintResumen(main, app);
  if (tab === 'productos') return paintProductos(main, app);
  if (tab === 'pedidos') return paintPedidos(main, app);
  if (tab === 'recreos') return paintRecreos(main, app);
  if (tab === 'categorias') return paintCategorias(main, app);
  if (tab === 'sql') return paintSql(main, app);
  return paintUsuarios(main, app);
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
async function paintResumen(main, app) {
  await run(main, async () => {
    const { stats } = await api.admin.getStats();

    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Panel de administración</p>
          <h1>Resumen de hoy</h1>
          <p class="page-sub">${escapeHtml(formatLongDate(stats.serviceDate))}</p>
        </div>
        <button type="button" class="btn btn-soft" data-action="refresh">↻ Actualizar</button>
      </header>

      <div class="stat-grid">
        ${statCard('Pedidos de hoy', stats.ordersToday, '', `${stats.byStatus.pendiente.count} pendientes`)}
        ${statCard('En curso', stats.activeOrders, '', 'para preparar o retirar')}
        ${statCard('Recaudado hoy', money(stats.deliveredTodayCents), '', 'pedidos entregados')}
        ${statCard('Stock bajo', stats.lowStock.length, '', 'productos con 5 o menos')}
      </div>

      <div class="admin-grid">
        <section class="panel panel-wide">
          <header class="panel-head">
            <h2>Pedidos recientes</h2>
            <a class="link-btn" href="#/admin/pedidos">Ver todos →</a>
          </header>
          ${
            stats.recentOrders.length
              ? `<div class="table-scroll">
                  <table class="data-table compact">
                    <thead><tr><th>Pedido</th><th>Alumno</th><th>Recreo</th><th class="num">Total</th><th>Estado</th></tr></thead>
                    <tbody>
                      ${stats.recentOrders
                        .map(
                          (order) => `
                          <tr>
                            <td><strong>#${order.id}</strong><br /><small>${escapeHtml(formatTime(order.createdAt))}</small></td>
                            <td>${escapeHtml(order.userName ?? '')}</td>
                            <td>${escapeHtml(order.recreoName ?? '')}</td>
                            <td class="num">${money(order.totalCents)}</td>
                            <td>${statusBadge(order.status)}</td>
                          </tr>`,
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>`
              : emptyState({ icon: '', title: 'Sin pedidos por ahora', text: 'Los pedidos de hoy van a aparecer acá.' })
          }
        </section>

        <section class="panel">
          <header class="panel-head">
            <h2>Stock bajo</h2>
            <a class="link-btn" href="#/admin/productos">Reponer →</a>
          </header>
          ${
            stats.lowStock.length
              ? `<ul class="mini-list">
                  ${stats.lowStock
                    .slice(0, 6)
                    .map((product) => {
                      const stock = stockLabel(product.stock);
                      return `<li>
                        ${product.emoji ? `<span class="mini-emoji">${escapeHtml(product.emoji)}</span>` : ''}
                        <span class="mini-info"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.categoryName ?? 'Sin categoría')}</small></span>
                        <span class="stock-pill stock-${stock.tone}">${product.stock} u.</span>
                      </li>`;
                    })
                    .join('')}
                </ul>`
              : '<p class="muted">Todo el stock está en orden </p>'
          }
        </section>

        <section class="panel">
          <header class="panel-head">
            <h2>Más vendidos</h2>
            <span class="panel-note">últimos 7 días</span>
          </header>
          ${
            stats.topProducts.length
              ? `<ol class="rank-list">
                  ${stats.topProducts
                    .map(
                      (product, index) => `
                      <li>
                        <span class="rank-index">${index + 1}</span>
                        <span class="mini-info"><strong>${escapeHtml(product.name)}</strong><small>${money(product.amountCents)}</small></span>
                        <span class="rank-qty">${product.quantity} u.</span>
                      </li>`,
                    )
                    .join('')}
                </ol>`
              : '<p class="muted">Todavía no hay ventas registradas.</p>'
          }
        </section>
      </div>
    `;
  });
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
function productRow(product) {
  return `
    <tr>
      <td>
        <div class="cell-product">
          ${product.emoji ? `<span class="cell-emoji">${escapeHtml(product.emoji)}</span>` : ''}
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <small>${escapeHtml(product.description || 'Sin descripción')}</small>
          </div>
        </div>
      </td>
      <td><span class="badge badge-plain">${escapeHtml(product.categoryEmoji ?? '')} ${escapeHtml(product.categoryName ?? 'Sin categoría')}</span></td>
      <td class="num">${money(product.priceCents)}</td>
      <td class="num">
        <div class="stock-control">
          <button type="button" class="icon-btn icon-btn-sm" data-action="stock-delta" data-id="${product.id}" data-delta="-1" ${product.stock <= 0 ? 'disabled' : ''} aria-label="Restar una unidad">−</button>
          <span class="stock-number">${product.stock}</span>
          <button type="button" class="icon-btn icon-btn-sm" data-action="stock-delta" data-id="${product.id}" data-delta="1" aria-label="Sumar una unidad">+</button>
        </div>
      </td>
      <td>${product.active ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-slate">Inactivo</span>'}</td>
      <td class="actions-col">
        <button type="button" class="btn btn-ghost btn-sm" data-action="edit-product" data-id="${product.id}">Editar</button>
        <button type="button" class="btn btn-ghost btn-sm danger-text" data-action="delete-product" data-id="${product.id}">Eliminar</button>
      </td>
    </tr>
  `;
}

async function paintProductos(main, app) {
  await run(main, async () => {
    const [{ products }, { categories }] = await Promise.all([api.admin.getProducts(), api.admin.getCategories()]);
    cache.products = products;
    cache.categories = categories;

    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Catálogo</p>
          <h1>Productos y stock</h1>
          <p class="page-sub">${products.length} productos cargados. Los cambios se reflejan al instante en el catálogo.</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="new-product">+ Nuevo producto</button>
      </header>

      <div class="panel">
        <div class="panel-toolbar">
          <label class="search-field">
            <span aria-hidden="true"></span>
            <input id="admin-product-search" type="search" placeholder="Buscar producto..." value="${escapeHtml(filters.productsSearch)}" />
          </label>
          <span class="toolbar-note" id="product-visible-count"></span>
        </div>
        <div id="products-table-wrap"></div>
      </div>
    `;

    const wrap = main.querySelector('#products-table-wrap');
    const counter = main.querySelector('#product-visible-count');
    const search = main.querySelector('#admin-product-search');

    function paintRows() {
      const term = filters.productsSearch.trim().toLowerCase();
      const visible = products.filter(
        (product) =>
          !term ||
          product.name.toLowerCase().includes(term) ||
          (product.categoryName ?? '').toLowerCase().includes(term),
      );
      counter.textContent = `${visible.length} de ${products.length}`;
      wrap.innerHTML = visible.length
        ? `<div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th class="num">Precio</th>
                  <th class="num">Stock</th>
                  <th>Estado</th>
                  <th class="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>${visible.map(productRow).join('')}</tbody>
            </table>
          </div>`
        : emptyState({ icon: '', title: 'Sin resultados', text: 'Probá con otro nombre o creá un producto nuevo.' });
    }

    paintRows();
    search.addEventListener('input', () => {
      filters.productsSearch = search.value;
      paintRows();
    });
  });
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------
function adminOrderCard(order) {
  const actions = NEXT_STATUS[order.status] ?? [];
  const canCancel = ['pendiente', 'preparando', 'listo'].includes(order.status);

  return `
    <article class="admin-order">
      <div class="admin-order-main">
        <div class="admin-order-top">
          <span class="order-code">#${order.id}</span>
          ${statusBadge(order.status)}
          <span class="admin-order-date">${escapeHtml(formatDateTime(order.createdAt))}</span>
        </div>
        <p class="admin-order-user">
           <strong>${escapeHtml(order.userName ?? 'Alumno')}</strong>
          <span>${escapeHtml(order.userEmail ?? '')}</span>
          · ${escapeHtml(order.recreoName ?? '')} ${escapeHtml(order.recreoStartTime ?? '')}–${escapeHtml(order.recreoEndTime ?? '')}
        </p>
        <ul class="admin-order-items">
          ${order.items.map((item) => `<li><span>${item.quantity}×</span> ${escapeHtml(item.productName)} <em>${money(item.subtotalCents)}</em></li>`).join('')}
        </ul>
        ${order.notes ? `<p class="order-notes"> ${escapeHtml(order.notes)}</p>` : ''}
      </div>
      <div class="admin-order-side">
        <span class="admin-order-total">${money(order.totalCents)}</span>
        <div class="admin-order-actions">
          ${actions
            .map(
              (action) =>
                `<button type="button" class="btn ${action.className} btn-sm" data-action="admin-status" data-id="${order.id}" data-status="${action.status}">${escapeHtml(action.label)}</button>`,
            )
            .join('')}
          ${
            canCancel
              ? `<button type="button" class="btn btn-ghost btn-sm danger-text" data-action="admin-status" data-id="${order.id}" data-status="cancelado">Cancelar</button>`
              : ''
          }
          ${
            order.paymentMethod === 'cash' && order.paymentStatus !== 'approved'
              ? `<button type="button" class="btn btn-soft btn-sm" data-action="mark-paid" data-id="${order.id}">Marcar pagado</button>`
              : ''
          }
        </div>
      </div>
    </article>
  `;
}

async function paintPedidos(main, app) {
  await run(main, async () => {
    const { status, recreoId, date } = filters.orders;
    const params = {};
    if (status) params.status = status;
    if (recreoId) params.recreoId = recreoId;
    if (date && date !== 'all') params.date = date;

    const [{ orders }, { recreos }] = await Promise.all([api.admin.getOrders(params), api.admin.getRecreos()]);
    cache.orders = orders;
    cache.recreos = recreos;

    const dateLabel = date === 'all' ? 'en total' : `para el ${formatLongDate(date)}`;

    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Operación</p>
          <h1>Pedidos</h1>
          <p class="page-sub">${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'} ${escapeHtml(dateLabel)}</p>
        </div>
        <button type="button" class="btn btn-soft" data-action="refresh">↻ Actualizar</button>
      </header>

      <div class="panel">
        <div class="panel-toolbar filters">
          <label class="inline-field">
            <span>Fecha</span>
            <input type="date" id="filter-date" value="${date === 'all' ? '' : escapeHtml(date)}" ${date === 'all' ? 'disabled' : ''} />
          </label>
          <label class="inline-field">
            <span>Estado</span>
            <select id="filter-status">
              <option value="">Todos</option>
              ${Object.entries(STATUS_META)
                .map(
                  ([value, meta]) =>
                    `<option value="${value}" ${status === value ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <label class="inline-field">
            <span>Recreo</span>
            <select id="filter-recreo">
              <option value="">Todos</option>
              ${recreos
                .map(
                  (recreo) =>
                    `<option value="${recreo.id}" ${String(recreoId) === String(recreo.id) ? 'selected' : ''}>${escapeHtml(recreo.name)}</option>`,
                )
                .join('')}
            </select>
          </label>
          <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-date">
            ${date === 'all' ? 'Ver solo hoy' : 'Ver todos los días'}
          </button>
        </div>

        <div class="admin-orders">
          ${
            orders.length
              ? orders.map(adminOrderCard).join('')
              : emptyState({
                  icon: '',
                  title: 'No hay pedidos con esos filtros',
                  text: 'Probá cambiando la fecha o el estado.',
                })
          }
        </div>
      </div>
    `;
  });
}

// ---------------------------------------------------------------------------
// Recreos
// ---------------------------------------------------------------------------
async function paintRecreos(main, app) {
  await run(main, async () => {
    const { recreos } = await api.admin.getRecreos();
    cache.recreos = recreos;

    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Organización</p>
          <h1>Recreos</h1>
          <p class="page-sub">Definí los horarios en los que se pueden reservar pedidos.</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="new-recreo">+ Nuevo recreo</button>
      </header>

      ${
        recreos.length
          ? `<div class="card-grid">
              ${recreos
                .map(
                  (recreo) => `
                <article class="panel recreo-card ${recreo.active ? '' : 'is-inactive'}">
                  <div class="recreo-card-head">
                    <span class="recreo-clock"></span>
                    ${recreo.active ? '<span class="badge badge-green">Habilitado</span>' : '<span class="badge badge-slate">Deshabilitado</span>'}
                  </div>
                  <h2>${escapeHtml(recreo.name)}</h2>
                  <p class="recreo-hours">${escapeHtml(recreo.startTime)} – ${escapeHtml(recreo.endTime)}</p>
                  <div class="recreo-card-actions">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="edit-recreo" data-id="${recreo.id}">Editar</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-recreo" data-id="${recreo.id}">
                      ${recreo.active ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm danger-text" data-action="delete-recreo" data-id="${recreo.id}">Eliminar</button>
                  </div>
                </article>`,
                )
                .join('')}
            </div>`
          : emptyState({
              icon: '',
              title: 'Todavía no hay recreos',
              text: 'Creá al menos un recreo para que los alumnos puedan hacer pedidos.',
              action: '<button type="button" class="btn btn-primary" data-action="new-recreo">Crear recreo</button>',
            })
      }
    `;
  });
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
async function paintCategorias(main, app) {
  await run(main, async () => {
    const { categories } = await api.admin.getCategories();
    cache.categories = categories;

    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Catálogo</p>
          <h1>Categorías</h1>
          <p class="page-sub">Agrupá los productos para que sea más fácil encontrarlos.</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="new-category">+ Nueva categoría</button>
      </header>

      <div class="panel">
        ${
          categories.length
            ? `<ul class="category-list">
                ${categories
                  .map(
                    (category) => `
                    <li>
                      ${category.emoji ? `<span class="category-emoji">${escapeHtml(category.emoji)}</span>` : ''}
                      <span class="mini-info">
                        <strong>${escapeHtml(category.name)}</strong>
                        <small>${category.productCount ?? 0} productos activos</small>
                      </span>
                      <span class="category-actions">
                        <button type="button" class="btn btn-ghost btn-sm" data-action="edit-category" data-id="${category.id}">Editar</button>
                        <button type="button" class="btn btn-ghost btn-sm danger-text" data-action="delete-category" data-id="${category.id}">Eliminar</button>
                      </span>
                    </li>`,
                  )
                  .join('')}
              </ul>`
            : emptyState({ icon: '', title: 'Sin categorías', text: 'Creá la primera categoría del kiosco.' })
        }
      </div>
    `;
  });
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
async function paintUsuarios(main, app) {
  await run(main, async () => {
    const { users } = await api.admin.getUsers();

    main.innerHTML = `
      <header class="page-head">
        <div>
          <p class="eyebrow">Comunidad</p>
          <h1>Usuarios</h1>
          <p class="page-sub">${users.length} cuentas registradas en el kiosco.</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="new-user">+ Crear cuenta</button>
      </header>

      <div class="panel">
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Alta</th><th class="actions-col">Acciones</th></tr></thead>
            <tbody>
              ${users
                .map(
                  (user) => `
                  <tr>
                    <td><strong>${escapeHtml(user.name)}</strong></td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${user.role === 'admin' ? '<span class="badge badge-amber">Administración</span>' : '<span class="badge badge-plain">Alumno</span>'}</td>
                    <td>${escapeHtml(formatDate(user.createdAt))}</td>
                    <td class="actions-col">
                      ${
                        app.state.user && app.state.user.id === user.id
                          ? '<span class="page-sub">Tu cuenta</span>'
                          : `<button type="button" class="btn btn-ghost btn-sm danger-text" data-action="delete-user" data-id="${user.id}" data-name="${escapeHtml(user.name)}">Eliminar</button>`
                      }
                    </td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  });
}

// ---------------------------------------------------------------------------
// SQL (consultas en vivo sobre la base real del servidor)
// ---------------------------------------------------------------------------
async function paintSql(main) {
  main.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">Base de datos</p>
        <h1>Consultas SQL</h1>
        <p class="page-sub">Ejecuta consultas sobre la base real del servidor (en Railway, la del volume). Solo administradores.</p>
      </div>
      <div class="page-actions" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn btn-soft" data-sql-example="tables">Ver tablas</button>
        <button type="button" class="btn btn-soft" data-sql-example="orders">Últimos pedidos</button>
      </div>
    </header>

    <section class="panel">
      <div class="field">
        <label for="sql-input"><strong>Consulta SQL</strong></label>
        <textarea id="sql-input" rows="8" spellcheck="false" style="width:100%;font-family:monospace;" placeholder="Ej: SELECT id, code, status, payment_status, total_cents FROM orders ORDER BY id DESC LIMIT 20;"></textarea>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;">
        <button type="button" class="btn btn-primary" id="sql-run">Ejecutar consulta</button>
        <span class="page-sub">Usá consultas con cuidado: INSERT/UPDATE/DELETE modifican la base real.</span>
      </div>
      <div id="sql-result" style="margin-top:16px;"></div>
    </section>
  `;

  const input = main.querySelector('#sql-input');
  const result = main.querySelector('#sql-result');
  const runBtn = main.querySelector('#sql-run');

  const examples = {
    tables: "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name;",
    orders: "SELECT id, code, status, payment_status, payment_method, total_cents, service_date, created_at FROM orders ORDER BY created_at DESC LIMIT 30;",
  };

  main.querySelectorAll('[data-sql-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      input.value = examples[btn.dataset.sqlExample] || '';
      input.focus();
    });
  });

  function renderResult(payload) {
    if (!payload) {
      result.innerHTML = '';
      return;
    }
    if (payload.kind === 'run') {
      result.innerHTML = `<div class="panel"><p><strong>Consulta ejecutada.</strong></p><p>Filas afectadas: ${payload.changes ?? 0}${payload.lastInsertRowid != null ? ` · lastInsertRowid: ${payload.lastInsertRowid}` : ''}</p></div>`;
      return;
    }
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const cols = Array.isArray(payload.columns) ? payload.columns : (rows[0] ? Object.keys(rows[0]) : []);
    if (!rows.length) {
      result.innerHTML = `<div class="panel"><p><strong>0 filas.</strong> La consulta se ejecutó correctamente pero no devolvió resultados.</p></div>`;
      return;
    }
    const head = cols.map((c) => `<th>${escapeHtml(String(c))}</th>`).join('');
    const body = rows.map((row) => `<tr>${cols.map((c) => `<td>${escapeHtml(row[c] === null || row[c] === undefined ? '' : String(row[c]))}</td>`).join('')}</tr>`).join('');
    result.innerHTML = `
      <div class="panel">
        <p><strong>${rows.length}</strong> fila(s)</p>
        <div style="overflow:auto; max-height:60vh;">
          <table class="data-table" style="min-width:100%;">
            <thead><tr>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
  }

  async function run() {
    const sql = input.value.trim();
    if (!sql) {
      toast('Ingresá una consulta SQL.', 'error');
      return;
    }
    setButtonLoading(runBtn, true, 'Ejecutando...');
    try {
      const payload = await api.admin.runSql(sql);
      renderResult(payload);
    } catch (error) {
      result.innerHTML = `<div class="panel"><p style="color:#b91c1c;"><strong>Error SQL:</strong> ${escapeHtml(error?.message || 'No se pudo ejecutar la consulta.')}</p></div>`;
    } finally {
      setButtonLoading(runBtn, false);
    }
  }

  runBtn.addEventListener('click', run);
  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  });
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------
async function handleAdminClick(event, { app, main, tab }) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id ? Number(button.dataset.id) : null;
  const repaint = () => paint(tab, main, app);

  switch (action) {
    case 'refresh':
      await repaint();
      return;

    case 'new-product':
      await openProductModal(app, null, repaint);
      return;

    case 'new-user':
      await openUserModal(app, repaint);
      return;

    case 'delete-user': {
      const name = button.dataset.name || 'esta cuenta';
      const confirmed = await confirmAction({
        title: 'Eliminar cuenta',
        message: `¿Eliminar la cuenta de "${name}"? Se borran también sus pedidos y no se puede deshacer.`,
        confirmText: 'Eliminar cuenta',
        danger: true,
      });
      if (!confirmed) return;
      const result = await api.admin.deleteUser(id);
      toast(`Cuenta eliminada: ${result.email}. Se borraron ${result.ordersDeleted} pedido(s).`, 'success');
      await repaint();
      return;
    }

    case 'edit-product': {
      let product = cache.products.find((item) => item.id === id);
      if (!product) {
        const { products } = await api.admin.getProducts();
        cache.products = products;
        product = products.find((item) => item.id === id);
      }
      await openProductModal(app, product, repaint);
      return;
    }

    case 'delete-product': {
      const product = cache.products.find((item) => item.id === id);
      const confirmed = await confirmAction({
        title: 'Eliminar producto',
        message: `¿Seguro que querés eliminar "${product?.name ?? 'este producto'}"? Si tiene pedidos asociados se archivará en lugar de borrarse.`,
        confirmText: 'Eliminar',
        danger: true,
      });
      if (!confirmed) return;
      const result = await api.admin.deleteProduct(id);
      toast(result.archived ? 'El producto se archivó porque tiene pedidos asociados.' : 'Producto eliminado.');
      await app.loadCatalog();
      await repaint();
      return;
    }

    case 'stock-delta': {
      const delta = Number(button.dataset.delta);
      const { product } = await api.admin.updateStock(id, { delta });
      toast(`Stock de ${product.name}: ${product.stock} unidades.`);
      await app.loadCatalog();
      await repaint();
      return;
    }

    case 'new-category':
      await openCategoryModal(app, null, repaint);
      return;

    case 'edit-category': {
      let category = cache.categories.find((item) => item.id === id);
      if (!category) {
        const { categories } = await api.admin.getCategories();
        cache.categories = categories;
        category = categories.find((item) => item.id === id);
      }
      await openCategoryModal(app, category, repaint);
      return;
    }

    case 'delete-category': {
      const category = cache.categories.find((item) => item.id === id);
      const confirmed = await confirmAction({
        title: 'Eliminar categoría',
        message: `¿Eliminar la categoría "${category?.name ?? ''}"? Los productos quedarán sin categoría.`,
        confirmText: 'Eliminar',
        danger: true,
      });
      if (!confirmed) return;
      await api.admin.deleteCategory(id);
      toast('Categoría eliminada.');
      await app.loadCatalog();
      await repaint();
      return;
    }

    case 'new-recreo':
      await openRecreoModal(app, null, repaint);
      return;

    case 'edit-recreo': {
      let recreo = cache.recreos.find((item) => item.id === id);
      if (!recreo) {
        const { recreos } = await api.admin.getRecreos();
        cache.recreos = recreos;
        recreo = recreos.find((item) => item.id === id);
      }
      await openRecreoModal(app, recreo, repaint);
      return;
    }

    case 'toggle-recreo': {
      const recreo = cache.recreos.find((item) => item.id === id);
      if (!recreo) return;
      await api.admin.updateRecreo(id, { ...recreo, active: !recreo.active });
      toast(recreo.active ? 'Recreo deshabilitado.' : 'Recreo habilitado.');
      await app.loadCatalog();
      await repaint();
      return;
    }

    case 'delete-recreo': {
      const recreo = cache.recreos.find((item) => item.id === id);
      const confirmed = await confirmAction({
        title: 'Eliminar recreo',
        message: `¿Eliminar el recreo "${recreo?.name ?? ''}"? Si ya tiene pedidos, se deshabilitará en lugar de borrarse.`,
        confirmText: 'Eliminar',
        danger: true,
      });
      if (!confirmed) return;
      const result = await api.admin.deleteRecreo(id);
      toast(result.archived ? 'El recreo se deshabilitó porque tiene pedidos asociados.' : 'Recreo eliminado.');
      await app.loadCatalog();
      await repaint();
      return;
    }

    case 'mark-paid': {
      await api.admin.updatePaymentStatus(id, 'approved');
      toast('Pago marcado como recibido.');
      await app.loadCatalog();
      await repaint();
      return;
    }

    case 'admin-status': {
      const status = button.dataset.status;
      if (status === 'cancelado') {
        const confirmed = await confirmAction({
          title: 'Cancelar pedido',
          message: 'El pedido se cancelará y el stock volverá al kiosco. ¿Continuar?',
          confirmText: 'Cancelar pedido',
          cancelText: 'Volver',
          danger: true,
        });
        if (!confirmed) return;
      }
      await api.admin.updateOrderStatus(id, status);
      toast(`Pedido actualizado: ${STATUS_META[status]?.label ?? status}.`);
      await app.loadCatalog();
      await repaint();
      return;
    }

    case 'toggle-date':
      filters.orders.date = filters.orders.date === 'all' ? todayISO() : 'all';
      await repaint();
      return;

    default:
      return;
  }
}

async function handleAdminChange(event, { app, main, tab }) {
  const target = event.target;
  if (target.id === 'filter-status') {
    filters.orders.status = target.value;
    await paint(tab, main, app);
  } else if (target.id === 'filter-recreo') {
    filters.orders.recreoId = target.value;
    await paint(tab, main, app);
  } else if (target.id === 'filter-date') {
    filters.orders.date = target.value || todayISO();
    await paint(tab, main, app);
  }
}

// ---------------------------------------------------------------------------
// Modales
// ---------------------------------------------------------------------------
function showFormError(modal, form, error) {
  const box = form.querySelector('[data-form-error]');
  const details = error.details ?? {};
  const firstMessage = Object.values(details)[0] || error.message;
  if (box) {
    box.textContent = firstMessage;
    box.hidden = false;
  }
  for (const field of Object.keys(details)) {
    const input = form.querySelector(`[name="${field}"]`);
    if (input) input.classList.add('is-invalid');
  }
}

function clearFormErrors(form) {
  form.querySelectorAll('.is-invalid').forEach((element) => element.classList.remove('is-invalid'));
  const box = form.querySelector('[data-form-error]');
  if (box) {
    box.hidden = true;
    box.textContent = '';
  }
}

/** Modal para crear cuentas (admin o cliente) con cualquier correo. */
async function openUserModal(app, onSaved) {
  const modal = openModal({
    title: 'Crear cuenta',
    subtitle: 'Acepta cualquier correo, sin restriccion de dominio. La contrasena es obligatoria.',
    content: `
      <form id="user-form" class="form" novalidate>
        <div class="field">
          <label for="u-name">Nombre y apellido</label>
          <input id="u-name" name="name" maxlength="60" required placeholder="Ej: Ana Perez" />
        </div>

        <div class="field">
          <label for="u-email">Correo electronico</label>
          <input id="u-email" name="email" type="email" maxlength="160" required placeholder="cualquier@correo.com" />
        </div>

        <div class="field">
          <label for="u-password">Contrasena</label>
          <input id="u-password" name="password" type="text" minlength="8" maxlength="128" required placeholder="Minimo 8 caracteres" autocomplete="new-password" />
          <span class="label-hint">Compartila con la persona para que ingrese con "Soy administracion: ingresar con correo".</span>
        </div>

        <div class="field">
          <label for="u-role">Rol</label>
          <select id="u-role" name="role">
            <option value="admin" selected>Administracion (ve todo el panel)</option>
            <option value="cliente">Alumno (solo catalogo y pedidos)</option>
          </select>
        </div>

        <p class="form-error" data-form-error hidden></p>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" form="user-form" class="btn btn-primary">Crear cuenta</button>
    `,
  });

  const form = modal.root.querySelector('#user-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const role = form.role.value;
    const errorBox = form.querySelector('[data-form-error]');

    if (name.length < 2) {
      form.name.classList.add('is-invalid');
      errorBox.textContent = 'Ingresá el nombre y apellido.';
      errorBox.hidden = false;
      return;
    }
    if (!email.includes('@') || email.length < 5) {
      form.email.classList.add('is-invalid');
      errorBox.textContent = 'Ingresá un correo válido.';
      errorBox.hidden = false;
      return;
    }
    if (password.length < 8) {
      form.password.classList.add('is-invalid');
      errorBox.textContent = 'La contraseña necesita al menos 8 caracteres.';
      errorBox.hidden = false;
      return;
    }

    const submitButton = modal.root.querySelector('[type="submit"]');
    setButtonLoading(submitButton, true, 'Creando...');
    try {
      const { user } = await api.admin.createUser({ name, email, password, role });
      toast(`Cuenta creada: ${user.email} (${user.role === 'admin' ? 'administración' : 'alumno'}).`, 'success');
      modal.close();
      await onSaved();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      toast(error.message, 'error');
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

async function openProductModal(app, product, onSaved) {
  if (!cache.categories.length) {
    const { categories } = await api.admin.getCategories();
    cache.categories = categories;
  }
  const categories = cache.categories;
  const isEdit = Boolean(product);

  const modal = openModal({
    title: isEdit ? 'Editar producto' : 'Nuevo producto',
    subtitle: isEdit ? 'Actualizá precio, stock, categoría o disponibilidad.' : 'Se va a mostrar en el catálogo del kiosco.',
    content: `
      <form id="product-form" class="form" novalidate>
        <div class="form-row form-row-emoji">
          <div class="field">
            <label for="p-name">Nombre</label>
            <input id="p-name" name="name" maxlength="80" required value="${escapeHtml(product?.name ?? '')}" placeholder="Ej: Alfajor triple" />
          </div>
          <div class="field">
            <label for="p-emoji">Emoji</label>
            <input id="p-emoji" name="emoji" maxlength="8" value="${escapeHtml(product?.emoji ?? '')}" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="p-category">Categoría</label>
            <select id="p-category" name="categoryId">
              <option value="">Sin categoría</option>
              ${categories
                .map(
                  (category) =>
                    `<option value="${category.id}" ${product?.categoryId === category.id ? 'selected' : ''}>${escapeHtml(category.emoji)} ${escapeHtml(category.name)}</option>`,
                )
                .join('')}
            </select>
          </div>
          <div class="field">
            <label for="p-price">Precio ($)</label>
            <input id="p-price" name="price" type="number" min="0" step="0.01" required value="${product ? (product.priceCents / 100).toFixed(2) : ''}" placeholder="1500" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="p-stock">Stock</label>
            <input id="p-stock" name="stock" type="number" min="0" step="1" required value="${product?.stock ?? 0}" />
          </div>
          <div class="field field-check">
            <label class="checkbox">
              <input type="checkbox" name="active" ${product?.active === false ? '' : 'checked'} />
              <span>Producto activo</span>
            </label>
          </div>
        </div>

        <div class="field">
          <label for="p-desc">Descripción <span class="label-hint">(opcional)</span></label>
          <textarea id="p-desc" name="description" rows="2" maxlength="300">${escapeHtml(product?.description ?? '')}</textarea>
        </div>

        <p class="form-error" data-form-error hidden></p>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" form="product-form" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear producto'}</button>
    `,
  });

  const form = modal.root.querySelector('#product-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);

    const submitButton = modal.root.querySelector('[type="submit"]');
    const priceNumber = Number(form.price.value);
    const stockNumber = Number(form.stock.value);

    if (!form.name.value.trim()) {
      showFormError(modal, form, { message: 'El nombre es obligatorio.' });
      return;
    }
    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      showFormError(modal, form, { message: 'Ingresá un precio válido.' });
      return;
    }
    if (!Number.isInteger(stockNumber) || stockNumber < 0) {
      showFormError(modal, form, { message: 'El stock debe ser un número entero mayor o igual a 0.' });
      return;
    }

    const payload = {
      name: form.name.value.trim(),
      emoji: form.emoji.value.trim() || '',
      categoryId: form.categoryId.value ? Number(form.categoryId.value) : null,
      priceCents: Math.round(priceNumber * 100),
      stock: stockNumber,
      description: form.description.value.trim(),
      active: form.active.checked,
    };

    setButtonLoading(submitButton, true);
    try {
      if (isEdit) {
        await api.admin.updateProduct(product.id, payload);
        toast('Producto actualizado.');
      } else {
        await api.admin.createProduct(payload);
        toast('Producto creado.');
      }
      modal.close();
      await app.loadCatalog();
      await onSaved();
    } catch (error) {
      showFormError(modal, form, error);
      toast(error.message, 'error');
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

async function openCategoryModal(app, category, onSaved) {
  const isEdit = Boolean(category);
  const modal = openModal({
    title: isEdit ? 'Editar categoría' : 'Nueva categoría',
    content: `
      <form id="category-form" class="form" novalidate>
        <div class="form-row form-row-emoji">
          <div class="field">
            <label for="c-name">Nombre</label>
            <input id="c-name" name="name" maxlength="40" required value="${escapeHtml(category?.name ?? '')}" placeholder="Ej: Golosinas" />
          </div>
          <div class="field">
            <label for="c-emoji">Emoji</label>
            <input id="c-emoji" name="emoji" maxlength="8" value="${escapeHtml(category?.emoji ?? '')}" />
          </div>
        </div>
        <div class="field">
          <label for="c-order">Orden</label>
          <input id="c-order" name="sortOrder" type="number" min="0" step="1" value="${category?.sortOrder ?? 0}" />
        </div>
        <p class="form-error" data-form-error hidden></p>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" form="category-form" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear categoría'}</button>
    `,
  });

  const form = modal.root.querySelector('#category-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    const submitButton = modal.root.querySelector('[type="submit"]');
    const payload = {
      name: form.name.value.trim(),
      emoji: form.emoji.value.trim() || '',
      sortOrder: Number(form.sortOrder.value) || 0,
    };

    setButtonLoading(submitButton, true);
    try {
      if (isEdit) {
        await api.admin.updateCategory(category.id, payload);
        toast('Categoría actualizada.');
      } else {
        await api.admin.createCategory(payload);
        toast('Categoría creada.');
      }
      modal.close();
      await app.loadCatalog();
      await onSaved();
    } catch (error) {
      showFormError(modal, form, error);
      toast(error.message, 'error');
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

async function openRecreoModal(app, recreo, onSaved) {
  const isEdit = Boolean(recreo);
  const modal = openModal({
    title: isEdit ? 'Editar recreo' : 'Nuevo recreo',
    subtitle: 'Los alumnos solo pueden reservar en recreos habilitados.',
    content: `
      <form id="recreo-form" class="form" novalidate>
        <div class="field">
          <label for="r-name">Nombre</label>
          <input id="r-name" name="name" maxlength="60" required value="${escapeHtml(recreo?.name ?? '')}" placeholder="Ej: Primer recreo" />
        </div>
        <div class="form-row">
          <div class="field">
            <label for="r-start">Desde</label>
            <input id="r-start" name="startTime" type="time" required value="${escapeHtml(recreo?.startTime ?? '09:30')}" />
          </div>
          <div class="field">
            <label for="r-end">Hasta</label>
            <input id="r-end" name="endTime" type="time" required value="${escapeHtml(recreo?.endTime ?? '09:45')}" />
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="r-order">Orden</label>
            <input id="r-order" name="sortOrder" type="number" min="0" step="1" value="${recreo?.sortOrder ?? 0}" />
          </div>
          <div class="field field-check">
            <label class="checkbox">
              <input type="checkbox" name="active" ${recreo?.active === false ? '' : 'checked'} />
              <span>Recreo habilitado</span>
            </label>
          </div>
        </div>
        <p class="form-error" data-form-error hidden></p>
      </form>
    `,
    footer: `
      <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
      <button type="submit" form="recreo-form" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear recreo'}</button>
    `,
  });

  const form = modal.root.querySelector('#recreo-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    const submitButton = modal.root.querySelector('[type="submit"]');
    const payload = {
      name: form.name.value.trim(),
      startTime: form.startTime.value,
      endTime: form.endTime.value,
      sortOrder: Number(form.sortOrder.value) || 0,
      active: form.active.checked,
    };

    setButtonLoading(submitButton, true);
    try {
      if (isEdit) {
        await api.admin.updateRecreo(recreo.id, payload);
        toast('Recreo actualizado.');
      } else {
        await api.admin.createRecreo(payload);
        toast('Recreo creado.');
      }
      modal.close();
      await app.loadCatalog();
      await onSaved();
    } catch (error) {
      showFormError(modal, form, error);
      toast(error.message, 'error');
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}
