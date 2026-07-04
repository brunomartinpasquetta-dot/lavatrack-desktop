// Configuración persistente de la instalación (puerto del servidor).
// En Electron el archivo vive en app.getPath('userData')/config.json (env LAVATRACK_CONFIG_PATH).
// En modo web/dev cae en server/data/config.json.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CONFIG_PATH =
  process.env.LAVATRACK_CONFIG_PATH || join(__dirname, '..', 'data', 'config.json');

const DEFAULTS = { puerto: 3051 };

// Lee la config (con defaults si el archivo no existe o está corrupto).
export function leerConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) };
    }
  } catch {
    /* archivo corrupto → defaults */
  }
  return { ...DEFAULTS };
}

// Escribe la config (merge con lo existente). Devuelve la config resultante.
export function escribirConfig(parcial) {
  const actual = leerConfig();
  const nueva = { ...actual, ...parcial };
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(nueva, null, 2), 'utf8');
  return nueva;
}
