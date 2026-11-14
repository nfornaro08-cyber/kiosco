import { Database } from 'bun:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(currentDir, 'schema.sql');

export function openDatabase(path) {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path, { create: true });
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  return db;
}

/** Crea las tablas e indices si todavia no existen. */
export function applySchema(db) {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  // Migracion liviana para bases ya existentes.
  // Migracion de usuarios: google_sub.
  const userColumns = db.prepare('PRAGMA table_info(users)').all().map((row) => row.name);
  if (!userColumns.includes('google_sub')) {
    db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT;');
  }

  const columns = db.prepare('PRAGMA table_info(orders)').all().map((row) => row.name);
  if (!columns.includes('payment_status')) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';");
  }
  if (!columns.includes('payment_method')) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'mercadopago';");
  }
}

export function closeDatabase(db) {
  try {
    db.close();
  } catch {
    // ignoramos errores al cerrar
  }
}
