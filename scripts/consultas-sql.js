import { Database } from 'bun:sqlite';
import { createInterface } from 'node:readline';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from '../src/config.js';

/**
 * Consola SQL aparte (no usa frontend).
 * - Local: consulta la base local.
 * - Railway (real): ejecutá este archivo dentro del entorno de Railway (shell del servicio
 *   o comando en el contenedor) para que use el DB_PATH/volume de producción.
 */

const dbPath = process.env.DB_PATH ? resolve(process.env.DB_PATH) : config.dbPath;
mkdirSync(dirname(dbPath), { recursive: true });
const existed = existsSync(dbPath);
const db = new Database(dbPath, { create: true });

console.log('=== Consola SQL (archivo aparte) ===');
console.log('Base de datos:', dbPath);
console.log(existed ? 'Estado: conectada a archivo existente.' : 'Estado: archivo creado (puede estar vacío si no se inicializó).');
console.log('Comandos: .tables  .schema [tabla]  .exit');
console.log('Tip: en Railway, ejecutá este script dentro del servicio para consultar la base real del volume.');
console.log('');

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'sql> ' });

function showTables() {
  const rows = db
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();
  if (!rows.length) {
    console.log('(sin tablas)');
    return;
  }
  console.table(rows);
}

function showSchema(table) {
  if (table) {
    const safe = table.replace(/[^a-zA-Z0-9_]/g, '');
    const rows = db.query('PRAGMA table_info(' + safe + ')').all();
    if (!rows.length) {
      console.log('Tabla no encontrada o sin columnas:', table);
      return;
    }
    console.table(rows);
    return;
  }
  const rows = db
    .query("SELECT name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type, name")
    .all();
  for (const row of rows) {
    console.log(`\n-- ${row.name}`);
    console.log(row.sql + ';');
  }
}

function runSql(sql) {
  const trimmed = sql.trim();
  if (!trimmed) return;
  const upper = trimmed.toUpperCase();
  const isRead = /^(SELECT|WITH|PRAGMA|EXPLAIN)\b/.test(upper);
  if (isRead) {
    const rows = db.query(trimmed).all();
    if (rows.length === 0) {
      console.log('(0 filas)');
    } else {
      console.table(rows);
      console.log(`(${rows.length} fila${rows.length === 1 ? '' : 's'})`);
    }
    return;
  }
  const result = db.run(trimmed);
  console.log(`OK. cambios=${result.changes ?? 0} lastInsertRowid=${result.lastInsertRowid ?? 'n/a'}`);
}

rl.prompt();
rl.on('line', (line) => {
  const input = line.trim();
  try {
    if (!input) {
      // noop
    } else if (input === '.exit' || input === '.quit') {
      rl.close();
      return;
    } else if (input === '.tables') {
      showTables();
    } else if (input.startsWith('.schema')) {
      const parts = input.split(/\s+/);
      showSchema(parts[1]);
    } else {
      runSql(input);
    }
  } catch (error) {
    console.error('Error SQL:', error?.message ?? error);
  }
  rl.prompt();
});

rl.on('close', () => {
  try {
    db.close();
  } catch {}
  console.log('Conexión cerrada.');
  process.exit(0);
});
