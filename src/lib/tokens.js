import { createHash } from 'node:crypto';

/** Convierte un token opaco en el valor que se almacena en la base de datos. */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
