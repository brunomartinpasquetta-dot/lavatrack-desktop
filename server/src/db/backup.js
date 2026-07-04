// Backups de la base con la técnica segura de SQLite: VACUUM INTO produce una copia
// consistente aunque haya WAL activo (nunca se copia el archivo "en caliente").
// El resultado se comprime con gzip. Retención configurable (default 30).
import { getDb, cerrarDb, DB_PATH } from './connection.js';
import {
  mkdirSync, readdirSync, statSync, unlinkSync, createReadStream, createWriteStream,
  copyFileSync, rmSync, existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

// Nombre de backup con marca temporal: lavatrack-YYYYMMDD-HHmmss.db.gz
function nombreBackup(fecha = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const s = `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}` +
    `-${p(fecha.getHours())}${p(fecha.getMinutes())}${p(fecha.getSeconds())}`;
  return `lavatrack-${s}.db.gz`;
}

/**
 * Crea un backup comprimido en el directorio dado y aplica retención.
 * @returns {Promise<{archivo: string, bytes: number}>}
 */
export async function crearBackup(dirBackups, retencion = 30) {
  mkdirSync(dirBackups, { recursive: true });

  // 1) Copia consistente a un .db temporal con VACUUM INTO (seguro con WAL).
  const tmp = join(dirBackups, `.tmp-${Date.now()}.db`);
  if (existsSync(tmp)) rmSync(tmp);
  // VACUUM INTO no acepta parámetros ligados: se escapa la ruta duplicando comillas simples.
  getDb().exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);

  // 2) Comprimir a .db.gz.
  const destino = join(dirBackups, nombreBackup());
  await pipeline(createReadStream(tmp), createGzip(), createWriteStream(destino));
  rmSync(tmp);

  // 3) Retención: conservar los N más recientes.
  aplicarRetencion(dirBackups, retencion);

  return { archivo: destino, bytes: statSync(destino).size };
}

// Lista los backups (más reciente primero).
export function listarBackups(dirBackups) {
  if (!existsSync(dirBackups)) return [];
  return readdirSync(dirBackups)
    .filter((f) => f.endsWith('.db.gz'))
    .map((f) => {
      const st = statSync(join(dirBackups, f));
      return { archivo: f, ruta: join(dirBackups, f), bytes: st.size, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function aplicarRetencion(dirBackups, retencion) {
  const backups = listarBackups(dirBackups);
  for (const viejo of backups.slice(retencion)) {
    try { unlinkSync(viejo.ruta); } catch { /* ignorar */ }
  }
}

/**
 * Restaura un backup .db.gz sobre la base actual.
 * IMPORTANTE: el llamador (Electron) debe hacerlo con el servidor detenido / antes de
 * abrir la DB, y reiniciar la app después. Deja una copia .pre-restore por seguridad.
 * @param {string} rutaBackupGz
 */
export async function restaurarBackup(rutaBackupGz) {
  const { gunzip } = await import('node:zlib');
  const { readFile, writeFile } = await import('node:fs/promises');
  const comprimido = await readFile(rutaBackupGz);
  const datos = await new Promise((resolve, reject) =>
    gunzip(comprimido, (e, r) => (e ? reject(e) : resolve(r)))
  );

  // Cerrar la conexión (checkpoint) para poder sobrescribir el archivo con seguridad.
  cerrarDb();

  // Respaldo de la base actual antes de pisarla.
  if (existsSync(DB_PATH)) copyFileSync(DB_PATH, `${DB_PATH}.pre-restore`);
  await writeFile(DB_PATH, datos);

  // Eliminar los sidecars del WAL: si quedan, una apertura nueva reaplicaría frames
  // viejos sobre la base restaurada y desharía la restauración.
  for (const sufijo of ['-wal', '-shm']) {
    try { if (existsSync(DB_PATH + sufijo)) rmSync(DB_PATH + sufijo); } catch { /* ignorar */ }
  }
  return { restaurado: DB_PATH };
}
