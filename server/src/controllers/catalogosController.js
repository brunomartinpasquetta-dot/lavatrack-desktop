// Controladores CRUD de tipos de prenda y sectores.
import { tiposService, sectoresService } from '../services/catalogosService.js';
import { errorValidacion } from '../services/errores.js';

function idParam(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw errorValidacion('Id inválido.');
  return id;
}

// --- Tipos de prenda ---
export const tipos = {
  listar: (req, res) => res.json(tiposService.listar()),
  crear: (req, res) => res.status(201).json(tiposService.crear(req.body || {})),
  actualizar: (req, res) => res.json(tiposService.actualizar(idParam(req), req.body || {})),
  eliminar: (req, res) => {
    tiposService.eliminar(idParam(req));
    res.status(204).end();
  },
};

// --- Sectores ---
export const sectores = {
  listar: (req, res) => res.json(sectoresService.listar()),
  crear: (req, res) => res.status(201).json(sectoresService.crear(req.body || {})),
  actualizar: (req, res) => res.json(sectoresService.actualizar(idParam(req), req.body || {})),
  eliminar: (req, res) => {
    sectoresService.eliminar(idParam(req));
    res.status(204).end();
  },
};
