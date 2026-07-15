// Controladores de transportistas (Ola 4). HTTP ↔ servicio; sin lógica de negocio acá.
import { transportistaService } from '../services/transportistaService.js';
import { errorValidacion } from '../services/errores.js';

function idParam(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw errorValidacion('Id inválido.');
  return id;
}

// ?activo=1|true → solo activos; ?activo=0|false → solo inactivos; ausente → todos.
function filtroActivo(req) {
  const q = req.query.activo;
  if (q === undefined || q === '') return undefined;
  if (q === '1' || q === 'true') return true;
  if (q === '0' || q === 'false') return false;
  return undefined;
}

export const transportistas = {
  listar: (req, res) => res.json(transportistaService.listar({ activo: filtroActivo(req) })),
  crear: (req, res) => res.status(201).json(transportistaService.crear(req.body || {})),
  actualizar: (req, res) => res.json(transportistaService.actualizar(idParam(req), req.body || {})),
};
