// Vida útil por ciclos a nivel LOTE (promedio de lavados por tipo de prenda).
// No seguimos cada prenda individual: mantenemos un promedio ponderado de ciclos
// acumulados por tipo, que sube con cada retorno (lavado) y se diluye con cada alta.
//
// FÓRMULAS (contrato):
//   circulante(tipo) = SUM(delta) de movimientos_stock del tipo (net owned).
//     Guard: si es <= 0 se trata como 0.
//   registrarCiclosRetorno(tipo, u, fecha):
//     C = circulante(tipo). Si C <= 0 → no cambia (no hay sobre qué prorratear).
//     ΔP = u / C ; P_new = P + ΔP.
//     // Cada unidad retornada hizo 1 ciclo de lavado; ese "trabajo" se prorratea
//     // sobre todo el circulante del tipo (promedio a nivel lote).
//   registrarDilucionAlta(tipo, n, fecha):
//     C_old = circulante(tipo) ANTES del alta.
//     P_new = (C_old + n > 0) ? P * C_old / (C_old + n) : 0.
//     // Las n unidades nuevas entran con 0 ciclos y diluyen el promedio existente.
//   alertas(): por tipo, pct = promedio / vida_util_ciclos.
//     estado: 'ok' (<0.8) | 'proxima' (>=0.8 y <1.0) | 'vencida' (>=1.0).
//     costo_estimado = (estado != 'ok') ? circulante * costo_reposicion_ars : 0.
import { ciclosRepo, stockRepo } from '../db/repositorios.js';

// Circulante con guard: nunca negativo.
function circulante(tipoId) {
  const c = stockRepo.circulantePorTipo(tipoId);
  return c > 0 ? c : 0;
}

// Un retorno = un lavado de esas unidades. Sube el promedio acumulado del tipo.
export function registrarCiclosRetorno(tipoId, unidadesRetornadas, fecha) {
  const u = Number(unidadesRetornadas) || 0;
  if (u <= 0) return;
  const C = circulante(tipoId);
  if (C <= 0) return; // sin circulante no hay sobre qué prorratear
  const actual = ciclosRepo.obtener(tipoId);
  const P = actual ? actual.ciclos_acumulados_promedio : 0;
  const P_new = P + u / C;
  ciclosRepo.upsert(tipoId, P_new, fecha || new Date().toISOString().slice(0, 10));
}

// Un alta (reposición) mete unidades con 0 ciclos → diluye el promedio.
// OJO: usar el circulante ANTES de que el alta impacte el kárdex.
export function registrarDilucionAlta(tipoId, unidadesNuevas, fecha, circulanteAntes) {
  const n = Number(unidadesNuevas) || 0;
  if (n <= 0) return;
  // Si el llamador no pasa el circulante previo, lo tomamos ahora (el movimiento del
  // alta debe crearse DESPUÉS de llamar a esta función para que C_old sea el correcto).
  const C_old = circulanteAntes !== undefined ? Math.max(0, circulanteAntes) : circulante(tipoId);
  const actual = ciclosRepo.obtener(tipoId);
  const P = actual ? actual.ciclos_acumulados_promedio : 0;
  const P_new = C_old + n > 0 ? (P * C_old) / (C_old + n) : 0;
  ciclosRepo.upsert(tipoId, P_new, fecha || new Date().toISOString().slice(0, 10));
}

// Estado del semáforo de vida útil según el porcentaje recorrido.
function estadoPct(pct) {
  if (pct >= 1.0) return 'vencida';
  if (pct >= 0.8) return 'proxima';
  return 'ok';
}

// Lista de todos los tipos con su promedio, pct, estado y costo estimado de reposición.
export function alertas() {
  return ciclosRepo.obtenerTodos().map((row) => {
    const promedio = row.ciclos_acumulados_promedio || 0;
    const vida = row.vida_util_ciclos || 0;
    const pct = vida > 0 ? promedio / vida : 0;
    const estado = estadoPct(pct);
    const circ = circulante(row.tipo_prenda_id);
    const costo_estimado = estado !== 'ok' ? circ * (row.costo_reposicion_ars || 0) : 0;
    return {
      tipo_prenda_id: row.tipo_prenda_id,
      tipo_prenda: row.tipo_prenda,
      promedio,
      vida_util_ciclos: vida,
      pct,
      circulante: circ,
      estado,
      costo_estimado,
    };
  });
}
