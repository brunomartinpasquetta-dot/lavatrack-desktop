// Seed de datos de ejemplo de LavaTrack.
// Genera 60 días de historia realista para que la demo no arranque vacía.
// Es idempotente a nivel "arranque": index.js solo lo corre si la base está vacía.
import crypto from 'node:crypto';
import { getDb, baseVacia } from './connection.js';
import {
  sectoresRepo, tiposRepo, stockRepo, bajasRepo, dotacionRepo,
  ciclosRepo, inventariosRepo, ajustesRepo, presetsRepo, prendasRepo,
  usuariosRepo, transportistasRepo,
} from './repositorios.js';
import { crearRemito } from '../services/remitosService.js';
import { enTransaccion } from './tx.js';

// Usuarios demo para el arranque de la auth. Claves de DEMO (documentadas en el reporte).
// El hash usa EXACTAMENTE el scrypt canónico que el server usa para verificar el login:
//   salt = crypto.randomBytes(16).toString('hex')
//   hash = crypto.scryptSync(password, salt, 64).toString('hex')
const USUARIOS_DEMO = [
  { usuario: 'admin', password: 'admin1234', rol: 'ADMIN',      nombre: 'Administrador' },
  { usuario: 'super', password: 'super1234', rol: 'SUPERVISOR', nombre: 'Supervisora Ropería' },
  { usuario: 'oper',  password: 'oper1234',  rol: 'OPERARIO',   nombre: 'Operario Turno' },
];

// Siembra los 3 usuarios demo SOLO si todavía no hay ningún usuario cargado.
// Es idempotente por su propio guard (contarPorRol total = 0) e independiente del
// guard baseVacia: una base preexistente (anterior a la auth) también recibe los usuarios.
export function sembrarUsuariosDemo() {
  const db = getDb();
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get();
  if (n > 0) return 0;

  const fechaAlta = new Date().toISOString();
  enTransaccion(() => {
    for (const u of USUARIOS_DEMO) {
      const password_salt = crypto.randomBytes(16).toString('hex');
      const password_hash = crypto.scryptSync(u.password, password_salt, 64).toString('hex');
      usuariosRepo.crear({
        usuario: u.usuario,
        nombre: u.nombre,
        rol: u.rol,
        password_hash,
        password_salt,
        fecha_alta: fechaAlta,
      });
    }
  });
  console.log(`[seed] Usuarios demo sembrados: ${USUARIOS_DEMO.map((u) => u.usuario).join(', ')}.`);
  return USUARIOS_DEMO.length;
}

// Transportistas demo (Ola 4). Idempotente por su propio guard (solo si no hay ninguno),
// independiente del guard baseVacia: una base preexistente también los recibe. Devuelve
// los ids (existentes o recién creados) para poder asignarlos a envíos en el seed.
const TRANSPORTISTAS_DEMO = [
  { nombre: 'Logística Santa Rita', documento: 'CUIT 30-71234567-8', contacto: '011-4555-1200' },
  { nombre: 'Transportes El Álamo',  documento: 'CUIT 30-70987654-3', contacto: '011-4777-8890' },
  { nombre: 'Roberto Suárez (interno)', documento: 'DNI 25.789.456',   contacto: 'Interno 342' },
];

export function sembrarTransportistasDemo() {
  const existentes = transportistasRepo.listar();
  if (existentes.length > 0) return existentes.map((t) => t.id);
  const fechaAlta = new Date().toISOString();
  const ids = [];
  enTransaccion(() => {
    for (const t of TRANSPORTISTAS_DEMO) {
      ids.push(transportistasRepo.crear({ ...t, fecha_alta: fechaAlta }));
    }
  });
  console.log(`[seed] Transportistas demo sembrados: ${TRANSPORTISTAS_DEMO.map((t) => t.nombre).join(', ')}.`);
  return ids;
}

// PRNG determinístico (LCG) para que la demo genere siempre los mismos datos.
let _semilla = 20260703;
function rnd() {
  _semilla = (_semilla * 1664525 + 1013904223) % 4294967296;
  return _semilla / 4294967296;
}
const enteroEntre = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];

