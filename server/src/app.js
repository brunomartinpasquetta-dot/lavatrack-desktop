// Construcción de la app Express: API en /api + servido de los estáticos del cliente.
//
// NOTA DE SEGURIDAD: esta demo NO tiene autenticación ni control de acceso a propósito.
// En un entorno real habría que agregar login, roles (operario / supervisor) y auditoría.
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import apiRouter from './routes/index.js';
import { noEncontrado, manejadorErrores } from './middleware/errorHandler.js';
import { ipsLan } from './net.js';
import { paginaTerminalInfo } from './terminalInfo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Build del cliente: client/dist por defecto; Electron lo sobreescribe con LAVATRACK_CLIENT_DIST.
const CLIENT_DIST =
  process.env.LAVATRACK_CLIENT_DIST || join(__dirname, '..', '..', 'client', 'dist');

const puertoActual = () => Number(process.env.LAVATRACK_PORT) || 3051;

export function crearApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // API REST
  app.use('/api', apiRouter);
  // 404 y errores específicos de la API
  app.use('/api', noEncontrado);
  app.use('/api', manejadorErrores);

  // Página informativa para configurar las terminales (servida por el servidor, no por el SPA).
  app.get('/terminal-info', (req, res) => {
    res.type('html').send(paginaTerminalInfo(ipsLan(), puertoActual()));
  });

  // En la demo/desktop, Express también sirve el build del cliente en el mismo puerto.
  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    // Fallback SPA: cualquier ruta no-API devuelve el index.html para que funcione el router del cliente.
    app.get('*', (req, res) => {
      res.sendFile(join(CLIENT_DIST, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res
        .status(200)
        .send('LavaTrack API activa. Falta el build del cliente (client/dist). Corré: npm run demo');
    });
  }

  return app;
}
