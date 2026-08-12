// Controladores de lavaderos (San Jerónimo). HTTP ↔ servicio; sin lógica de negocio acá.
import { lavaderoService } from '../services/lavaderoService.js';
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

export const lavaderos = {
  listar: (req, res) => res.json(lavaderoService.listar({ activo: filtroActivo(req) })),
  crear: (req, res) => res.status(201).json(lavaderoService.crear(req.body || {})),
  actualizar: (req, res) => res.json(lavaderoService.actualizar(idParam(req), req.body || {})),
};
