// Verificador de integridad del kárdex de LavaTrack.
// Corre chequeos de conciliación sobre movimientos_stock, bajas y ajustes.
// Uso: `npm run verificar-kardex` (desde la raíz) o `node server/scripts/verificar-kardex.js`.
// Exit 0 si todo concilia; exit 1 si hay discrepancias.
//
// QUIRK del entorno: el shell puede tener ELECTRON_RUN_AS_NODE=1. Este script no
// depende de eso: abre la base directamente con node:sqlite (read-only), sin arrancar
// el server ni correr migraciones, así funciona con o sin ese env.
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from '../src/db/connection.js';

function abrirDb() {
  try {
    return new DatabaseSync(DB_PATH, { readOnly: true });
  } catch {
    // Fallback si la build de node:sqlite no soporta readOnly.
    return new DatabaseSync(DB_PATH);
  }
}

const db = abrirDb();
const problemas = [];
const ok = [];

// --- Chequeo 1: stock derivado por (sector,tipo) sin negativos anómalos ---
const negativos = db
  .prepare(
    `SELECT ms.sector_id, ms.tipo_prenda_id, SUM(ms.delta) AS actual,
            s.nombre AS sector, tp.nombre AS tipo
     FROM movimientos_stock ms
     JOIN sectores s ON s.id = ms.sector_id
     JOIN tipos_prenda tp ON tp.id = ms.tipo_prenda_id
     GROUP BY ms.sector_id, ms.tipo_prenda_id
     HAVING SUM(ms.delta) < 0`
  )
  .all();
if (negativos.length) {
  for (const n of negativos) {
    problemas.push(`Stock NEGATIVO en ${n.sector} / ${n.tipo}: ${n.actual}`);
  }
} else {
  ok.push('Stock derivado por (sector,tipo): sin negativos anómalos.');
}

// --- Chequeo 2: bajas ↔ kárdex por motivo ---
// SUM(bajas.cantidad) por motivo debe igualar -SUM(delta) de su motivo de kárdex.
const MAPEO_BAJAS = [
  { baja: 'ROTURA', kardex: 'BAJA_ROTURA' },
  { baja: 'PERDIDA', kardex: 'BAJA_PERDIDA' },
  { baja: 'FIN_VIDA_UTIL', kardex: 'BAJA_FIN_VIDA_UTIL' },
];
const sumBajas = db.prepare(
  'SELECT COALESCE(SUM(cantidad),0) AS n FROM bajas WHERE motivo = ?'
);
const sumMov = db.prepare(
  'SELECT COALESCE(SUM(delta),0) AS n FROM movimientos_stock WHERE motivo = ?'
);
for (const m of MAPEO_BAJAS) {
  const bajasN = sumBajas.get(m.baja).n;
  const kardexN = -sumMov.get(m.kardex).n; // el kárdex de baja es negativo
  if (bajasN !== kardexN) {
    problemas.push(
      `Bajas ${m.baja} (${bajasN}) ≠ kárdex ${m.kardex} (${kardexN}).`
    );
  } else {
    ok.push(`Bajas ${m.baja} ↔ ${m.kardex}: ${bajasN} unidades conciliadas.`);
  }
}

// --- Chequeo 3: ajustes ↔ kárdex (motivo AJUSTE) por (sector,tipo) ---
const ajustesPorCelda = db
  .prepare(
    `SELECT sector_id, tipo_prenda_id, SUM(delta) AS d
     FROM ajustes GROUP BY sector_id, tipo_prenda_id`
  )
  .all();
const movAjustePorCelda = new Map(
  db
    .prepare(
      `SELECT sector_id, tipo_prenda_id, SUM(delta) AS d
       FROM movimientos_stock WHERE motivo = 'AJUSTE'
       GROUP BY sector_id, tipo_prenda_id`
    )
    .all()
    .map((r) => [`${r.sector_id}:${r.tipo_prenda_id}`, r.d])
);
const celdasVistas = new Set();
let ajustesConciliados = true;
for (const a of ajustesPorCelda) {
  const clave = `${a.sector_id}:${a.tipo_prenda_id}`;
  celdasVistas.add(clave);
  const movD = movAjustePorCelda.get(clave) ?? 0;
  if (a.d !== movD) {
    ajustesConciliados = false;
    problemas.push(
      `Ajustes (${a.sector_id}:${a.tipo_prenda_id}) delta=${a.d} ≠ kárdex AJUSTE delta=${movD}.`
    );
  }
}
// Movimientos AJUSTE sin ajuste registrado (huérfanos).
for (const [clave, movD] of movAjustePorCelda) {
  if (!celdasVistas.has(clave) && movD !== 0) {
    ajustesConciliados = false;
    problemas.push(`Kárdex AJUSTE (${clave}) delta=${movD} sin ajuste registrado.`);
  }
}
if (ajustesConciliados) {
  ok.push('Ajustes ↔ kárdex (motivo AJUSTE): conciliados por (sector,tipo).');
}

