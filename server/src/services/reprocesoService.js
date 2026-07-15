// Reingreso de reproceso (AUD-003): las prendas categorizadas como relavado/costura
// en los retornos quedan "en la lavandería" hasta que vuelven reparadas. Al reingresar,
// se suman al stock del sector con un movimiento de kárdex motivo REINGRESO_REPROCESO
// (delta positivo). No hay doble conteo: relavado/costura nunca sumaron al stock del sector.
import { reprocesoRepo, stockRepo, sectoresRepo, tiposRepo } from '../db/repositorios.js';
import { enTransaccion } from '../db/tx.js';
import { errorValidacion } from './errores.js';

// Lista de pendientes por (sector, tipo), con nombres y cantidad pendiente > 0.
export function pendientes() {
  return reprocesoRepo.reprocesoPendiente();
}

export function reingresar({ sector_id, tipo_prenda_id, cantidad, fecha } = {}) {
  const sector = sectoresRepo.obtener(sector_id);
  if (!sector) {
    throw errorValidacion(`No existe el sector con id ${sector_id}.`);
  }
  const tipo = tiposRepo.obtener(tipo_prenda_id);
  if (!tipo) {
    throw errorValidacion(`No existe el tipo de prenda con id ${tipo_prenda_id}.`);
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw errorValidacion('La cantidad debe ser un entero mayor a cero.');
  }

  // Guard: no se puede reingresar más de lo que está en reproceso.
  const pendiente = reprocesoRepo.pendienteDe(sector_id, tipo_prenda_id);
  if (cantidad > pendiente) {
    throw errorValidacion(
      `No podés reingresar más de lo que está en reproceso (pendiente: ${pendiente}).`
    );
  }

  const fechaMov = fecha || new Date().toISOString().slice(0, 10);
  return enTransaccion(() => {
    stockRepo.crearMovimiento({
      fecha: fechaMov,
      sector_id,
      tipo_prenda_id,
      delta: cantidad,
      motivo: 'REINGRESO_REPROCESO',
      remito_id: null,
    });
    return { ok: true, sector: sector.nombre, tipo_prenda: tipo.nombre, cantidad };
  });
}
