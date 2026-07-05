// Enrutador principal de la API. Monta todas las rutas bajo el prefijo /api.
import { Router } from 'express';
import * as remitos from '../controllers/remitosController.js';
import * as reportes from '../controllers/reportesController.js';
import { tipos, sectores } from '../controllers/catalogosController.js';
import * as reposicion from '../controllers/reposicionController.js';
import * as ciclos from '../controllers/cicloController.js';
import * as inventarios from '../controllers/inventarioController.js';
import * as ajustes from '../controllers/ajusteController.js';
import * as presets from '../controllers/presetController.js';
import * as prendas from '../controllers/prendaController.js';
import { ipsLan } from '../net.js';
import { leerConfig, escribirConfig } from '../config.js';
import { errorValidacion } from '../services/errores.js';

const router = Router();

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

// Configuración de la instalación (puerto). Cambiar el puerto requiere reiniciar la app.
router.get('/config', (req, res) => res.json(leerConfig()));
router.put('/config', (req, res) => {
  const puerto = Number(req.body?.puerto);
  if (!Number.isInteger(puerto) || puerto < 1024 || puerto > 65535) {
    throw errorValidacion('El puerto debe ser un entero entre 1024 y 65535.');
  }
  const config = escribirConfig({ puerto });
  res.json({ config, reiniciar: true });
});

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

// Catálogo: tipos de prenda
router.get('/tipos-prenda', tipos.listar);
router.post('/tipos-prenda', tipos.crear);
router.put('/tipos-prenda/:id', tipos.actualizar);
router.delete('/tipos-prenda/:id', tipos.eliminar);

// Catálogo: sectores
router.get('/sectores', sectores.listar);
router.post('/sectores', sectores.crear);
router.put('/sectores/:id', sectores.actualizar);
router.delete('/sectores/:id', sectores.eliminar);

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
