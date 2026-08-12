// Seed personalizado del Sanatorio San Jerónimo (Coronda).
// Genera un demo realista y CONCILIADO (kárdex 0) con la realidad del sanatorio:
//   - 2 lavaderos tercerizados (uno para casi todo, otro para la ropa del médico).
//   - Sectores del circuito clínico + Ropería Central (depósito).
//   - Catálogo general + la planilla "Ropa de Cirugía" (quirófano).
//   - ~30 días de envíos/retornos, algunos CON_DIFERENCIA para nutrir las mermas.
//
// NO es idempotente: WIPEA e inserta (sirve para regenerar el demo cuando haga falta).
// Uso:  LAVATRACK_DB_PATH=<ruta> node server/src/db/seed-sanjeronimo.js
import crypto from 'node:crypto';
import { getDb } from './connection.js';
import {
  sectoresRepo, tiposRepo, stockRepo, bajasRepo, dotacionRepo,
  ciclosRepo, presetsRepo, transportistasRepo, lavaderosRepo, usuariosRepo,
} from './repositorios.js';
import { crearRemito } from '../services/remitosService.js';
import { enTransaccion } from './tx.js';

// ---------------------------------------------------------------------------
// Datos de San Jerónimo
// ---------------------------------------------------------------------------

// Usuarios demo (mismo scrypt canónico que seed.js).
const USUARIOS_DEMO = [
  { usuario: 'admin', password: 'admin1234', rol: 'ADMIN',      nombre: 'Administrador' },
  { usuario: 'super', password: 'super1234', rol: 'SUPERVISOR', nombre: 'Supervisora Ropería' },
  { usuario: 'oper',  password: 'oper1234',  rol: 'OPERARIO',   nombre: 'Operario Turno' },
];

const LAVADEROS = ['Lavadero 1', 'Lavadero 2'];

// Transportistas = los dos retiros diarios (2x/día) del sanatorio.
const TRANSPORTISTAS = [
  { nombre: 'Retiro mañana (07:00)', documento: 'Interno', contacto: 'Portería ropería' },
  { nombre: 'Retiro tarde (16:00)',  documento: 'Interno', contacto: 'Portería ropería' },
];

// Prendas generales (7).
const GENERALES = [
  'Sábana plana', 'Funda de almohada', 'Sábana ajustable', 'Frazada', 'Almohada', 'Traversa', 'Toallón',
];
// Prendas de cirugía (planilla "Ropa de Cirugía") (15).
const CIRUGIA = [
  'Cerrada de mesa', 'Fenestrada grande', 'Fenestrada chica', 'Compresa de toalla blanca',
  'Compresa de tela 80x80', 'Bata manga larga', 'Sábana cerrada de traumatología', 'Sábana grande',
  'Compresa de parto 1,60x1,80', 'Chaqueta', 'Pantalón', 'Bata manga corta', 'Bolsillo',
  'Compresa de mano', 'Tira de valvas',
];

