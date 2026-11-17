import { api } from './api.js';
import { confirmAction, emptyState, openModal, toast } from './ui.js';
import { escapeHtml, formatLongDate, initials, money } from './utils.js';
import { renderAuth } from './views/auth.js';
import { renderCatalog, syncCatalogCards } from './views/catalog.js';
import { renderOrders } from './views/orders.js';
import { renderAdmin } from './views/admin.js';

const CART_KEY = 'kiosco.cart.v1';
const RECREO_KEY = 'kiosco.recreo.v1';
const NOTES_KEY = 'kiosco.notes.v1';

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeCart(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && Number.isInteger(item.productId) && Number.isInteger(item.quantity) && item.quantity > 0)
    .map((item) => ({ productId: item.productId, quantity: item.quantity }));
}

const app = {
  state: {
    booting: true,
    user: null,
    route: { name: 'catalogo', sub: null },
    products: [],
    categories: [],
    recreos: [],
    catalogLoaded: false,
    catalogError: null,
    catalogLoading: false,
    catalogFilters: { search: '', categoryId: null },
    cart: normalizeCart(readStorage(CART_KEY, [])),
    paymentMethod: 'mercadopago',
    recreoId: Number(localStorage.getItem(RECREO_KEY)) || null,
    notes: localStorage.getItem(NOTES_KEY) ?? '',
    cartOpen: false,
    orders: [],
    ordersLoaded: false,
    checkingOut: false,
  },

  pollTimer: null,

  // -------------------------------------------------------------------------
  // Arranque y ruteo
  // -------------------------------------------------------------------------
  async init() {
    this.state.route = this.parseRoute();
    this.bindGlobalEvents();
    this.render();

    // Mensajes que vuelven del login con Google.
    const googleParam = new URLSearchParams(location.search).get('google');
    if (googleParam) {
      const domain = new URLSearchParams(location.search).get('dominio');
      const messages = {
        dominio: domain
          ? `Solo pueden ingresar cuentas @${domain}. Usá tu cuenta del colegio.`
          : 'Solo pueden ingresar cuentas del dominio del colegio.',
        denegado: 'Cancelaste el ingreso con Google.',
        error: 'No se pudo completar el ingreso con Google. Intentá de nuevo.',
      };
      if (messages[googleParam]) toast(messages[googleParam], 'error', 7000);
      history.replaceState(null, '', location.pathname + location.hash);
    }

    try {
      const { user } = await api.me();
      this.state.user = user;
      if (user) {
        // Re-parsear con el rol conocido: sin esto, recargar en #/admin/... cae al catalogo.
        this.state.route = this.parseRoute();
        await Promise.allSettled([this.loadCatalog(), this.loadOrders()]);
      }
    } catch (error) {
      toast(error.message, 'error', 6000);
    }

    this.state.booting = false;
    document.body.classList.toggle('is-auth', !this.state.user);
    this.render();
  },

  parseRoute() {
    const raw = String(location.hash || '').replace(/^#\/?/, '');
    const [name, sub] = raw.split('/');
    const valid = ['catalogo', 'pedidos', 'admin'];
    let routeName = valid.includes(name) ? name : 'catalogo';
    if (routeName === 'admin' && this.state.user?.role !== 'admin') routeName = 'catalogo';
    return {
      name: routeName,
      sub: routeName === 'admin' ? sub || 'resumen' : null,
    };
  },

  navigate(path) {
    const target = `#/${path}`;
    if (location.hash === target) {
      this.render();
      return;
    }
    location.hash = target;
  },

  handleHashChange() {
    const next = this.parseRoute();
    if (next.name === this.state.route.name && next.sub === this.state.route.sub) return;
    this.state.route = next;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  clearPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  poll(fn, milliseconds) {
    this.clearPoll();
    this.pollTimer = setInterval(() => {
      if (document.hidden) return;
      Promise.resolve(fn()).catch(() => {});
    }, milliseconds);
  },

  // -------------------------------------------------------------------------
  // Datos
  // -------------------------------------------------------------------------
  async loadCatalog() {
    const [productsResponse, categoriesResponse, recreosResponse] = await Promise.all([
      api.getProducts(),
      api.getCategories(),
      api.getRecreos(),
    ]);
    this.state.products = productsResponse.products;
    this.state.categories = categoriesResponse.categories;
    this.state.recreos = recreosResponse.recreos;

    if (!this.state.recreos.some((recreo) => recreo.id === Number(this.state.recreoId))) {
      this.state.recreoId = this.state.recreos[0]?.id ?? null;
      this.persistRecreo();
    }

    this.state.catalogLoaded = true;
    this.state.catalogError = null;

    const productIds = new Set(this.state.products.map((product) => product.id));
    const nextCart = this.state.cart.filter((item) => productIds.has(item.productId));
    if (nextCart.length !== this.state.cart.length) {
      this.state.cart = nextCart;
      this.persistCart();
    }
  },

  async loadOrders() {
    const { orders } = await api.getMyOrders();
    this.state.orders = orders;
    this.state.ordersLoaded = true;
  },

  async onAuthenticated(user) {
    this.state.user = user;
    this.state.catalogLoaded = false;
    this.state.catalogError = null;
    this.state.orders = [];
    document.body.classList.remove('is-auth');
    location.hash = user.role === 'admin' ? '#/admin/resumen' : '#/catalogo';
    this.state.route = this.parseRoute();
    await Promise.allSettled([this.loadCatalog(), this.loadOrders()]);
    this.render();
  },

  async openChangePasswordModal() {
    const modal = openModal({
      title: 'Cambiar contraseña',
      subtitle: 'Ingresá tu contraseña actual y la nueva.',
      content: `
        <form id="password-form" class="form" novalidate>
          <div class="field">
            <label for="cp-current">Contraseña actual</label>
            <input id="cp-current" name="currentPassword" type="password" required maxlength="128" />
          </div>
          <div class="field">
            <label for="cp-new">Nueva contraseña</label>
            <input id="cp-new" name="newPassword" type="password" required minlength="8" maxlength="128" />
          </div>
          <div class="field">
            <label for="cp-confirm">Repetir nueva contraseña</label>
            <input id="cp-confirm" name="confirmPassword" type="password" required minlength="8" maxlength="128" />
          </div>
          <p class="form-error" data-form-error hidden></p>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
        <button type="submit" form="password-form" class="btn btn-primary">Cambiar contraseña</button>
      `,
    });

    const form = modal.root.querySelector('#password-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const box = form.querySelector('[data-form-error]');
      box.hidden = true;
      box.textContent = '';

      const currentPassword = form.currentPassword.value;
      const newPassword = form.newPassword.value;
      const confirmPassword = form.confirmPassword.value;

      if (newPassword !== confirmPassword) {
        box.textContent = 'Las contraseñas nuevas no coinciden.';
        box.hidden = false;
        return;
      }
      if (newPassword.length < 8) {
        box.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.';
        box.hidden = false;
        return;
      }

      const submitButton = modal.root.querySelector('[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Guardando...';
      try {
        await api.changePassword({ currentPassword, newPassword });
        modal.close();
        toast('Contraseña actualizada correctamente.');
      } catch (error) {
        box.textContent = error.message || 'No se pudo cambiar la contraseña.';
        box.hidden = false;
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Cambiar contraseña';
      }
    });
  },

  async logout() {
    try {
      await api.logout();
    } catch {
      // aunque falle el servidor, cerramos la sesion local
    }
    this.state.user = null;
    this.state.cart = [];
    this.state.notes = '';
    this.state.orders = [];
    this.state.catalogLoaded = false;
    this.state.cartOpen = false;
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(NOTES_KEY);
    document.body.classList.remove('is-auth', 'drawer-open');
    location.hash = '#/catalogo';
    this.state.route = this.parseRoute();
    this.render();
    toast('Cerraste sesión. ¡Hasta la próxima!');
  },

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  render() {
    this.clearPoll();
    this.renderHeader();

    const view = document.getElementById('view');
    const { user, route, booting } = this.state;

    if (booting) return;

    if (!user) {
      document.body.classList.add('is-auth');
      this.renderCart();
      view.innerHTML = '';
      renderAuth(this, view);
      return;
    }

    document.body.classList.remove('is-auth');

    if (route.name === 'admin' && user.role === 'admin') {
      view.innerHTML = '';
      renderAdmin(this, view, route.sub).catch((error) => toast(error.message, 'error'));
    } else if (route.name === 'pedidos') {
      view.innerHTML = '';
      renderOrders(this, view).catch((error) => toast(error.message, 'error'));
    } else {
      if (!this.state.catalogLoaded) {
        this.renderCatalogPlaceholder(view);
      } else {
        view.innerHTML = '';
        renderCatalog(this, view);
      }
    }

    this.renderCart();
    this.syncCartIndicators();
  },

  renderCatalogPlaceholder(view) {
    if (this.state.catalogError) {
      view.innerHTML = `
        <div class="error-block">
          <span class="empty-icon"></span>
          <h3>No pudimos cargar el catálogo</h3>
          <p>${escapeHtml(this.state.catalogError)}</p>
          <button type="button" class="btn btn-primary" data-action="reload-catalog">Reintentar</button>
        </div>
      `;
      return;
    }

    view.innerHTML = `<div class="loading-block"><span class="spinner"></span><p>Cargando catálogo...</p></div>`;

    if (!this.state.catalogLoading) {
      this.state.catalogLoading = true;
      this.loadCatalog()
        .then(() => {
          this.state.catalogError = null;
        })
        .catch((error) => {
          this.state.catalogError = error.message;
        })
        .finally(() => {
          this.state.catalogLoading = false;
          this.render();
        });
    }
  },

  renderHeader() {
    const topbar = document.getElementById('topbar');
    const { user, route } = this.state;

    if (!user) {
      topbar.hidden = true;
      topbar.innerHTML = '';
      return;
    }

    topbar.hidden = false;
    const pending = this.state.orders.filter((order) =>
      ['pendiente', 'preparando', 'listo'].includes(order.status),
    ).length;

    topbar.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="#/catalogo">
          <span class="brand-mark"><img src="./favicon.svg" alt="Kiosco del Recreo" /></span>
          <span class="brand-text">
            <strong>Kiosco del Recreo</strong>
            <small>Pedidos y stock</small>
          </span>
        </a>

        <nav class="main-nav" aria-label="Navegación principal">
          <a href="#/catalogo" class="nav-link ${route.name === 'catalogo' ? 'is-active' : ''}">Catálogo</a>
          <a href="#/pedidos" class="nav-link ${route.name === 'pedidos' ? 'is-active' : ''}">
            Mis pedidos
            ${pending > 0 ? `<span class="nav-badge">${pending}</span>` : ''}
          </a>
          ${
            user.role === 'admin'
              ? `<a href="#/admin/resumen" class="nav-link ${route.name === 'admin' ? 'is-active' : ''}">Administración</a>`
              : ''
          }
        </nav>

        <div class="topbar-actions">
          ${
            route.name === 'admin'
              ? ''
              : `<button type="button" class="cart-btn" data-action="open-cart" aria-label="Abrir mi pedido">
                   <span aria-hidden="true"></span>
                   <span class="cart-label">Mi pedido</span>
                   <span class="cart-count" data-cart-count>${this.cartCount()}</span>
                 </button>`
          }
          <div class="user-chip" title="${escapeHtml(user.email)}">
            <span class="avatar">${escapeHtml(initials(user.name))}</span>
            <span class="user-meta">
              <strong>${escapeHtml(user.name)}</strong>
              <small>${user.role === 'admin' ? 'Administración' : 'Alumno'}</small>
            </span>
          </div>
          <button type="button" class="icon-btn" data-action="change-password" title="Cambiar contraseña" aria-label="Cambiar contraseña">🔑</button>
          <button type="button" class="icon-btn logout-btn" data-action="logout" title="Cerrar sesión" aria-label="Cerrar sesión">🚪</button>
        </div>
      </div>
    `;
  },

  // -------------------------------------------------------------------------
  // Carrito
  // -------------------------------------------------------------------------
  cartCount() {
    return this.state.cart.reduce((total, item) => total + item.quantity, 0);
  },

  cartQuantity(productId) {
    return this.state.cart.find((item) => item.productId === productId)?.quantity ?? 0;
  },

  cartLines() {
    const productsById = new Map(this.state.products.map((product) => [product.id, product]));
    return this.state.cart
      .map((item) => ({ ...item, product: productsById.get(item.productId) }))
      .filter((line) => Boolean(line.product));
  },

  cartTotalCents() {
    return this.cartLines().reduce((total, line) => total + line.product.priceCents * line.quantity, 0);
  },

  persistCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(this.state.cart));
  },

  persistRecreo() {
    localStorage.setItem(RECREO_KEY, String(this.state.recreoId ?? ''));
  },

  addToCart(productId) {
    const product = this.state.products.find((item) => item.id === productId);
    if (!product) return;
    if (product.stock <= 0) {
      toast('Ese producto no tiene stock.', 'warning');
      return;
    }

    const current = this.cartQuantity(productId);
    if (current + 1 > product.stock) {
      toast(`Solo quedan ${product.stock} unidades de ${product.name}.`, 'warning');
      return;
    }

    const existing = this.state.cart.find((item) => item.productId === productId);
    if (existing) existing.quantity += 1;
    else this.state.cart.push({ productId, quantity: 1 });

    this.persistCart();
    this.renderCart();
    this.syncCartIndicators();
    toast(`${product.name} agregado`, 'success', 1600);
  },

  setCartQuantity(productId, quantity) {
    const product = this.state.products.find((item) => item.id === productId);
    const max = product?.stock ?? 0;
    const next = Math.max(0, Math.min(quantity, max));

    if (next === 0) {
      this.state.cart = this.state.cart.filter((item) => item.productId !== productId);
    } else {
      const existing = this.state.cart.find((item) => item.productId === productId);
      if (existing) existing.quantity = next;
      else this.state.cart.push({ productId, quantity: next });
    }

    this.persistCart();
    this.renderCart();
    this.syncCartIndicators();
  },

  removeFromCart(productId) {
    this.state.cart = this.state.cart.filter((item) => item.productId !== productId);
    this.persistCart();
    this.renderCart();
    this.syncCartIndicators();
  },

  openCart() {
    this.state.cartOpen = true;
    document.body.classList.add('drawer-open');
    this.renderCart();
  },

  closeCart() {
    this.state.cartOpen = false;
    document.body.classList.remove('drawer-open');
    this.renderCart();
  },

  syncCartIndicators() {
    document.querySelectorAll('[data-cart-count]').forEach((element) => {
      element.textContent = this.cartCount();
    });
    const cartButton = document.querySelector('.cart-btn');
    if (cartButton) cartButton.classList.toggle('has-items', this.cartCount() > 0);
    syncCatalogCards(this);
  },

  renderCart() {
    const root = document.getElementById('drawer-root');
    if (!root) return;
    if (!this.state.user) {
      root.innerHTML = '';
      return;
    }

    const lines = this.cartLines();
    const total = this.cartTotalCents();
    const recreo = this.state.recreos.find((item) => item.id === Number(this.state.recreoId));
    const open = this.state.cartOpen;

    const itemsHtml = lines.length
      ? lines
          .map((line) => {
            const overStock = line.quantity > line.product.stock;
            return `
              <div class="cart-line ${overStock ? 'is-warning' : ''}">
                ${line.product.emoji ? `<span class="cart-line-emoji" aria-hidden="true">${escapeHtml(line.product.emoji)}</span>` : ''}
                <div class="cart-line-info">
                  <strong>${escapeHtml(line.product.name)}</strong>
                  <small>${money(line.product.priceCents)} c/u${overStock ? ' · stock insuficiente' : ''}</small>
                </div>
                <div class="qty-stepper">
                  <button type="button" class="qty-btn" data-action="cart-dec" data-id="${line.productId}" aria-label="Quitar una unidad">−</button>
                  <span class="qty-value">${line.quantity}</span>
                  <button type="button" class="qty-btn" data-action="cart-inc" data-id="${line.productId}" aria-label="Agregar una unidad" ${line.quantity >= line.product.stock ? 'disabled' : ''}>+</button>
                </div>
                <span class="cart-line-total">${money(line.product.priceCents * line.quantity)}</span>
                <button type="button" class="icon-btn icon-btn-sm cart-remove" data-action="cart-remove" data-id="${line.productId}" aria-label="Quitar ${escapeHtml(line.product.name)}"></button>
              </div>
            `;
          })
          .join('')
      : emptyState({
          icon: '',
          title: 'Tu carrito está vacío',
          text: 'Sumá productos desde el catálogo.',
          action: '<button type="button" class="btn btn-primary btn-sm" data-action="close-cart">Ver catálogo</button>',
        });

    root.innerHTML = `
      <div class="drawer-backdrop ${open ? 'is-open' : ''}" data-action="close-cart"></div>
      <aside class="cart-drawer ${open ? 'is-open' : ''}" aria-hidden="${open ? 'false' : 'true'}" aria-label="Mi pedido">
        <header class="cart-head">
          <div>
            <p class="eyebrow">Tu pedido</p>
            <h2>Carrito</h2>
          </div>
          <button type="button" class="icon-btn" data-action="close-cart" aria-label="Cerrar carrito"></button>
        </header>

        <div class="cart-body">
          <div class="cart-recreo">
            <label for="cart-recreo">Recreo para retirar</label>
            <select id="cart-recreo">
              ${
                this.state.recreos.length
                  ? this.state.recreos
                      .map(
                        (item) =>
                          `<option value="${item.id}" ${item.id === Number(this.state.recreoId) ? 'selected' : ''}>${escapeHtml(item.name)} · ${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</option>`,
                      )
                      .join('')
                  : '<option value="">No hay recreos disponibles</option>'
              }
            </select>
            <p class="cart-hint">${
              recreo
                ? `Retirás en ${escapeHtml(recreo.name)} (${escapeHtml(recreo.startTime)}–${escapeHtml(recreo.endTime)}).`
                : 'Elegí un recreo para poder confirmar el pedido.'
            }</p>
          </div>

          <div class="cart-payment">
            <label for="cart-payment-method">Forma de pago</label>
            <select id="cart-payment-method">
              <option value="mercadopago" ${this.state.paymentMethod === 'mercadopago' ? 'selected' : ''}>Mercado Pago (tarjeta/online)</option>
              <option value="cash" ${this.state.paymentMethod === 'cash' ? 'selected' : ''}>Efectivo al retirar</option>
            </select>
            <p class="cart-hint">${
              this.state.paymentMethod === 'cash'
                ? 'Pagás en efectivo al retirar el pedido en el kiosco.'
                : 'Se abre el checkout de Mercado Pago para pagar online.'
            }</p>
          </div>

          <div class="cart-items">${itemsHtml}</div>

          <div class="cart-notes">
            <label for="cart-notes">Nota para el kiosco <span>(opcional)</span></label>
            <textarea id="cart-notes" rows="2" maxlength="200" placeholder="Ej: dejar en el mostrador">${escapeHtml(this.state.notes)}</textarea>
          </div>
        </div>

        <footer class="cart-foot">
          <div class="cart-total">
            <span>Total</span>
            <strong>${money(total)}</strong>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-block"
            data-action="checkout"
            ${!lines.length || !recreo || this.state.checkingOut ? 'disabled' : ''}
          >
            ${this.state.checkingOut ? '<span class="spinner spinner-sm"></span> Confirmando...' : 'Confirmar pedido'}
          </button>
          <p class="cart-foot-note">
            ${lines.length ? `${this.cartCount()} ${this.cartCount() === 1 ? 'producto' : 'productos'} · ${recreo ? escapeHtml(recreo.name) : 'sin recreo'}` : 'Agregá productos para continuar'}
          </p>
        </footer>
      </aside>
    `;
  },

  async checkout() {
    if (this.state.checkingOut) return;

    const lines = this.cartLines();
    if (!lines.length) {
      toast('Agregá productos antes de confirmar.', 'warning');
      return;
    }

    const recreo = this.state.recreos.find((item) => item.id === Number(this.state.recreoId));
    if (!recreo) {
      toast('Elegí el recreo en el que querés retirar tu pedido.', 'warning');
      document.getElementById('cart-recreo')?.focus();
      return;
    }

    this.state.checkingOut = true;
    this.renderCart();

    try {
      const { order } = await api.createOrder({
        recreoId: recreo.id,
        notes: this.state.notes.trim(),
        paymentMethod: this.state.paymentMethod,
        items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      });

      this.state.cart = [];
      this.state.notes = '';
      this.state.checkingOut = false;
      this.persistCart();
      localStorage.removeItem(NOTES_KEY);
      this.closeCart();

      toast(`Pedido ${order.code || "#" + order.id} confirmado`, 'success', 6000);
      this.showOrderSuccess(order);

      await Promise.allSettled([this.loadCatalog(), this.loadOrders()]);
      this.navigate('pedidos');
      this.renderHeader();
    } catch (error) {
      this.state.checkingOut = false;
      if (error.code === 'INSUFFICIENT_STOCK') {
        await this.loadCatalog().catch(() => {});
        this.syncCartIndicators();
        toast(error.message, 'error', 6000);
      } else {
        toast(error.message, 'error', 5000);
      }
      this.renderCart();
    }
  },

  showOrderSuccess(order) {
    const modal = openModal({
      title: '¡Pedido confirmado!',
      subtitle: 'Ya quedó registrado en el kiosco.',
      content: `
        <div class="success-order">
          <p class="success-label">Código de pedido</p>
          <p class="success-code">${escapeHtml(order.code || "#" + order.id)}</p>
          <p class="success-meta">${escapeHtml(order.recreoName ?? '')} · ${escapeHtml(formatLongDate(order.serviceDate))}</p>
          <ul class="order-items success-items">
            ${order.items
              .map(
                (item) => `<li><span class="order-item-qty">${item.quantity}×</span><span class="order-item-name">${escapeHtml(item.productName)}</span><span class="order-item-amount">${money(item.subtotalCents)}</span></li>`,
              )
              .join('')}
          </ul>
          <p class="success-total"><span>Total</span><strong>${money(order.totalCents)}</strong></p>
          <p class="success-note">Mostrá este código al retirar tu pedido. Podés seguir su estado en "Mis pedidos".</p>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-ghost" data-close>Seguir comprando</button>
        <button type="button" class="btn btn-primary" data-go-orders>Ver mis pedidos</button>
      `,
    });
    modal.root.querySelector('[data-go-orders]').addEventListener('click', () => {
      modal.close();
      app.navigate('pedidos');
    });
  },

  // -------------------------------------------------------------------------
  // Eventos globales
  // -------------------------------------------------------------------------
  bindGlobalEvents() {
    window.addEventListener('hashchange', () => this.handleHashChange());

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      this.handleGlobalAction(target.dataset.action, target).catch((error) => toast(error.message, 'error'));
    });

    document.addEventListener('change', (event) => {
      if (event.target.id === 'cart-recreo') {
        this.state.recreoId = Number(event.target.value) || null;
        this.persistRecreo();
        this.renderCart();
      }
      if (event.target.id === 'cart-payment-method') {
        this.state.paymentMethod = event.target.value;
        this.renderCart();
      }
    });

    document.addEventListener('input', (event) => {
      if (event.target.id === 'cart-notes') {
        this.state.notes = event.target.value;
        localStorage.setItem(NOTES_KEY, event.target.value);
      }
    });
  },

  async handleGlobalAction(action, target) {
    switch (action) {
      case 'logout':
        await this.logout();
        return;

      case 'open-cart':
        this.openCart();
        return;

      case 'close-cart':
        this.closeCart();
        return;

      case 'add-to-cart':
        this.addToCart(Number(target.dataset.id));
        return;

      case 'cart-inc':
        this.setCartQuantity(Number(target.dataset.id), this.cartQuantity(Number(target.dataset.id)) + 1);
        return;

      case 'cart-dec':
        this.setCartQuantity(Number(target.dataset.id), this.cartQuantity(Number(target.dataset.id)) - 1);
        return;

      case 'cart-remove':
        this.removeFromCart(Number(target.dataset.id));
        return;

      case 'checkout':
        await this.checkout();
        return;

      case 'cancel-order': {
        const id = Number(target.dataset.id);
        const confirmed = await confirmAction({
          title: 'Cancelar pedido',
          message: '¿Querés cancelar este pedido? El stock vuelve al kiosco y no se puede deshacer.',
          confirmText: 'Sí, cancelar',
          cancelText: 'Volver',
          danger: true,
        });
        if (!confirmed) return;
        await api.cancelOrder(id);
        toast('Pedido cancelado. El stock volvió al kiosco.');
        await Promise.allSettled([this.loadOrders(), this.loadCatalog()]);
        this.render();
        return;
      }

      case 'refresh-orders':
        await this.loadOrders();
        this.render();
        return;

      case 'reload-catalog':
        this.state.catalogLoaded = false;
        this.state.catalogError = null;
        this.render();
        return;

      case 'open-orders':
        this.navigate('pedidos');
        return;

      case 'change-password':
        await this.openChangePasswordModal();
        return;

      case 'pay-order': {
        const id = Number(target.dataset.id);
        try {
          const { checkoutUrl } = await api.createPayment(id);
          if (checkoutUrl) {
            window.location.href = checkoutUrl;
          } else {
            toast('No se pudo iniciar el pago.', 'error');
          }
        } catch (error) {
          toast(error.message, 'error');
        }
        return;
      }

      default:
        return;
    }
  },
};

window.app = app;
app.init().catch(function (error) {
  console.error('No se pudo iniciar el kiosco', error);
  var view = document.getElementById('view');
  if (!view) return;
  view.innerHTML =
    '<div class="error-block">' +
    '<span class="empty-icon"></span>' +
    '<h3>No se pudo iniciar el kiosco</h3>' +
    '<p>Revisá que el servidor esté corriendo (start.bat) y recargá la página.</p>' +
    '</div>';
});
