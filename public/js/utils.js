const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function money(cents) {
  return currencyFormatter.format((Number(cents) || 0) / 100);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function formatLongDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export const STATUS_META = {
  pendiente: { label: 'Pendiente', tone: 'amber', icon: '⏳', step: 1 },
  preparando: { label: 'En preparación', tone: 'blue', icon: '👩‍🍳', step: 2 },
  listo: { label: 'Listo para retirar', tone: 'green', icon: '✅', step: 3 },
  entregado: { label: 'Entregado', tone: 'slate', icon: '🎉', step: 4 },
  cancelado: { label: 'Cancelado', tone: 'red', icon: '✕', step: 0 },
};

export function statusBadge(status) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'slate', icon: '•' };
  return `<span class="badge badge-${meta.tone}"><span class="badge-dot"></span>${escapeHtml(meta.label)}</span>`;
}

export function stockLabel(stock) {
  if (stock <= 0) return { label: 'Sin stock', tone: 'red' };
  if (stock <= 5) return { label: `Últimas ${stock}`, tone: 'amber' };
  return { label: 'Disponible', tone: 'green' };
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Fecha de hoy en la zona horaria del kiosco (coincide con la que usa el backend). */
export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}