// Catálogo con peso (gr), vida útil (ciclos) y costo de reposición (ARS, mediados 2026).
const TIPOS = [
  // Generales
  { nombre: 'Sábana plana',        peso_promedio_gr: 600,  vida_util_ciclos: 150, costo_reposicion_ars: 12000 },
  { nombre: 'Funda de almohada',   peso_promedio_gr: 180,  vida_util_ciclos: 150, costo_reposicion_ars: 4500 },
  { nombre: 'Sábana ajustable',    peso_promedio_gr: 650,  vida_util_ciclos: 150, costo_reposicion_ars: 13000 },
  { nombre: 'Frazada',             peso_promedio_gr: 1400, vida_util_ciclos: 200, costo_reposicion_ars: 28000 },
  { nombre: 'Almohada',            peso_promedio_gr: 800,  vida_util_ciclos: 300, costo_reposicion_ars: 15000 },
  { nombre: 'Traversa',            peso_promedio_gr: 500,  vida_util_ciclos: 120, costo_reposicion_ars: 9000 },
  { nombre: 'Toallón',             peso_promedio_gr: 550,  vida_util_ciclos: 120, costo_reposicion_ars: 11000 },
  // Cirugía
  { nombre: 'Cerrada de mesa',                 peso_promedio_gr: 900, vida_util_ciclos: 100, costo_reposicion_ars: 24000 },
  { nombre: 'Fenestrada grande',               peso_promedio_gr: 850, vida_util_ciclos: 100, costo_reposicion_ars: 26000 },
  { nombre: 'Fenestrada chica',                peso_promedio_gr: 500, vida_util_ciclos: 100, costo_reposicion_ars: 18000 },
  { nombre: 'Compresa de toalla blanca',       peso_promedio_gr: 300, vida_util_ciclos: 120, costo_reposicion_ars: 7000 },
  { nombre: 'Compresa de tela 80x80',          peso_promedio_gr: 350, vida_util_ciclos: 120, costo_reposicion_ars: 8000 },
  { nombre: 'Bata manga larga',                peso_promedio_gr: 450, vida_util_ciclos: 100, costo_reposicion_ars: 16000 },
  { nombre: 'Sábana cerrada de traumatología', peso_promedio_gr: 950, vida_util_ciclos: 100, costo_reposicion_ars: 27000 },
  { nombre: 'Sábana grande',                   peso_promedio_gr: 800, vida_util_ciclos: 120, costo_reposicion_ars: 20000 },
  { nombre: 'Compresa de parto 1,60x1,80',     peso_promedio_gr: 700, vida_util_ciclos: 100, costo_reposicion_ars: 19000 },
  { nombre: 'Chaqueta',                        peso_promedio_gr: 400, vida_util_ciclos: 100, costo_reposicion_ars: 14000 },
  { nombre: 'Pantalón',                        peso_promedio_gr: 450, vida_util_ciclos: 100, costo_reposicion_ars: 14000 },
  { nombre: 'Bata manga corta',                peso_promedio_gr: 400, vida_util_ciclos: 100, costo_reposicion_ars: 15000 },
  { nombre: 'Bolsillo',                        peso_promedio_gr: 200, vida_util_ciclos: 100, costo_reposicion_ars: 6000 },
  { nombre: 'Compresa de mano',                peso_promedio_gr: 150, vida_util_ciclos: 120, costo_reposicion_ars: 4000 },
  { nombre: 'Tira de valvas',                  peso_promedio_gr: 250, vida_util_ciclos: 100, costo_reposicion_ars: 9000 },
];

// Sectores con su dotación (nombre de prenda → cantidad mínima). par = mínima × 2.
// lavadero: a qué lavandería despacha ese sector (Médico → Lavadero 2, el resto → Lavadero 1).
const SECTORES = [
  {
    nombre: 'Internación Piso y UTI', metodo_reposicion: 'PAR', lavadero: 'Lavadero 1',
    dotacion: {
      'Sábana plana': 120, 'Funda de almohada': 120, 'Sábana ajustable': 100,
      'Frazada': 40, 'Almohada': 40, 'Traversa': 60, 'Toallón': 80,
    },
  },
  {
    nombre: 'Quirófano', metodo_reposicion: 'CARRO_INTERCAMBIO', lavadero: 'Lavadero 1',
    dotacion: {
      'Sábana plana': 30, 'Sábana ajustable': 30,
      'Cerrada de mesa': 20, 'Fenestrada grande': 20, 'Fenestrada chica': 20,
      'Compresa de toalla blanca': 40, 'Compresa de tela 80x80': 40, 'Bata manga larga': 30,
      'Sábana cerrada de traumatología': 15, 'Sábana grande': 25, 'Compresa de parto 1,60x1,80': 15,
      'Chaqueta': 30, 'Pantalón': 30, 'Bata manga corta': 25, 'Bolsillo': 20,
      'Compresa de mano': 40, 'Tira de valvas': 15,
    },
  },
  {
    nombre: 'Habitación del Médico', metodo_reposicion: 'PAR', lavadero: 'Lavadero 2',
    dotacion: { 'Sábana plana': 10, 'Toallón': 8 },
  },
  {
    nombre: 'Oncología', metodo_reposicion: 'PAR', lavadero: 'Lavadero 1',
    dotacion: { 'Sábana plana': 50, 'Funda de almohada': 50, 'Sábana ajustable': 40, 'Frazada': 20 },
  },
  {
    nombre: 'Ropería Central', metodo_reposicion: 'PAR', lavadero: null, deposito: true,
    // Depósito: dotación de todos los tipos (se completa en runtime con mínima alta).
    dotacion: null,
  },
];