// Fecha (YYYY-MM-DD) hace N días respecto de hoy.
function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const FIRMANTES = [
  'María Gómez', 'Juan Pérez', 'Ana Ruiz', 'Carlos Fernández', 'Lucía Martínez',
  'Diego López', 'Sofía Romero', 'Valentina Sosa', 'Gabriel Torres', 'Florencia Aguirre',
];
const AUTORIZANTES = [
  'Lic. Roberto Díaz', 'Dra. Carla Benítez', 'Enf. Jefe Mónica Vega', 'Lic. Andrés Molina',
];

// --- Catálogos base ---

// Tipos de prenda con pesos logísticos y costos de reposición estimados (ARS, mediados 2026).
const TIPOS = [
  { nombre: 'Sábana',           peso_promedio_gr: 600,  vida_util_ciclos: 150, costo_reposicion_ars: 12000 },
  { nombre: 'Funda de almohada', peso_promedio_gr: 180, vida_util_ciclos: 150, costo_reposicion_ars: 4500 },
  { nombre: 'Frazada',          peso_promedio_gr: 1400, vida_util_ciclos: 200, costo_reposicion_ars: 28000 },
  { nombre: 'Toalla',           peso_promedio_gr: 400,  vida_util_ciclos: 120, costo_reposicion_ars: 8500 },
  { nombre: 'Ambo',             peso_promedio_gr: 500,  vida_util_ciclos: 100, costo_reposicion_ars: 22000 },
  { nombre: 'Camisolín',        peso_promedio_gr: 250,  vida_util_ciclos: 80,  costo_reposicion_ars: 6000 },
  { nombre: 'Campo quirúrgico', peso_promedio_gr: 700,  vida_util_ciclos: 90,  costo_reposicion_ars: 18000 },
];

// Sectores con su stock mínimo por tipo de prenda (clave = id de tipo, 1..7) y método de reposición.
// Se mezclan métodos para mostrar los tres flujos en la demo de "Reposición del día".
const SECTORES = [
  { nombre: 'Internación A',   metodo_reposicion: 'PAR',              stock_minimo: { 1: 80, 2: 80, 3: 30, 4: 60 }, tipos: [1, 2, 3, 4] },
  { nombre: 'Internación B',   metodo_reposicion: 'PAR',              stock_minimo: { 1: 70, 2: 70, 3: 25, 4: 50 }, tipos: [1, 2, 3, 4] },
  { nombre: 'Quirófano',       metodo_reposicion: 'CARRO_INTERCAMBIO', stock_minimo: { 1: 30, 5: 40, 6: 60, 7: 50 }, tipos: [5, 6, 7, 1] },
  { nombre: 'Guardia',         metodo_reposicion: 'PAR',              stock_minimo: { 1: 40, 4: 40, 5: 20, 6: 30 }, tipos: [1, 4, 5, 6] },
  { nombre: 'Consultorios',    metodo_reposicion: 'PEDIDO',           stock_minimo: { 1: 20, 2: 20, 4: 30, 6: 40 }, tipos: [1, 2, 4, 6] },
  { nombre: 'Ropería Central', metodo_reposicion: 'PAR',              stock_minimo: { 1: 200, 2: 200, 3: 80, 4: 150, 5: 100, 6: 120, 7: 100 }, tipos: [1, 2, 3, 4] },
];

// Stock inicial "bajo" forzado para que el dashboard muestre alertas (sector nombre, tipo id → cantidad final deseada).
const STOCK_BAJO_FORZADO = [
  { sector: 'Guardia',      tipo: 4, cantidad: 12 },  // Toalla → crítico (mín 40)
  { sector: 'Internación A', tipo: 1, cantidad: 58 }, // Sábana → bajo (mín 80)
  { sector: 'Consultorios', tipo: 6, cantidad: 15 },  // Camisolín → crítico (mín 40)
  { sector: 'Quirófano',    tipo: 7, cantidad: 22 },  // Campo quirúrgico → crítico (mín 50)
  { sector: 'Internación B', tipo: 4, cantidad: 44 }, // Toalla → bajo (mín 50)
];

