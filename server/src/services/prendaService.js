// Prendas identificadas (barcode-ready): seguimiento individual por código único.
// Se usa opcionalmente por línea de remito (item.codigos) y también con alta manual.
import { prendasRepo, tiposRepo, sectoresRepo } from '../db/repositorios.js';
import { errorValidacion, errorNoEncontrado } from './errores.js';

export function listar({ estado, tipo_prenda_id } = {}) {
  return prendasRepo.listar({ estado, tipo_prenda_id });
}

export function obtenerPorCodigo(codigo) {
  const prenda = prendasRepo.obtenerPorCodigo(codigo);
  if (!prenda) throw errorNoEncontrado(`No existe la prenda con código ${codigo}.`);
  return prenda;
}

// Valida los códigos de una línea de remito. Devuelve las filas de prenda encontradas.
// - len(codigos) <= item.cantidad
// - cada código existe y es del tipo de prenda de la línea
export function validarCodigosItem(item, tipoNombre) {
  const codigos = item.codigos;
  if (!Array.isArray(codigos) || codigos.length === 0) return [];
  if (codigos.length > item.cantidad) {
    throw errorValidacion(
      `La línea tiene ${codigos.length} códigos pero la cantidad es ${item.cantidad}. ` +
        'No puede haber más códigos que unidades.'
    );
  }
  const nombre = tipoNombre || tiposRepo.obtener(item.tipo_prenda_id)?.nombre || 'esta prenda';
  const prendas = [];
  for (const codigo of codigos) {
    const prenda = prendasRepo.obtenerPorCodigo(codigo);
    if (!prenda) {
      throw errorValidacion(`El código ${codigo} no está registrado.`);
    }
    if (prenda.tipo_prenda_id !== item.tipo_prenda_id) {
      throw errorValidacion(`El código ${codigo} no corresponde a ${nombre}.`);
    }
    prendas.push(prenda);
  }
  return prendas;
}

// Envío: cada prenda identificada de la línea pasa a EN_LAVANDERIA (fuera del sector).
export function aplicarEnvio(item, sector_id, fecha) {
  if (!Array.isArray(item.codigos) || item.codigos.length === 0) return;
  for (const codigo of item.codigos) {
    prendasRepo.actualizar(codigo, { estado: 'EN_LAVANDERIA', sector_actual_id: null });
  }
}

// Retorno: las que reingresan vuelven a EN_SECTOR (ciclos +1); la porción de descarte
// se da de baja. Simplificación: se dan de baja los primeros `descarte` códigos.
export function aplicarRetorno(item, sector_id, fecha) {
  if (!Array.isArray(item.codigos) || item.codigos.length === 0) return;
  const descarte = item.cantidad_descarte || 0;
  item.codigos.forEach((codigo, idx) => {
    if (idx < descarte) {
      prendasRepo.actualizar(codigo, {
        estado: 'BAJA',
        sector_actual_id: null,
        fecha_baja: fecha,
      });
    } else {
      const actual = prendasRepo.obtenerPorCodigo(codigo);
      const ciclos = (actual?.ciclos || 0) + 1;
      prendasRepo.actualizar(codigo, {
        estado: 'EN_SECTOR',
        sector_actual_id: sector_id,
        ciclos,
      });
    }
  });
}

// Alta manual de una prenda identificada.
export function altaManual({ codigo, tipo_prenda_id, sector_actual_id }) {
  if (!codigo || !String(codigo).trim()) {
    throw errorValidacion('El código no puede estar vacío.');
  }
  const cod = String(codigo).trim();
  if (prendasRepo.existeCodigo(cod)) {
    throw errorValidacion(`Ya existe una prenda con el código ${cod}.`);
  }
  if (!tiposRepo.obtener(tipo_prenda_id)) {
    throw errorValidacion(`No existe el tipo de prenda con id ${tipo_prenda_id}.`);
  }
  if (sector_actual_id != null && !sectoresRepo.obtener(sector_actual_id)) {
    throw errorValidacion(`No existe el sector con id ${sector_actual_id}.`);
  }
  prendasRepo.crear({
    codigo: cod,
    tipo_prenda_id,
    sector_actual_id: sector_actual_id ?? null,
    fecha_alta: new Date().toISOString().slice(0, 10),
  });
  return prendasRepo.obtenerPorCodigo(cod);
}
