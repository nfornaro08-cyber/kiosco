/** Genera un código de pedido de 6 dígitos (numérico). */
export function generateOrderCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}