// Celdas forzadas bajo el mínimo para que el tablero muestre alertas (sector, prenda → cantidad).
// Se EXCLUYEN de los tipos emitibles del sector, así el stock queda clavado en ese valor.
const STOCK_BAJO_FORZADO = [
  { sector: 'Internación Piso y UTI', tipo: 'Toallón', cantidad: 40 },       // mín 80 → bajo
  { sector: 'Oncología',              tipo: 'Frazada', cantidad: 8 },        // mín 20 → crítico
  { sector: 'Quirófano',              tipo: 'Bata manga larga', cantidad: 12 }, // mín 30 → crítico
];

// Firmantes con nombres realistas de personal del sanatorio.
const FIRMANTES = [
  'María Gómez', 'Juan Pérez', 'Ana Ruiz', 'Carlos Fernández', 'Lucía Martínez',
  'Diego López', 'Sofía Romero', 'Valentina Sosa', 'Gabriel Torres', 'Florencia Aguirre',
];
const AUTORIZANTES = [
  'Lic. Roberto Díaz', 'Dra. Carla Benítez', 'Enf. Jefe Mónica Vega', 'Lic. Andrés Molina',
];

// Rotación de sectores emisores (Internación y Quirófano despachan más seguido).
const ROTACION_EMISORES = [
  'Internación Piso y UTI', 'Quirófano', 'Internación Piso y UTI', 'Oncología',
  'Quirófano', 'Habitación del Médico', 'Internación Piso y UTI', 'Quirófano',
  'Oncología', 'Internación Piso y UTI',
];

// ---------------------------------------------------------------------------
// Utilidades deterministas (mismo estilo que seed.js)
// ---------------------------------------------------------------------------

