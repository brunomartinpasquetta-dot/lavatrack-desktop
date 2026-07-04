// Conexión única a SQLite usando el módulo nativo node:sqlite (Node 22+).
// Se eligió node:sqlite para evitar dependencias nativas que requieran compilación
// (en Electron con Node >= 22.5 funciona sin electron-rebuild).
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { SCHEMA_SQL } from './schema.js';
import { correrMigraciones } from './migrations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ubicación del archivo de base de datos.
// Por defecto server/data/lavatrack.db; en Electron se sobreescribe con
// LAVATRACK_DB_PATH apuntando a app.getPath('userData')/lavatrack.db.
export const DB_PATH =
  process.env.LAVATRACK_DB_PATH || join(__dirname, '..', '..', 'data', 'lavatrack.db');

let _db = null;

// Devuelve la instancia singleton de la base, creando el esquema y migrando si hace falta.
export function getDb() {
  if (_db) return _db;

  // Aseguramos que exista el directorio contenedor (userData puede no tenerlo).
  mkdirSync(dirname(DB_PATH), { recursive: true });

  _db = new DatabaseSync(DB_PATH);

  // --- Concurrencia multi-terminal ---
  // WAL permite lecturas concurrentes mientras se escribe; busy_timeout evita
  // errores "database is locked" cuando dos terminales escriben casi a la vez.
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA busy_timeout = 5000;');
  _db.exec('PRAGMA foreign_keys = ON;');

  // Esquema base (idempotente) + migraciones incrementales sobre bases existentes.
  _db.exec(SCHEMA_SQL);
  correrMigraciones(_db);

  return _db;
}

// Indica si la base ya tiene datos cargados (para decidir si correr el seed).
export function baseVacia() {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS n FROM sectores').get();
  return row.n === 0;
}

// Cierra la conexión (hace checkpoint del WAL). Necesario antes de restaurar un backup,
// para poder sobrescribir el archivo sin que queden frames del WAL viejo.
export function cerrarDb() {
  if (_db) {
    try { _db.close(); } catch { /* ya cerrada */ }
    _db = null;
  }
}
