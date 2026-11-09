const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Codigo legible para el pedido, por ejemplo: K-261101-7Q3F */
export function generateOrderCode(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `K-${get('year')}${get('month')}${get('day')}-${suffix}`;
}