let _semilla = 20260811;
function rnd() {
  _semilla = (_semilla * 1664525 + 1013904223) % 4294967296;
  return _semilla / 4294967296;
}
const enteroEntre = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Borra todos los datos (WIPE) preservando el esquema. Se hace con FK OFF y FUERA de
// transacción (PRAGMA foreign_keys no puede cambiarse dentro de una transacción).
function wipe(db) {
  const TABLAS = [
    'movimientos_stock', 'remito_items', 'remitos', 'bajas', 'ajustes',
    'inventario_items', 'inventarios', 'distribuciones', 'presets_items', 'presets_carga',
    'prendas_identificadas', 'ciclos_prenda', 'dotacion_par', 'idempotencia',
    'tipos_prenda', 'sectores', 'transportistas', 'lavaderos', 'usuarios',
  ];
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of TABLAS) db.exec(`DELETE FROM ${t};`);
  // Reset de autoincrement para ids limpios (1..N) en el demo.
  const tieneSeq = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
    .get();
  if (tieneSeq) db.exec('DELETE FROM sqlite_sequence;');
  db.exec('PRAGMA foreign_keys = ON;');
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export function correrSeedSanJeronimo() {
  const db = getDb();
  wipe(db);

  enTransaccion(() => {
    // 1) Usuarios demo (scrypt canónico).
    const fechaAlta = new Date().toISOString();
    for (const u of USUARIOS_DEMO) {
      const password_salt = crypto.randomBytes(16).toString('hex');
      const password_hash = crypto.scryptSync(u.password, password_salt, 64).toString('hex');
      usuariosRepo.crear({
        usuario: u.usuario, nombre: u.nombre, rol: u.rol,
        password_hash, password_salt, fecha_alta: fechaAlta,
      });
    }

    // 2) Lavaderos.
    const lavaderoId = new Map();
    for (const nombre of LAVADEROS) {
      lavaderoId.set(nombre, lavaderosRepo.crear({ nombre, fecha_alta: fechaAlta }));
    }

    // 3) Transportistas (los dos retiros diarios).
    const transportistaIds = TRANSPORTISTAS.map((t) =>
      transportistasRepo.crear({ ...t, fecha_alta: fechaAlta })
    );

    // 4) Tipos de prenda → mapa nombre→id.
    const tipoId = new Map();
    for (const t of TIPOS) {
      tipoId.set(t.nombre, tiposRepo.crear(t).id);
    }

    // 5) Sectores + dotación (mínima/par). Ropería Central = depósito con todos los tipos.
    const sectorInfo = new Map(); // nombre → { id, dotacion:{tipoNombre:minima}, lavaderoId, deposito }
    for (const s of SECTORES) {
      const dotacion = s.deposito
        ? Object.fromEntries(TIPOS.map((t) => [t.nombre, 100]))
        : s.dotacion;
      // stock_minimo_json usa claves = id de tipo (compat con el resto del sistema).
      const stock_minimo = {};
      for (const [nombre, minima] of Object.entries(dotacion)) {
        stock_minimo[tipoId.get(nombre)] = minima;
      }
      const fila = sectoresRepo.crear({
        nombre: s.nombre,
        stock_minimo,
        metodo_reposicion: s.metodo_reposicion,
      });
      // Dotación par por sector × tipo: mínima = dotación, par = mínima × 2.
      for (const [nombre, minima] of Object.entries(dotacion)) {
        dotacionRepo.guardar(fila.id, tipoId.get(nombre), minima * 2, minima);
      }
      sectorInfo.set(s.nombre, {
        id: fila.id,
        dotacion,
        lavaderoId: s.lavadero ? lavaderoId.get(s.lavadero) : null,
        deposito: !!s.deposito,
      });
    }

    // 6) Stock inicial (ALTA_REPOSICION), 40 días atrás.
    //    - Celdas forzadas: quedan clavadas bajo el mínimo (alertas del tablero).
    //    - Ropería Central (depósito): stock alto (400 por tipo).
    //    - Resto: mínima + colchón para absorber envíos/faltantes sin negativos.
    const fechaBase = diasAtras(40);
    const forzadoDe = (sectorNombre, tipoNombre) =>
      STOCK_BAJO_FORZADO.find((c) => c.sector === sectorNombre && c.tipo === tipoNombre);
    for (const s of SECTORES) {
      const info = sectorInfo.get(s.nombre);
      for (const nombre of Object.keys(info.dotacion)) {
        const minima = info.dotacion[nombre];
        const forzado = forzadoDe(s.nombre, nombre);
        const inicial = forzado
          ? forzado.cantidad
          : info.deposito
            ? 400
            : minima + enteroEntre(60, 120);
        stockRepo.crearMovimiento({
          fecha: fechaBase,
          sector_id: info.id,
          tipo_prenda_id: tipoId.get(nombre),
          delta: inicial,
          motivo: 'ALTA_REPOSICION',
          remito_id: null,
        });
      }
    }

    // 7) Envíos y retornos a lo largo de ~40 días.
    const CANT_ENVIOS = 30;
    const idxPendientes = new Set([28, 29]);       // 2 últimos: sin retorno (en lavandería).
    const idxDiferencia = new Set([5, 13, 21, 26]); // faltantes → CON_DIFERENCIA.
    const idxCategorizado = new Set([8, 17]);       // desglose por calidad (relavado/costura/descarte).

    // Tipos emitibles de un sector = su dotación MENOS las celdas forzadas (para no moverlas).
    const emitiblesDe = (sectorNombre) =>
      Object.keys(sectorInfo.get(sectorNombre).dotacion)
        .filter((nombre) => !forzadoDe(sectorNombre, nombre));

    for (let i = 0; i < CANT_ENVIOS; i++) {
      const sectorNombre = ROTACION_EMISORES[i % ROTACION_EMISORES.length];
      const info = sectorInfo.get(sectorNombre);

      // Fechas: los envíos más viejos primero; los pendientes bien recientes (3-7 días).
      const diaEnvio = idxPendientes.has(i)
        ? enteroEntre(3, 7)
        : Math.max(38 - Math.floor((i / CANT_ENVIOS) * 34) - enteroEntre(0, 2), 1);
      const fechaEnvio = diasAtras(diaEnvio);

      const elegibles = emitiblesDe(sectorNombre);
      const cantLineas = Math.min(enteroEntre(2, 4), elegibles.length);
      const barajados = [...elegibles].sort(() => rnd() - 0.5);
      const items = barajados.slice(0, cantLineas).map((nombre) => {
        const cantidad = enteroEntre(8, 26);
        const contaminada = rnd() < 0.35 ? enteroEntre(1, Math.max(1, Math.floor(cantidad * 0.3))) : 0;
        return { tipo_prenda_id: tipoId.get(nombre), cantidad, cantidad_contaminada: contaminada };
      });

      // Transportista: ~2 de cada 3 envíos, rotando (coherente y determinístico).
      const transportista_id = (i % 3 !== 2)
        ? transportistaIds[i % transportistaIds.length]
        : null;

      const envio = crearRemito({
        tipo: 'ENVIO',
        sector_id: info.id,
        fecha: fechaEnvio,
        firmante: elegir(FIRMANTES),
        observaciones: '',
        items,
        transportista_id,
        lavadero_id: info.lavaderoId,
      });

      if (idxPendientes.has(i)) continue; // sin retorno: queda ENVIADO / en lavandería.

      // Retorno 2-4 días después del envío (nunca en el futuro, nunca antes del envío).
      const diaRetorno = Math.max(diaEnvio - enteroEntre(2, 4), 0);
      const fechaRetorno = diasAtras(diaRetorno);

      let itemsRetorno;
      if (idxDiferencia.has(i)) {
        // Faltan algunas prendas de la primera línea → diferencia.
        itemsRetorno = items.map((it, idx) => {
          if (idx === 0) {
            const faltante = enteroEntre(2, Math.max(2, Math.floor(it.cantidad * 0.25)));
            return { tipo_prenda_id: it.tipo_prenda_id, cantidad: it.cantidad - faltante, cantidad_contaminada: 0 };
          }
          return { tipo_prenda_id: it.tipo_prenda_id, cantidad: it.cantidad, cantidad_contaminada: 0 };
        });
      } else if (idxCategorizado.has(i)) {
        // Retorno completo con desglose por calidad en la primera línea (apta + relavado + costura + descarte).
        itemsRetorno = items.map((it, idx) => {
          if (idx === 0 && it.cantidad >= 8) {
            return {
              tipo_prenda_id: it.tipo_prenda_id,
              cantidad: it.cantidad,
              cantidad_contaminada: 0,
              cantidad_relavado: enteroEntre(1, 4),
              cantidad_costura: enteroEntre(0, 2),
              cantidad_descarte: enteroEntre(1, 3),
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
        // lavadero_id se hereda del envío en el service.
      });
    }

    // 8) Bajas manuales (rotura / fin de vida útil), descontadas de Ropería Central (depósito).
    const roperia = sectorInfo.get('Ropería Central');
    const BAJAS = [
      { dia: 33, tipo: 'Sábana plana',              cantidad: 6, motivo: 'FIN_VIDA_UTIL' },
      { dia: 27, tipo: 'Toallón',                   cantidad: 4, motivo: 'ROTURA' },
      { dia: 20, tipo: 'Frazada',                   cantidad: 3, motivo: 'FIN_VIDA_UTIL' },
      { dia: 14, tipo: 'Bata manga larga',          cantidad: 5, motivo: 'ROTURA' },
      { dia: 8,  tipo: 'Compresa de toalla blanca', cantidad: 4, motivo: 'FIN_VIDA_UTIL' },
      { dia: 4,  tipo: 'Funda de almohada',         cantidad: 5, motivo: 'ROTURA' },
    ];
    for (const b of BAJAS) {
      const tid = tipoId.get(b.tipo);
      bajasRepo.crear({
        fecha: diasAtras(b.dia),
        tipo_prenda_id: tid,
        cantidad: b.cantidad,
        motivo: b.motivo,
        autorizado_por: elegir(AUTORIZANTES),
      });
      stockRepo.crearMovimiento({
        fecha: diasAtras(b.dia),
        sector_id: roperia.id,
        tipo_prenda_id: tid,
        delta: -b.cantidad,
        motivo: b.motivo === 'ROTURA' ? 'BAJA_ROTURA' : 'BAJA_FIN_VIDA_UTIL',
        remito_id: null,
      });
    }

    // 9) Ciclos de vida útil por tipo (promedio acumulado, nivel lote). "Bata manga larga"
    //    queda cerca del fin de vida (pct 0.85) para disparar la alarma de reposición próxima.
    const hoy = diasAtras(0);
    for (const t of TIPOS) {
      const tid = tipoId.get(t.nombre);
      const factor = t.nombre === 'Bata manga larga' ? 0.85 : 0.2 + rnd() * 0.4;
      ciclosRepo.upsert(tid, Math.round(t.vida_util_ciclos * factor), hoy);
    }

    // 10) Preset "Ropa de Cirugía" (Quirófano) con los ítems de cirugía.
    const quirofano = sectorInfo.get('Quirófano');
    const CANT_PRESET = {
      'Cerrada de mesa': 4, 'Fenestrada grande': 4, 'Fenestrada chica': 6,
      'Compresa de toalla blanca': 12, 'Compresa de tela 80x80': 12, 'Bata manga larga': 8,
      'Sábana cerrada de traumatología': 3, 'Sábana grande': 6, 'Compresa de parto 1,60x1,80': 3,
      'Chaqueta': 8, 'Pantalón': 8, 'Bata manga corta': 6, 'Bolsillo': 6,
      'Compresa de mano': 12, 'Tira de valvas': 4,
    };
    presetsRepo.crear({
      nombre: 'Ropa de Cirugía',
      sector_id: quirofano.id,
      activo: 1,
      items: CIRUGIA.map((nombre) => ({ tipo_prenda_id: tipoId.get(nombre), cantidad: CANT_PRESET[nombre] })),
    });
  });

  imprimirResumen(db);
}

function imprimirResumen(db) {
  const nSectores = db.prepare('SELECT COUNT(*) AS n FROM sectores').get().n;
  const nTipos = db.prepare('SELECT COUNT(*) AS n FROM tipos_prenda').get().n;
  const nLavaderos = db.prepare('SELECT COUNT(*) AS n FROM lavaderos').get().n;
  const nPresets = db.prepare('SELECT COUNT(*) AS n FROM presets_carga').get().n;
  const nRemitos = db.prepare('SELECT COUNT(*) AS n FROM remitos').get().n;
  const porEstado = db.prepare('SELECT tipo, estado, COUNT(*) AS n FROM remitos GROUP BY tipo, estado ORDER BY tipo, estado').all();

  const linea = '─'.repeat(60);
  console.log(`\n${linea}`);
  console.log('🏥  Seed San Jerónimo cargado');
  console.log(linea);
  console.log(`   Lavaderos:  ${nLavaderos}   (${LAVADEROS.join(', ')})`);
  console.log(`   Sectores:   ${nSectores}   (${SECTORES.map((s) => s.nombre).join(', ')})`);
  console.log(`   Tipos:      ${nTipos}   (${GENERALES.length} generales + ${CIRUGIA.length} de cirugía)`);
  console.log(`   Presets:    ${nPresets}   ("Ropa de Cirugía" → Quirófano)`);
  console.log(`   Remitos:    ${nRemitos}`);
  for (const r of porEstado) console.log(`     • ${r.tipo} ${r.estado}: ${r.n}`);
  console.log(`   Usuarios:   admin/admin1234, super/super1234, oper/oper1234`);
  console.log(`${linea}\n`);
}

// Ejecución directa: `LAVATRACK_DB_PATH=<ruta> node server/src/db/seed-sanjeronimo.js`.
if (import.meta.url === `file://${process.argv[1]}`) {
  correrSeedSanJeronimo();
}
