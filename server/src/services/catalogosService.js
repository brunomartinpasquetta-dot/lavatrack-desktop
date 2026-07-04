// CRUD de catálogos: tipos de prenda y sectores, con validaciones básicas.
import { tiposRepo, sectoresRepo } from '../db/repositorios.js';
import { errorValidacion, errorNoEncontrado } from './errores.js';

// --- Tipos de prenda ---

function validarTipo(body) {
  if (!body.nombre || typeof body.nombre !== 'string') {
    throw errorValidacion('El tipo de prenda necesita un nombre.');
  }
  for (const campo of ['peso_promedio_gr', 'vida_util_ciclos', 'costo_reposicion_ars']) {
    if (!Number.isInteger(body[campo]) || body[campo] < 0) {
      throw errorValidacion(`El campo '${campo}' debe ser un entero ≥ 0.`);
    }
  }
}

export const tiposService = {
  listar: () => tiposRepo.listar(),
  crear(body) {
    validarTipo(body);
    return tiposRepo.crear(body);
  },
  actualizar(id, body) {
    if (!tiposRepo.obtener(id)) throw errorNoEncontrado(`No existe el tipo de prenda ${id}.`);
    validarTipo(body);
    return tiposRepo.actualizar(id, body);
  },
  eliminar(id) {
    if (!tiposRepo.obtener(id)) throw errorNoEncontrado(`No existe el tipo de prenda ${id}.`);
    tiposRepo.eliminar(id);
  },
};

// --- Sectores ---

const METODOS_REPOSICION = ['PAR', 'CARRO_INTERCAMBIO', 'PEDIDO'];

function validarSector(body) {
  if (!body.nombre || typeof body.nombre !== 'string') {
    throw errorValidacion('El sector necesita un nombre.');
  }
  if (body.stock_minimo && typeof body.stock_minimo !== 'object') {
    throw errorValidacion("El campo 'stock_minimo' debe ser un objeto { tipo_prenda_id: cantidad }.");
  }
  if (body.metodo_reposicion && !METODOS_REPOSICION.includes(body.metodo_reposicion)) {
    throw errorValidacion('El método de reposición debe ser PAR, CARRO_INTERCAMBIO o PEDIDO.');
  }
}

export const sectoresService = {
  listar: () => sectoresRepo.listar(),
  crear(body) {
    validarSector(body);
    return sectoresRepo.crear(body);
  },
  actualizar(id, body) {
    if (!sectoresRepo.obtener(id)) throw errorNoEncontrado(`No existe el sector ${id}.`);
    validarSector(body);
    return sectoresRepo.actualizar(id, body);
  },
  eliminar(id) {
    if (!sectoresRepo.obtener(id)) throw errorNoEncontrado(`No existe el sector ${id}.`);
    sectoresRepo.eliminar(id);
  },
};
