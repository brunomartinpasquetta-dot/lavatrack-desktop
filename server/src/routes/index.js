// Enrutador principal de la API. Monta todas las rutas bajo el prefijo /api.
// Seguridad: /health y /auth/login son PÚBLICAS; el resto exige Bearer (autenticar)
// y algunas rutas además exigen un rol mínimo (requireRol).
import { Router } from 'express';
import * as remitos from '../controllers/remitosController.js';
import * as reportes from '../controllers/reportesController.js';
import { tipos, sectores } from '../controllers/catalogosController.js';
import * as reposicion from '../controllers/reposicionController.js';
import * as ciclos from '../controllers/cicloController.js';
import * as inventarios from '../controllers/inventarioController.js';
import * as ajustes from '../controllers/ajusteController.js';
import * as bajas from '../controllers/bajaController.js';
import * as reproceso from '../controllers/reprocesoController.js';
import * as presets from '../controllers/presetController.js';
import * as prendas from '../controllers/prendaController.js';
import * as auth from '../controllers/authController.js';
import { usuarios } from '../controllers/usuarioController.js';
import { autenticar, requireRol } from '../middleware/auth.js';
import { ipsLan } from '../net.js';
import { leerConfig, escribirConfig } from '../config.js';
import { errorValidacion } from '../services/errores.js';

const router = Router();

// ============================================================
// RUTAS PÚBLICAS (sin token) — deben ir ANTES de autenticar.
// ============================================================

// Health-check liviano: lo consultan las terminales para detectar caída del servidor.
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    servicio: 'lavatrack',
    puerto: Number(process.env.LAVATRACK_PORT) || 3051,
    ips: ipsLan(),
    ts: Date.now(),
  });
});

// Login: emite el token. Público (sin él no habría forma de autenticarse).
router.post('/auth/login', auth.login);

// ============================================================
// A PARTIR DE ACÁ, TODO EXIGE BEARER TOKEN VÁLIDO.
// ============================================================
router.use(autenticar);

// Usuario actual (según el token).
router.get('/auth/me', auth.me);

// Configuración de la instalación (puerto). Solo ADMIN. Cambiar el puerto requiere reiniciar.
router.get('/config', requireRol('ADMIN'), (req, res) => res.json(leerConfig()));
router.put('/config', requireRol('ADMIN'), (req, res) => {
  const puerto = Number(req.body?.puerto);
  if (!Number.isInteger(puerto) || puerto < 1024 || puerto > 65535) {
    throw errorValidacion('El puerto debe ser un entero entre 1024 y 65535.');
  }
  const config = escribirConfig({ puerto });
  res.json({ config, reiniciar: true });
});

// Administración de usuarios (solo ADMIN).
router.get('/usuarios', requireRol('ADMIN'), usuarios.listar);
router.post('/usuarios', requireRol('ADMIN'), usuarios.crear);
router.put('/usuarios/:id', requireRol('ADMIN'), usuarios.actualizar);
router.put('/usuarios/:id/password', requireRol('ADMIN'), usuarios.password);
router.put('/usuarios/:id/activo', requireRol('ADMIN'), usuarios.activo);

// Reportes / vistas calculadas
router.get('/dashboard', reportes.dashboard);
router.get('/stock', reportes.stock);
router.get('/mermas', reportes.mermas);

// Reposición del día + distribución interna (Ropería Central → sector)
router.get('/reposicion', reposicion.reposicion);
router.post('/reposicion/distribuir', reposicion.distribuir);

// Remitos (con items anidados) + conciliación
router.get('/remitos', remitos.listar);
router.post('/remitos', remitos.crear);
router.get('/remitos/:id', remitos.detalle);
router.post('/remitos/:id/conciliar', remitos.conciliarRemito);

// Catálogo: tipos de prenda (DELETE requiere SUPERVISOR o superior)
router.get('/tipos-prenda', tipos.listar);
router.post('/tipos-prenda', tipos.crear);
router.put('/tipos-prenda/:id', tipos.actualizar);
router.delete('/tipos-prenda/:id', requireRol('SUPERVISOR'), tipos.eliminar);

// Catálogo: sectores (DELETE requiere SUPERVISOR o superior)
router.get('/sectores', sectores.listar);
router.post('/sectores', sectores.crear);
router.put('/sectores/:id', sectores.actualizar);
router.delete('/sectores/:id', requireRol('SUPERVISOR'), sectores.eliminar);

// Vida útil por ciclos
router.get('/ciclos', ciclos.listar);

// Inventarios físicos (conteo ciego por sector)
router.get('/inventarios', inventarios.listar);
router.post('/inventarios', inventarios.crear);
router.get('/inventarios/:id', inventarios.detalle);
router.put('/inventarios/:id/conteo', inventarios.conteo);
router.post('/inventarios/:id/cerrar', inventarios.cerrar);

// Ajustes manuales de stock
router.get('/ajustes', ajustes.listar);
router.post('/ajustes', ajustes.crear);

// Bajas manuales (ROTURA / PÉRDIDA con firma doble). Cualquier autenticado puede
// originarlas; la co-firma la valida el service (debe ser SUPERVISOR o superior).
router.get('/bajas', bajas.listar);
router.post('/bajas', bajas.crear);

// Reproceso: pendientes de reingreso + reingreso al stock del sector (AUD-003).
router.get('/reproceso', reproceso.pendientes);
router.post('/reproceso/reingreso', reproceso.reingresar);

// Presets de carga
router.get('/presets', presets.listar);
router.post('/presets', presets.crear);
router.put('/presets/:id', presets.actualizar);
router.delete('/presets/:id', presets.eliminar);

// Prendas identificadas (barcode-ready)
router.get('/prendas-identificadas', prendas.listar);
router.post('/prendas-identificadas', prendas.crear);
router.get('/prendas-identificadas/:codigo', prendas.detalle);

export default router;
