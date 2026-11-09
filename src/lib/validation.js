import { AppError } from './errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function invalid(field, message) {
  return AppError.badRequest('VALIDATION_ERROR', 'Revisa los datos ingresados.', { [field]: message });
}

export function text(value, field, { min = 1, max = 200, required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw invalid(field, 'Este campo es obligatorio.');
    return null;
  }
  if (typeof value !== 'string') throw invalid(field, 'Debe ser texto.');
  const out = value.trim();
  if (!out) {
    if (required) throw invalid(field, 'Este campo es obligatorio.');
    return null;
  }
  if (out.length < min) throw invalid(field, `Debe tener al menos ${min} caracteres.`);
  if (out.length > max) throw invalid(field, `No puede superar los ${max} caracteres.`);
  return out;
}

export function email(value) {
  const out = text(value, 'email', { max: 160 }).toLowerCase();
  if (!EMAIL_RE.test(out)) throw invalid('email', 'Ingresá un correo válido.');
  return out;
}

export function password(value) {
  if (typeof value !== 'string') throw invalid('password', 'La contraseña es obligatoria.');
  if (value.length < 8) throw invalid('password', 'La contraseña debe tener al menos 8 caracteres.');
  if (value.length > 128) throw invalid('password', 'La contraseña es demasiado larga.');
  return value;
}

export function integer(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw invalid(field, 'Este campo es obligatorio.');
    return null;
  }
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) {
    throw invalid(field, 'Debe ser un número entero.');
  }
  if (n < min) throw invalid(field, `No puede ser menor que ${min}.`);
  if (n > max) throw invalid(field, `No puede ser mayor que ${max}.`);
  return n;
}

export function boolean(value, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw invalid(field, 'Este campo es obligatorio.');
    return null;
  }
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  throw invalid(field, 'Debe ser verdadero o falso.');
}

export function oneOf(value, field, allowed) {
  const out = text(value, field);
  if (!allowed.includes(out)) throw invalid(field, `Debe ser uno de: ${allowed.join(', ')}.`);
  return out;
}

export function timeHHMM(value, field) {
  const out = text(value, field, { min: 5, max: 5 });
  if (!TIME_RE.test(out)) throw invalid(field, 'Usa el formato HH:MM (por ejemplo 09:30).');
  return out;
}

export function dateISO(value, field) {
  const out = text(value, field, { min: 10, max: 10 });
  if (!DATE_RE.test(out)) throw invalid(field, 'Usa el formato AAAA-MM-DD.');
  const d = new Date(`${out}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== out) {
    throw invalid(field, 'La fecha no es valida.');
  }
  return out;
}

export function list(value, field, { min = 1, max = 60 } = {}) {
  if (!Array.isArray(value)) throw invalid(field, 'Debe ser una lista.');
  if (value.length < min) throw invalid(field, 'La lista está vacía.');
  if (value.length > max) throw invalid(field, `No puede tener mas de ${max} elementos.`);
  return value;
}
