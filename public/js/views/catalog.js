import { emptyState } from '../ui.js';
import { escapeHtml, money, stockLabel } from '../utils.js';

function productCard(app, product) {
  const inCart = app.cartQuantity(product.id);
  const stock = stockLabel(product.stock);
  const canAdd = product.stock > 0 && inCart < product.stock;

  return `
    <article class="product-card" data-card="${product.id}">
      <div class="product-media">
        <span class="product-emoji" aria-hidden="true">${escapeHtml(product.emoji || '🛒')}</span>
        <span class="stock-pill stock-${stock.tone}"><span class="stock-dot"></span>${escapeHtml(stock.label)}</span>
      </div>
      <div class="product-body">
        <p class="product-category">${escapeHtml(product.categoryEmoji ?? '')} ${escapeHtml(product.categoryName ?? 'Sin categoría')}</p>
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <p class="product-desc">${escapeHtml(product.description || '')}</p>
      </div>
      <div class="product-footer">
        <span class="price">${money(product.priceCents)}</span>
        <button
          type="button"
          class="btn btn-primary btn-sm add-btn"
          data-action="add-to-cart"
          data-id="${product.id}"
          ${canAdd ? '' : 'disabled'}
        >
          ${product.stock <= 0 ? 'Sin stock' : 'Agregar'}
        </button>
      </div>
      <p class="in-cart" data-card-qty="${product.id}">${inCart > 0 ? `${inCart} en tu pedido` : ''}</p>
    </article>
  `;
}

export function renderCatalog(app, container) {
  const { products, categories, recreos, user } = app.state;
  const filters = app.state.catalogFilters;

  const firstName = String(user?.name ?? '').split(' ')[0] || 'hola';

  container.innerHTML = `
    <section class="catalog">
      <div class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Kiosco abierto</p>
          <h1>¡Hola, ${escapeHtml(firstName)}! 👋</h1>
          <p class="hero-text">Elegí tus productos, sumalos al carrito y reservalos para el recreo que quieras.</p>
          <div class="hero-recreos">
            ${recreos
              .map(
                (recreo) => `
                <span class="recreo-chip">
                  <span class="recreo-dot"></span>
                  <strong>${escapeHtml(recreo.name)}</strong>
                  <span>${escapeHtml(recreo.startTime)}–${escapeHtml(recreo.endTime)}</span>
                </span>`,
              )
              .join('')}
            ${recreos.length === 0 ? '<span class="recreo-chip is-muted">No hay recreos habilitados</span>' : ''}
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <span class="float-emoji emoji-1">🍫</span>
          <span class="float-emoji emoji-2">🥤</span>
          <span class="float-emoji emoji-3">🥐</span>
          <span class="hero-bag">🛍️</span>
        </div>
      </div>

      <div class="catalog-toolbar">
        <label class="search-field">
          <span aria-hidden="true">🔎</span>
          <input
            id="product-search"
            type="search"
            placeholder="Buscar alfajor, gaseosa, sandwich..."
            autocomplete="off"
            value="${escapeHtml(filters.search)}"
          />
        </label>
        <button type="button" class="btn btn-soft cart-inline-btn" data-action="open-cart">
          🛒 Mi pedido
          <span class="cart-inline-count" data-cart-count>${app.cartCount()}</span>
        </button>
      </div>

      <div id="catalog-results"></div>
    </section>
  `;

  const results = container.querySelector('#catalog-results');
  const searchInput = container.querySelector('#product-search');

  function filteredProducts() {
    const search = filters.search.trim().toLowerCase();
    return products.filter((product) => {
      if (filters.categoryId && product.categoryId !== filters.categoryId) return false;
      if (!search) return true;
      return (
        product.name.toLowerCase().includes(search) ||
        (product.description ?? '').toLowerCase().includes(search) ||
        (product.categoryName ?? '').toLowerCase().includes(search)
      );
    });
  }

  function paint() {
    const visible = filteredProducts();
    const categoryChips = [
      `<button type="button" class="chip ${filters.categoryId === null ? 'is-active' : ''}" data-category="">Todos</button>`,
      ...categories.map(
        (category) => `
          <button type="button" class="chip ${filters.categoryId === category.id ? 'is-active' : ''}" data-category="${category.id}">
            <span aria-hidden="true">${escapeHtml(category.emoji)}</span> ${escapeHtml(category.name)}
          </button>`,
      ),
    ].join('');

    results.innerHTML = `
      <div class="chip-row" role="group" aria-label="Filtrar por categoría">${categoryChips}</div>
      <div class="results-meta">
        <span>${visible.length} ${visible.length === 1 ? 'producto' : 'productos'}</span>
        ${filters.search ? `<button type="button" class="link-btn" data-clear-search>Limpiar búsqueda</button>` : ''}
      </div>
      ${
        visible.length > 0
          ? `<div class="product-grid">${visible.map((product) => productCard(app, product)).join('')}</div>`
          : emptyState({
              icon: '🔍',
              title: 'No encontramos productos',
              text: 'Probá con otra búsqueda o elegí otra categoría.',
            })
      }
    `;
  }

  paint();

  results.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-category]');
    if (chip) {
      filters.categoryId = chip.dataset.category ? Number(chip.dataset.category) : null;
      paint();
      return;
    }
    if (event.target.closest('[data-clear-search]')) {
      filters.search = '';
      searchInput.value = '';
      paint();
      searchInput.focus();
    }
  });

  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.search = searchInput.value;
      paint();
    }, 180);
  });
}

/** Actualiza los indicadores de las tarjetas sin volver a dibujar toda la vista. */
export function syncCatalogCards(app) {
  document.querySelectorAll('[data-card]').forEach((card) => {
    const productId = Number(card.dataset.card);
    const product = app.state.products.find((item) => item.id === productId);
    const quantity = app.cartQuantity(productId);

    const badge = card.querySelector(`[data-card-qty="${productId}"]`);
    if (badge) badge.textContent = quantity > 0 ? `${quantity} en tu pedido` : '';

    const button = card.querySelector('[data-action="add-to-cart"]');
    if (button && product) {
      button.disabled = product.stock <= 0 || quantity >= product.stock;
    }
  });
}
