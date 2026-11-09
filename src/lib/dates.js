/** Devuelve la fecha (AAAA-MM-DD) en la zona horaria configurada del kiosco. */
export function localDateISO(date = new Date(), timeZone = 'America/Argentina/Buenos_Aires') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
