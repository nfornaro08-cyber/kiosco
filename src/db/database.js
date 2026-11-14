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
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
}

export function closeDatabase(db) {
  try {
    db.close();
  } catch {
    // ignoramos errores al cerrar
  }
}
