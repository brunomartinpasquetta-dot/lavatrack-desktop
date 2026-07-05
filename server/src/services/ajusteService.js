// Ajustes manuales de stock (correcciones y robos/pérdidas internas).
// Cada ajuste genera su movimiento AJUSTE en el kárdex, en una sola transacción,
// para que ajustes ↔ movimientos AJUSTE concilien por (sector, tipo).
import { ajustesRepo, stockRepo, sectoresRepo, tiposRepo } from '../db/repositorios.js';
import { enTransaccion } from '../db/tx.js';
import { errorValidacion } from './errores.js';

const MOTIVOS_MANUALES = ['CORRECCION', 'ROBO_PERDIDA'];

export function listar(desde, hasta) {
  const hoy = new Date().toISOString().slice(0, 10);
  return ajustesRepo.listar(desde || '0000-01-01', hasta || hoy);
}

export function crear({ sector_id, tipo_prenda_id, delta, motivo, autorizado_por }) {
  if (!sectoresRepo.obtener(sector_id)) {
    throw errorValidacion(`No existe el sector con id ${sector_id}.`);
  }
  if (!tiposRepo.obtener(tipo_prenda_id)) {
    throw errorValidacion(`No existe el tipo de prenda con id ${tipo_prenda_id}.`);
  }
  if (!MOTIVOS_MANUALES.includes(motivo)) {
    throw errorValidacion("El motivo debe ser CORRECCION o ROBO_PERDIDA.");
  }
  if (!Number.isInteger(delta) || delta === 0) {
    throw errorValidacion('El ajuste (delta) debe ser un entero distinto de cero.');
  }

  const fecha = new Date().toISOString().slice(0, 10);
  return enTransaccion(() => {
    const id = ajustesRepo.crear({
      fecha,
      sector_id,
      tipo_prenda_id,
      delta,
      motivo,
      autorizado_por: autorizado_por || '',
      inventario_id: null,
    });
    stockRepo.crearMovimiento({
      fecha,
      sector_id,
      tipo_prenda_id,
      delta,
      motivo: 'AJUSTE',
      remito_id: null,
    });
    // Devolvemos el ajuste con sus JOINs (tipo_prenda, sector).
    const creado = ajustesRepo.listar(fecha, fecha).find((a) => a.id === id);
    return creado || { id, fecha, sector_id, tipo_prenda_id, delta, motivo, autorizado_por: autorizado_por || '', inventario_id: null };
  });
}
