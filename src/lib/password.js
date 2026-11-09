import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

/** Genera un hash scrypt con sal aleatoria. Formato: scrypt$N$r$p$sal$hash */
export function hashPassword(plainPassword) {
  const salt = randomBytes(16);
  const derived = scryptSync(plainPassword, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
  });
  return ['scrypt', COST, BLOCK_SIZE, PARALLELIZATION, salt.toString('hex'), derived.toString('hex')].join('$');
}

/** Verifica una contrasena contra un hash guardado (comparacion en tiempo constante). */
export function verifyPassword(plainPassword, storedHash) {
  try {
    if (typeof storedHash !== 'string') return false;
    const [scheme, n, r, p, saltHex, hashHex] = storedHash.split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const derived = scryptSync(plainPassword, Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
