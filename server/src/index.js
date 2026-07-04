// Punto de entrada del servidor LavaTrack.
// Exporta iniciarServidor() para que también lo use el shell Electron (envolver, no reescribir).
import { crearApp } from './app.js';
import { baseVacia } from './db/connection.js';
import { correrSeed } from './db/seed.js';
import { ipsLan } from './net.js';

// Puerto y host configurables por entorno (Electron los pasa desde userData/config.json).
const PUERTO = Number(process.env.LAVATRACK_PORT) || 3051;
// Bind 0.0.0.0 = accesible desde las terminales de la LAN, no sólo localhost.
const HOST = process.env.LAVATRACK_HOST || '0.0.0.0';

/**
 * Levanta el servidor Express.
 * @param {object} opts
 * @param {number} [opts.puerto]
 * @param {string} [opts.host]
 * @param {boolean} [opts.seedSiVacio] - si la base está vacía, cargar datos demo (default true).
 * @param {boolean} [opts.silencioso] - no imprimir el resumen por consola.
 * @returns {Promise<import('http').Server>}
 */
export function iniciarServidor(opts = {}) {
  const puerto = opts.puerto ?? PUERTO;
  const host = opts.host ?? HOST;
  const seedSiVacio = opts.seedSiVacio ?? true;

  if (seedSiVacio && baseVacia()) {
    console.log('[LavaTrack] Base vacía: cargando datos de ejemplo (seed)...');
    correrSeed();
  }

  const app = crearApp();

  return new Promise((resolve) => {
    const server = app.listen(puerto, host, () => {
      if (!opts.silencioso) imprimirResumen(puerto);
      resolve(server);
    });
  });
}

function imprimirResumen(puerto) {
  const linea = '─'.repeat(64);
  const ips = ipsLan();
  console.log(`\n${linea}`);
  console.log('🧺  LavaTrack — Gestión de Ropa Hospitalaria');
  console.log(linea);
  console.log(`   Servidor local:  http://localhost:${puerto}`);
  if (ips.length) {
    console.log('   Terminales LAN:');
    for (const { interfaz, ip } of ips) {
      console.log(`     • http://${ip}:${puerto}   (${interfaz})`);
    }
  }
  console.log(`   Info terminales: http://localhost:${puerto}/terminal-info`);
  console.log('   Credenciales:    N/A (demo sin autenticación)');
  console.log(`${linea}\n`);
}

// Si se ejecuta directamente (modo web/dev), arrancar el servidor.
if (import.meta.url === `file://${process.argv[1]}`) {
  iniciarServidor();
}
