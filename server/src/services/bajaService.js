// Bajas manuales de prendas (AUD-004): ROTURA o PÉRDIDA de un sector puntual.
// Exigen firma doble: el operario las origina y un supervisor (o admin) DISTINTO
// las co-firma. Cada baja descuenta stock del sector con un movimiento de kárdex
// (BAJA_ROTURA / BAJA_PERDIDA), todo en una sola transacción para que las bajas
// concilien con el kárdex por motivo.
import { bajasRepo, stockRepo, sectoresRepo, tiposRepo } from '../db/repositorios.js';
import { enTransaccion } from '../db/tx.js';
import { cofirmar } from './authService.js';
import { errorValidacion } from './errores.js';

// Motivo de la baja → motivo del movimiento de kárdex.
const MOTIVO_KARDEX = { ROTURA: 'BAJA_ROTURA', PERDIDA: 'BAJA_PERDIDA' };

export function listar(desde, hasta) {
  const hoy = new Date().toISOString().slice(0, 10);
  return bajasRepo.listar(desde || '0000-01-01', hasta || hoy);
}

// Stock actual del (sector, tipo) según el kárdex.
function stockActual(sectorId, tipoId) {
  const fila = stockRepo
    .matriz()
    .find((m) => m.sector_id === sectorId && m.tipo_prenda_id === tipoId);
  return fila ? fila.actual : 0;
}

export function crearBajaManual({ sector_id, tipo_prenda_id, cantidad, motivo, cofirma, actorId, actorNombre } = {}) {
  if (!sectoresRepo.obtener(sector_id)) {
    throw errorValidacion(`No existe el sector con id ${sector_id}.`);
  }
  if (!tiposRepo.obtener(tipo_prenda_id)) {
    throw errorValidacion(`No existe el tipo de prenda con id ${tipo_prenda_id}.`);
  }
  if (!MOTIVO_KARDEX[motivo]) {
    throw errorValidacion('El motivo de la baja debe ser ROTURA o PERDIDA.');
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw errorValidacion('La cantidad debe ser un entero mayor a cero.');
  }

  // Firma doble: valida al supervisor co-firmante (distinto del operario).
  const co = cofirmar({ ...(cofirma || {}), actorId });

  // Guard: no se puede dar de baja más de lo que hay en el sector.
  const disponible = stockActual(sector_id, tipo_prenda_id);
  if (cantidad > disponible) {
    throw errorValidacion(
      `No podés dar de baja más de lo que hay en el sector (disponible: ${disponible}).`
    );
  }

  const fecha = new Date().toISOString().slice(0, 10);
  return enTransaccion(() => {
    const id = bajasRepo.crear({
      fecha,
      sector_id,
      tipo_prenda_id,
      cantidad,
      motivo,
      autorizado_por: actorNombre || '',
      cofirmante: co.nombre,
    });
    stockRepo.crearMovimiento({
      fecha,
      sector_id,
      tipo_prenda_id,
      delta: -cantidad,
      motivo: MOTIVO_KARDEX[motivo],
      remito_id: null,
    });
    // Devolvemos la baja con sus JOINs (tipo_prenda, sector).
    const creada = bajasRepo.listar(fecha, fecha).find((b) => b.id === id);
    return creada || { id, fecha, sector_id, tipo_prenda_id, cantidad, motivo, autorizado_por: actorNombre || '', cofirmante: co.nombre };
  });
}
