import { escapeHtml } from './utils.js';

export function toast(message, tone = 'success', timeout = 4000) {
  const host = document.getElementById('toast-root');
  if (!host) return;
  const element = document.createElement('div');
  element.className = `toast toast-${tone}`;
  element.innerHTML = `<span class="toast-icon">${tone === 'success' ? '' : tone === 'error' ? '!' : 'i'}</span><span class="toast-text">${escapeHtml(message)}</span>`;
  host.appendChild(element);
  requestAnimationFrame(() => element.classList.add('is-visible'));
  setTimeout(() => {
    element.classList.remove('is-visible');
    setTimeout(() => element.remove(), 260);
  }, timeout);
}

export function openModal({ title, subtitle = '', content = '', footer = '', size = '' }) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="modal-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="modal-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar"></button>
      </header>
      <div class="modal-body">${content}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>
  `;

  root.appendChild(overlay);
  document.body.classList.add('modal-open');

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKey);
  };

  function onKey(event) {
    if (event.key === 'Escape') close();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  return { root: overlay, close };
}

export function confirmAction({
  title = 'Confirmar accion',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const modal = openModal({
      title,
      content: `<p class="confirm-text">${escapeHtml(message)}</p>`,
      size: 'modal-sm',
      footer: `
        <button type="button" class="btn btn-ghost" data-close>${escapeHtml(cancelText)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${escapeHtml(confirmText)}</button>
      `,
    });

    modal.root.querySelector('[data-confirm]').addEventListener('click', () => {
      finish(true);
      modal.close();
    });
    modal.root.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => finish(false));
    });
    modal.root.addEventListener('click', (event) => {
      if (event.target === modal.root) finish(false);
    });
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') finish(false);
      },
      { once: true },
    );
  });
}

export function spinnerBlock(text = 'Cargando...') {
  return `
    <div class="loading-block">
      <span class="spinner"></span>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

export function emptyState({ icon = '', title = 'Nada por aquí', text = '', action = '' } = {}) {
  return `
    <div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <h3>${escapeHtml(title)}</h3>
      ${text ? `<p>${escapeHtml(text)}</p>` : ''}
      ${action}
    </div>
  `;
}

export function errorBlock(message, retryAction = 'retry') {
  return `
    <div class="error-block">
      <span class="empty-icon"></span>
      <h3>Algo salió mal</h3>
      <p>${escapeHtml(message)}</p>
      <button class="btn btn-primary" data-action="${retryAction}">Reintentar</button>
    </div>
  `;
}

export function fieldError(message) {
  return message ? `<span class="field-error">${escapeHtml(message)}</span>` : '';
}

export function setButtonLoading(button, loading, loadingText = 'Guardando...') {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner spinner-sm"></span>${escapeHtml(loadingText)}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}
