// Controlador de presets de carga. Traduce HTTP ↔ presetService.
import * as presetService from '../services/presetService.js';
import { errorValidacion } from '../services/errores.js';

function idDe(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw errorValidacion('Id de preset inválido.');
  return id;
}

export function listar(req, res) {
  const filtros = {
    sector_id: req.query.sector_id ? Number(req.query.sector_id) : undefined,
    activo: req.query.activo != null ? req.query.activo === '1' || req.query.activo === 'true' : undefined,
  };
  res.json(presetService.listar(filtros));
}

export function crear(req, res) {
  res.status(201).json(presetService.crear(req.body || {}));
}

export function actualizar(req, res) {
  res.json(presetService.actualizar(idDe(req), req.body || {}));
}

export function eliminar(req, res) {
  presetService.eliminar(idDe(req));
  res.status(204).end();
}
