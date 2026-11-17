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

function randomSixDigitCode() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

/** Crea las tablas e indices si todavia no existen. */
export function applySchema(db) {
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));

  // Migración: agregar código de 6 dígitos a pedidos existentes.
  const orderColumns = db.prepare('PRAGMA table_info(orders)').all().map((row) => row.name);
  if (!orderColumns.includes('code')) {
    db.exec('ALTER TABLE orders ADD COLUMN code TEXT;');
    const rows = db.prepare('SELECT id FROM orders WHERE code IS NULL OR code = "" ORDER BY id').all();
    const used = new Set(
      db
        .prepare("SELECT code FROM orders WHERE code IS NOT NULL AND code != ''")
        .all()
        .map((r) => r.code),
    );
    const update = db.prepare('UPDATE orders SET code = ? WHERE id = ?');
    for (const row of rows) {
      let code = randomSixDigitCode();
      let attempts = 0;
      while (used.has(code) && attempts < 5000) {
        code = randomSixDigitCode();
        attempts += 1;
      }
      while (used.has(code)) {
        code = String((Number(code) + 1) % 1000000).padStart(6, '0');
      }
      used.add(code);
      update.run(code, row.id);
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_code ON orders(code);');
  } else {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_code ON orders(code);');
  }
}

export function closeDatabase(db) {
  try {
    db.close();
  } catch {
    // ignoramos errores al cerrar
  }
}