// --- Chequeo 4: ciclos_prenda sin nulls y promedios >= 0 ---
const ciclosMalos = db
  .prepare(
    `SELECT tipo_prenda_id FROM ciclos_prenda
     WHERE ciclos_acumulados_promedio IS NULL
        OR ciclos_acumulados_promedio < 0
        OR ultima_actualizacion IS NULL`
  )
  .all();
if (ciclosMalos.length) {
  for (const c of ciclosMalos) {
    problemas.push(`ciclos_prenda tipo ${c.tipo_prenda_id}: null o promedio negativo.`);
  }
} else {
  ok.push('ciclos_prenda: sin nulls, promedios >= 0.');
}

// --- Chequeo 5: reingreso de reproceso <= reproceso total, por (sector,tipo) (Ola 2, AUD-003) ---
// Lo mandado a relavado/costura por sector/tipo acota cuánto se puede reingresar.
const reprocesoTotal = new Map(
  db
    .prepare(
      `SELECT r.sector_id, ri.tipo_prenda_id,
              SUM(ri.cantidad_relavado + ri.cantidad_costura) AS total
       FROM remito_items ri JOIN remitos r ON r.id = ri.remito_id
       WHERE r.tipo = 'RETORNO'
       GROUP BY r.sector_id, ri.tipo_prenda_id`
    )
    .all()
    .map((r) => [`${r.sector_id}:${r.tipo_prenda_id}`, r.total])
);
const reingresado = db
  .prepare(
    `SELECT sector_id, tipo_prenda_id, SUM(delta) AS d
     FROM movimientos_stock WHERE motivo = 'REINGRESO_REPROCESO'
     GROUP BY sector_id, tipo_prenda_id`
  )
  .all();
let reprocesoOk = true;
for (const r of reingresado) {
  const total = reprocesoTotal.get(`${r.sector_id}:${r.tipo_prenda_id}`) ?? 0;
  if (r.d > total) {
    reprocesoOk = false;
    problemas.push(
      `Reingreso de reproceso (${r.sector_id}:${r.tipo_prenda_id}) ${r.d} > reproceso mandado ${total}.`
    );
  }
}
if (reprocesoOk) ok.push('Reingreso de reproceso ≤ reproceso mandado, por (sector,tipo).');

// --- Chequeo 6: prendas en lavandería >= 0 (reproceso pendiente global no negativo) ---
const totRepro = db
  .prepare(
    `SELECT COALESCE(SUM(cantidad_relavado + cantidad_costura),0) AS n
     FROM remito_items ri JOIN remitos r ON r.id = ri.remito_id WHERE r.tipo = 'RETORNO'`
  )
  .get().n;
const totReingreso = db
  .prepare(
    `SELECT COALESCE(SUM(delta),0) AS n FROM movimientos_stock WHERE motivo = 'REINGRESO_REPROCESO'`
  )
  .get().n;
const enviadasSinRetornar = db
  .prepare(
    `SELECT COALESCE(SUM(ri.cantidad),0) AS n
     FROM remito_items ri JOIN remitos r ON r.id = ri.remito_id
     WHERE r.tipo = 'ENVIO' AND r.estado = 'ENVIADO'`
  )
  .get().n;
const enLavanderia = enviadasSinRetornar + (totRepro - totReingreso);
if (enLavanderia < 0) {
  problemas.push(`Prendas en lavandería NEGATIVO: ${enLavanderia}.`);
} else {
  ok.push(`Prendas en lavandería >= 0 (${enLavanderia}).`);
}

db.close();

// --- Reporte ---
console.log('=== Verificación de kárdex LavaTrack ===');
console.log(`Base: ${DB_PATH}\n`);
for (const o of ok) console.log('  OK  ' + o);
if (problemas.length) {
  console.log('');
  for (const p of problemas) console.log('  ✗   ' + p);
  console.log(`\nRESULTADO: ${problemas.length} discrepancia(s).`);
  process.exit(1);
}
console.log('\nRESULTADO: 0 discrepancias. Kárdex consistente.');
process.exit(0);
