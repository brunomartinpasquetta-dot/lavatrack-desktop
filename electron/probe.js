// Prueba de compatibilidad: verifica que el Node embebido de Electron sea >= 22.5
// y que el módulo nativo `node:sqlite` esté disponible (lo usa el servidor).
import { app } from 'electron';

app.whenReady().then(async () => {
  console.log('[PROBE] versión de Node embebido:', process.versions.node);
  console.log('[PROBE] versión de Electron:', process.versions.electron);
  try {
    const mod = await import('node:sqlite');
    const tieneClase = typeof mod.DatabaseSync === 'function';
    console.log('[PROBE] node:sqlite OK — DatabaseSync disponible:', tieneClase);
    if (tieneClase) {
      // Prueba real: abrir una DB en memoria y ejecutar SQL.
      const db = new mod.DatabaseSync(':memory:');
      db.exec('CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (42);');
      const row = db.prepare('SELECT x FROM t').get();
      console.log('[PROBE] SQL de prueba devolvió:', row.x);
      db.close();
      console.log('[PROBE] RESULTADO: node:sqlite FUNCIONA');
    } else {
      console.log('[PROBE] RESULTADO: node:sqlite cargó pero SIN DatabaseSync');
    }
  } catch (e) {
    console.error('[PROBE] RESULTADO: node:sqlite ERROR:', e && e.message);
  }
  app.quit();
});