export function correrSeed() {
  const db = getDb();

  // Los usuarios demo se siembran aparte del resto (su propio guard "no hay usuarios"),
  // así el login funciona incluso sobre una base preexistente sin usuarios. No duplica.
  sembrarUsuariosDemo();

  if (!baseVacia()) {
    // Base preexistente: sembramos transportistas demo si aún no hay ninguno (Ola 4),
    // así una base cargada antes de esta ola también los recibe. Idempotente (guard propio).
    sembrarTransportistasDemo();
    console.log('[seed] La base ya tiene datos; no se vuelve a sembrar.');
    return;
  }

  // Toda la carga va en una sola transacción (enTransaccion es re-entrante, así que los
  // crearRemito internos se unen a esta misma sin abrir transacciones anidadas).
  enTransaccion(() => {
    // 0) Transportistas demo (Ola 4). Se siembran acá para tener sus ids y asignarlos
    //    a algunos envíos más abajo. sembrarTransportistasDemo es re-entrante (usa
    //    enTransaccion) y se une a esta misma transacción.
    const transportistaIds = sembrarTransportistasDemo();

    // 1) Tipos de prenda
    const tipos = TIPOS.map((t) => tiposRepo.crear(t));

    // 2) Sectores (con método de reposición)
    const sectores = SECTORES.map((s) =>
      sectoresRepo.crear({
        nombre: s.nombre,
        stock_minimo: s.stock_minimo,
        metodo_reposicion: s.metodo_reposicion,
      })
    );
    const sectorPorNombre = new Map(sectores.map((s) => [s.nombre, s]));
    const metaSector = new Map(SECTORES.map((s, i) => [sectores[i].id, s]));

    // 2b) Dotación par por sector × tipo: mínima = stock_minimo, par = mínima × 2.
    for (let i = 0; i < sectores.length; i++) {
      const sector = sectores[i];
      const minimos = SECTORES[i].stock_minimo;
      for (const [tipoIdStr, minima] of Object.entries(minimos)) {
        dotacionRepo.guardar(sector.id, Number(tipoIdStr), Number(minima) * 2, Number(minima));
      }
    }

    const fechaBase = diasAtras(60);
    const cellsForzadas = new Set(STOCK_BAJO_FORZADO.map((c) => `${sectorPorNombre.get(c.sector).id}:${c.tipo}`));

    // 3) Stock inicial (ALTA_REPOSICION) por sector × tipo, 60 días atrás.
    for (const sector of sectores) {
      const meta = metaSector.get(sector.id);
      for (const tipoId of Object.keys(sector.stock_minimo).map(Number)) {
        const forzado = STOCK_BAJO_FORZADO.find(
          (c) => sectorPorNombre.get(c.sector).id === sector.id && c.tipo === tipoId
        );
        const minimo = sector.stock_minimo[tipoId];
        // Cargas forzadas quedan bajo el mínimo; el resto arranca con buen colchón
        // para que los envíos en lavandería y los faltantes nunca dejen el stock en negativo.
        const inicial = forzado ? forzado.cantidad : minimo + enteroEntre(55, 110);
        stockRepo.crearMovimiento({
          fecha: fechaBase,
          sector_id: sector.id,
          tipo_prenda_id: tipoId,
          delta: inicial,
          motivo: 'ALTA_REPOSICION',
          remito_id: null,
        });
      }
    }

    // 4) Generar ~25 envíos a lo largo de 60 días.
    const CANT_ENVIOS = 25;
    // Sectores que efectivamente despachan ropa sucia (Ropería Central casi no envía).
    const emisores = sectores.filter((s) => s.nombre !== 'Ropería Central');

    // Índices con tratamiento especial.
    const idxPendientes = new Set([23, 24]);          // 2 últimos: quedan sin retorno (en lavandería).
    const idxDiferencia = new Set([6, 12, 18]);       // 3 con faltantes → CON_DIFERENCIA.
    const idxCategorizado = new Set([3, 9, 15]);      // 3 retornos con desglose por calidad (relavado/costura/descarte).

    for (let i = 0; i < CANT_ENVIOS; i++) {
      const sector = elegir(emisores);
      const meta = metaSector.get(sector.id);
      // Fechas: envíos más viejos primero, los últimos bien recientes.
      // Pendientes: antigüedad 3-7 días para poder demostrar "Registrar retorno" en vivo.
      const diaEnvio = idxPendientes.has(i) ? enteroEntre(3, 7) : 58 - Math.floor((i / CANT_ENVIOS) * 54) - enteroEntre(0, 2);
      const fechaEnvio = diasAtras(Math.max(diaEnvio, 1));

      // Evitar tocar las celdas de stock bajo forzado en pendientes/diferencias.
      const tiposDisponibles = (idxPendientes.has(i) || idxDiferencia.has(i))
        ? meta.tipos.filter((t) => !cellsForzadas.has(`${sector.id}:${t}`))
        : meta.tipos;
      const tiposElegibles = tiposDisponibles.length ? tiposDisponibles : meta.tipos;

      const cantLineas = Math.min(enteroEntre(2, 3), tiposElegibles.length);
      const barajados = [...tiposElegibles].sort(() => rnd() - 0.5);
      const items = barajados.slice(0, cantLineas).map((tipoId) => {
        const cantidad = enteroEntre(10, 28);
        const contaminada = rnd() < 0.4 ? enteroEntre(1, Math.max(1, Math.floor(cantidad * 0.3))) : 0;
        return { tipo_prenda_id: tipoId, cantidad, cantidad_contaminada: contaminada };
      });

      // Asignar transportista a ~2 de cada 3 envíos, rotando entre los del seed (coherente
      // y determinístico). Algunos envíos quedan sin transportista a propósito (campo opcional).
      const transportista_id = (i % 3 !== 2 && transportistaIds.length)
        ? transportistaIds[i % transportistaIds.length]
        : null;

      const envio = crearRemito({
        tipo: 'ENVIO',
        sector_id: sector.id,
        fecha: fechaEnvio,
        firmante: elegir(FIRMANTES),
        observaciones: '',
        items,
        transportista_id,
      });

      // Pendientes: no se registra retorno (quedan ENVIADO / en lavandería).
      if (idxPendientes.has(i)) continue;

      // Retorno 2-4 días después del envío (nunca en el futuro).
      const diaRetorno = Math.max(Math.max(diaEnvio, 1) - enteroEntre(2, 4), 0);
      const fechaRetorno = diasAtras(diaRetorno);

      let itemsRetorno;
      if (idxDiferencia.has(i)) {
        // Faltan algunas prendas de una línea → diferencia.
        itemsRetorno = items.map((it, idx) => {
          if (idx === 0) {
            const faltante = enteroEntre(2, Math.max(2, Math.floor(it.cantidad * 0.25)));
            return { tipo_prenda_id: it.tipo_prenda_id, cantidad: it.cantidad - faltante, cantidad_contaminada: 0 };
          }
          return { tipo_prenda_id: it.tipo_prenda_id, cantidad: it.cantidad, cantidad_contaminada: 0 };
        });
      } else if (idxCategorizado.has(i)) {
        // Retorno completo pero con desglose por calidad en la primera línea:
        // parte apta + relavado + costura + descarte (todo justificado → CONCILIADO, con baja por descarte).
        itemsRetorno = items.map((it, idx) => {
          if (idx === 0 && it.cantidad >= 8) {
            const descarte = enteroEntre(1, 3);
            const relavado = enteroEntre(1, 4);
            const costura = enteroEntre(0, 2);
            return {
              tipo_prenda_id: it.tipo_prenda_id,
              cantidad: it.cantidad,
              cantidad_contaminada: 0,
              cantidad_relavado: relavado,
              cantidad_costura: costura,
              cantidad_descarte: descarte,
            };
          }
          return { tipo_prenda_id: it.tipo_prenda_id, cantidad: it.cantidad, cantidad_contaminada: 0 };
        });
      } else {
        // Retorno completo → CONCILIADO.
        itemsRetorno = items.map((it) => ({
          tipo_prenda_id: it.tipo_prenda_id, cantidad: it.cantidad, cantidad_contaminada: 0,
        }));
      }

      crearRemito({
        tipo: 'RETORNO',
        remito_envio_id: envio.id,
        fecha: fechaRetorno,
        firmante: elegir(FIRMANTES),
        observaciones: '',
        items: itemsRetorno,
        confirmar: true,
        transportista_id, // mismo transportista del envío (coherencia)
      });
    }

    // 5) Bajas variadas (rotura y fin de vida útil) a lo largo del período.
    const bajas = [
      { dia: 50, tipo: 1, cantidad: 6, motivo: 'FIN_VIDA_UTIL' },
      { dia: 42, tipo: 4, cantidad: 4, motivo: 'ROTURA' },
      { dia: 35, tipo: 3, cantidad: 3, motivo: 'FIN_VIDA_UTIL' },
      { dia: 28, tipo: 6, cantidad: 5, motivo: 'ROTURA' },
      { dia: 20, tipo: 5, cantidad: 2, motivo: 'ROTURA' },
      { dia: 14, tipo: 1, cantidad: 8, motivo: 'FIN_VIDA_UTIL' },
      { dia: 9,  tipo: 7, cantidad: 3, motivo: 'ROTURA' },
      { dia: 4,  tipo: 2, cantidad: 5, motivo: 'FIN_VIDA_UTIL' },
    ];
    for (const b of bajas) {
      bajasRepo.crear({
        fecha: diasAtras(b.dia),
        tipo_prenda_id: b.tipo,
        cantidad: b.cantidad,
        motivo: b.motivo,
        autorizado_por: elegir(AUTORIZANTES),
      });
      // La baja también descuenta del stock de Ropería Central (depósito general).
      stockRepo.crearMovimiento({
        fecha: diasAtras(b.dia),
        sector_id: sectorPorNombre.get('Ropería Central').id,
        tipo_prenda_id: b.tipo,
        delta: -b.cantidad,
        // El motivo del kárdex debe reflejar el motivo real de la baja (AUD-002):
        // ROTURA→BAJA_ROTURA, PERDIDA→BAJA_PERDIDA, FIN_VIDA_UTIL→BAJA_FIN_VIDA_UTIL.
        motivo:
          b.motivo === 'ROTURA'
            ? 'BAJA_ROTURA'
            : b.motivo === 'PERDIDA'
              ? 'BAJA_PERDIDA'
              : 'BAJA_FIN_VIDA_UTIL',
        remito_id: null,
      });
    }

    // ======================================================================
    // 3.5) Refactor de dominio: ciclos, presets, prendas identificadas e
    //      inventario cerrado con ajustes. Todo coherente con la historia.
    // ======================================================================

    // 6) Ciclos de vida útil por tipo (promedio acumulado, nivel lote).
    // Valores representativos de la vida ya recorrida. Camisolín (tipo 6) queda
    // en pct 0.85 (>=0.8) para disparar la alarma "Reposición próxima" en la demo.
    const hoy = diasAtras(0);
    const CICLOS_SEMBRADOS = {
      1: 45,  // Sábana        vida 150 → 0.30
      2: 40,  // Funda         vida 150 → 0.27
      3: 30,  // Frazada       vida 200 → 0.15
      4: 55,  // Toalla        vida 120 → 0.46
      5: 62,  // Ambo          vida 100 → 0.62
      6: 68,  // Camisolín     vida 80  → 0.85  ← alarma (proxima)
      7: 58,  // Campo quirúr. vida 90  → 0.64
    };
    for (const t of tipos) {
      ciclosRepo.upsert(t.id, CICLOS_SEMBRADOS[t.id] ?? 0, hoy);
    }

    // 7) Presets de carga: uno por sector (Internación A) y uno global (quirófano).
    const internacionA = sectorPorNombre.get('Internación A');
    presetsRepo.crear({
      nombre: 'Carro Internación estándar',
      sector_id: internacionA.id,
      activo: 1,
      items: [
        { tipo_prenda_id: 1, cantidad: 20 }, // Sábana
        { tipo_prenda_id: 2, cantidad: 20 }, // Funda de almohada
        { tipo_prenda_id: 4, cantidad: 15 }, // Toalla
      ],
    });
    presetsRepo.crear({
      nombre: 'Kit Quirófano',
      sector_id: null, // global
      activo: 1,
      items: [
        { tipo_prenda_id: 7, cantidad: 10 }, // Campo quirúrgico
        { tipo_prenda_id: 6, cantidad: 8 },  // Camisolín
        { tipo_prenda_id: 5, cantidad: 6 },  // Ambo
      ],
    });

    // 8) 5 prendas identificadas (campos quirúrgicos) en Quirófano, estado EN_SECTOR.
    const quirofano = sectorPorNombre.get('Quirófano');
    for (let n = 1; n <= 5; n++) {
      prendasRepo.crear({
        codigo: `CQ-${String(n).padStart(4, '0')}`,
        tipo_prenda_id: 7, // Campo quirúrgico
        sector_actual_id: quirofano.id,
        fecha_alta: diasAtras(45),
      });
    }

    // 9) Inventario CERRADO en Internación B con 2 diferencias → 2 ajustes
    //    (motivo INVENTARIO) + 2 movimientos AJUSTE en el kárdex (conciliables).
    const internacionB = sectorPorNombre.get('Internación B');
    const fechaInv = diasAtras(2);
    const stockCelda = getDb().prepare(
      `SELECT COALESCE(SUM(delta),0) AS actual FROM movimientos_stock
       WHERE sector_id = ? AND tipo_prenda_id = ?`
    );
    const invId = inventariosRepo.crear({
      fecha: fechaInv,
      sector_id: internacionB.id,
      usuario: elegir(AUTORIZANTES),
      observaciones: '',
    });
    // Snapshot de todos los tipos con dotación en el sector; 2 con diferencia, 2 exactos.
    const DIF_SEMBRADA = { 1: -3, 4: +2 }; // Sábana faltan 3, Toalla sobran 2.
    const tiposInv = Object.keys(internacionB.stock_minimo).map(Number);
    for (const tipoId of tiposInv) {
      const teorica = stockCelda.get(internacionB.id, tipoId).actual;
      const dif = DIF_SEMBRADA[tipoId] ?? 0;
      const contada = teorica + dif;
      const itemId = inventariosRepo.crearItem(invId, {
        tipo_prenda_id: tipoId,
        cantidad_teorica: teorica,
      });
      inventariosRepo.setContada(invId, tipoId, contada);
      inventariosRepo.setDiferencia(itemId, dif);
      if (dif !== 0) {
        ajustesRepo.crear({
          fecha: fechaInv,
          sector_id: internacionB.id,
          tipo_prenda_id: tipoId,
          delta: dif,
          motivo: 'INVENTARIO',
          autorizado_por: elegir(AUTORIZANTES),
          inventario_id: invId,
        });
        stockRepo.crearMovimiento({
          fecha: fechaInv,
          sector_id: internacionB.id,
          tipo_prenda_id: tipoId,
          delta: dif,
          motivo: 'AJUSTE',
          remito_id: null,
        });
      }
    }
    inventariosRepo.cerrar(invId, { observaciones: 'Inventario cíclico de demostración.' });
  });

  const resumen = getDb().prepare('SELECT tipo, estado, COUNT(*) AS n FROM remitos GROUP BY tipo, estado').all();
  console.log('[seed] Datos de ejemplo cargados. Remitos por tipo/estado:');
  for (const r of resumen) console.log(`   ${r.tipo} ${r.estado}: ${r.n}`);
}

// Permite correr el seed manualmente: `npm run seed`.
if (import.meta.url === `file://${process.argv[1]}`) {
  correrSeed();
}
