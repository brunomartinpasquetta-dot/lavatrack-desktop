// Construcción de la app Express: API en /api + servido de los estáticos del cliente.
//
// SEGURIDAD (Fase 1, Ola 1): autenticación por token (ver routes/index.js + middleware/auth.js)
// y hardening de red: CORS restringido a orígenes conocidos (localhost + LAN) y protección
// anti-DNS-rebinding por header Host (AUD-001), más límite de tamaño de body (AUD-035).
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

// Hostnames legítimos: loopback + todas las IPs LAN detectadas en este momento.
// Se recalcula por request para tolerar cambios de red (WiFi/cable) sin reiniciar.
function hostnamesPermitidos() {
  const set = new Set(['localhost', '127.0.0.1', '::1']);
  for (const { ip } of ipsLan()) set.add(ip);
  return set;
}

// Separa "host:puerto" (o "[::1]:puerto") en { hostname, puerto }.
function parsearHost(host) {
  if (!host) return { hostname: '', puerto: null };
  // IPv6 entre corchetes: [::1]:3051
  const m6 = host.match(/^\[(.+)\]:?(\d+)?$/);
  if (m6) return { hostname: m6[1], puerto: m6[2] ? Number(m6[2]) : null };
  const idx = host.lastIndexOf(':');
  if (idx === -1) return { hostname: host, puerto: null };
  return { hostname: host.slice(0, idx), puerto: Number(host.slice(idx + 1)) };
}

// ¿El header Host apunta a un hostname legítimo y (si trae puerto) al puerto actual?
function hostEsLegitimo(host) {
  const { hostname, puerto } = parsearHost(host);
  if (!hostnamesPermitidos().has(hostname)) return false;
  if (puerto !== null && puerto !== puertoActual()) return false;
  return true;
}

// Origen (esquema://host:puerto) legítimo para CORS: su host debe ser localhost o una IP LAN.
function origenEsLegitimo(origin) {
  try {
    const u = new URL(origin);
    return hostEsLegitimo(u.host);
  } catch {
    return false;
  }
}

export function crearApp() {
  const app = express();

  // AUD-001 — CORS restringido: sólo mismo-origen (sin header Origin) u orígenes
  // localhost/LAN con el puerto actual. Cualquier otro origen se rechaza.
  app.use(
    cors({
      origin(origin, cb) {
        // Sin Origin = request mismo-origen o no-browser (Electron, curl) → permitir.
        if (!origin) return cb(null, true);
        return cb(null, origenEsLegitimo(origin));
      },
    })
  );

  // AUD-035 — límite de tamaño del body para evitar DoS liviano desde la LAN.
  app.use(express.json({ limit: '1mb' }));

  // AUD-001 — anti-DNS-rebinding: toda request a la API debe llegar con un header Host
  // legítimo (localhost / IP LAN conocida, puerto actual). Bloquea que una web maliciosa
  // resuelva su dominio a la IP LAN y dispare requests contra la API.
  app.use('/api', (req, res, next) => {
    if (!hostEsLegitimo(req.headers.host)) {
      return res.status(403).json({ error: 'Host no permitido.' });
    }
    next();
  });

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
  // Los estáticos (index.html/assets) se sirven SIN token: la pantalla de login necesita cargar.
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
