// Presets de carga: plantillas de líneas {tipo, cantidad} reutilizables en remitos
// y reposición. CRUD directo sobre presetsRepo con validaciones básicas.
import { presetsRepo, sectoresRepo, tiposRepo } from '../db/repositorios.js';
import { errorValidacion, errorNoEncontrado } from './errores.js';

export function listar({ sector_id, activo } = {}) {
  return presetsRepo.listar({ sector_id, activo });
}

export function obtener(id) {
  const preset = presetsRepo.obtener(id);
  if (!preset) throw errorNoEncontrado(`No se encontró el preset ${id}.`);
  return preset;
}

// Valida nombre, sector (si viene) e items con cantidad > 0.
function validar({ nombre, sector_id, items }) {
  if (!nombre || !String(nombre).trim()) {
    throw errorValidacion('El nombre del preset no puede estar vacío.');
  }
  if (sector_id != null && !sectoresRepo.obtener(sector_id)) {
    throw errorValidacion(`No existe el sector con id ${sector_id}.`);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw errorValidacion('El preset debe tener al menos una línea.');
  }
  for (const it of items) {
    if (!tiposRepo.obtener(it.tipo_prenda_id)) {
      throw errorValidacion(`No existe el tipo de prenda con id ${it.tipo_prenda_id}.`);
    }
    if (!Number.isInteger(it.cantidad) || it.cantidad <= 0) {
      throw errorValidacion('Cada línea del preset debe tener una cantidad entera mayor a 0.');
    }
  }
}

export function crear(payload) {
  validar(payload);
  const id = presetsRepo.crear({
    nombre: String(payload.nombre).trim(),
    sector_id: payload.sector_id ?? null,
    activo: payload.activo,
    items: payload.items,
  });
  return presetsRepo.obtener(id);
}

export function actualizar(id, payload) {
  if (!presetsRepo.obtener(id)) throw errorNoEncontrado(`No se encontró el preset ${id}.`);
  validar(payload);
  return presetsRepo.actualizar(id, {
    nombre: String(payload.nombre).trim(),
    sector_id: payload.sector_id ?? null,
    activo: payload.activo,
    items: payload.items,
  });
}

export function eliminar(id) {
  if (!presetsRepo.obtener(id)) throw errorNoEncontrado(`No se encontró el preset ${id}.`);
  presetsRepo.eliminar(id);
}
