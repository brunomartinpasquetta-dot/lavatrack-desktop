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
  const { readFile, writeFile, rename } = await import('node:fs/promises');
  const { DatabaseSync } = await import('node:sqlite');
  const { errorValidacion } = await import('../services/errores.js');

  // 1) Descomprimir. Si el .gz es inválido, gunzip rechaza acá y NO se tocó la DB viva.
  const comprimido = await readFile(rutaBackupGz);
  const datos = await new Promise((resolve, reject) =>
    gunzip(comprimido, (e, r) => (e ? reject(e) : resolve(r)))
  );

  // 2) Escribir el contenido descomprimido a un archivo TEMPORAL (no a la DB viva todavía)
  //    y verificar su integridad ANTES de pisar nada (AUD-009).
  const tmp = `${DB_PATH}.restore-tmp`;
  if (existsSync(tmp)) rmSync(tmp);
  await writeFile(tmp, datos);

  try {
    const verif = new DatabaseSync(tmp);
    try {
      const integridad = verif.prepare('PRAGMA integrity_check').get();
      // PRAGMA integrity_check devuelve una fila { integrity_check: 'ok' } si está sana.
      const valor = integridad && (integridad.integrity_check ?? Object.values(integridad)[0]);
      if (valor !== 'ok') {
        throw errorValidacion('El archivo de respaldo está dañado; no se restauró nada.');
      }
      const schema = verif.prepare('PRAGMA schema_version').get();
      const schemaVer = schema && (schema.schema_version ?? Object.values(schema)[0]);
      if (!(Number(schemaVer) > 0)) {
        throw errorValidacion('El archivo de respaldo está dañado; no se restauró nada.');
      }
    } finally {
      try { verif.close(); } catch { /* ya cerrada */ }
    }
  } catch (e) {
    // Falló la apertura o la verificación → borrar el temporal y abortar SIN tocar la DB viva.
    try { rmSync(tmp); } catch { /* ignorar */ }
    if (e && e.status === 400) throw e; // ya es un errorValidacion
    throw errorValidacion('El archivo de respaldo está dañado; no se restauró nada.');
  }

  // 3) La verificación pasó: recién ahora cerramos la conexión viva (checkpoint) y pisamos.
  cerrarDb();

  // Respaldo de la base actual antes de pisarla.
  const prevRestore = `${DB_PATH}.pre-restore`;
  const habiaDb = existsSync(DB_PATH);
  if (habiaDb) copyFileSync(DB_PATH, prevRestore);

  try {
    // Swap atómico: renombrar el temporal ya verificado sobre la DB viva.
    await rename(tmp, DB_PATH);
  } catch (e) {
    // Si el swap falla y habíamos hecho el .pre-restore, restaurar la DB viva original.
    try { if (habiaDb && existsSync(prevRestore)) copyFileSync(prevRestore, DB_PATH); } catch { /* best-effort */ }
    try { if (existsSync(tmp)) rmSync(tmp); } catch { /* ignorar */ }
    throw e;
  }

  // Eliminar los sidecars del WAL: si quedan, una apertura nueva reaplicaría frames
  // viejos sobre la base restaurada y desharía la restauración.
  for (const sufijo of ['-wal', '-shm']) {
    try { if (existsSync(DB_PATH + sufijo)) rmSync(DB_PATH + sufijo); } catch { /* ignorar */ }
  }
  return { restaurado: DB_PATH };
}
