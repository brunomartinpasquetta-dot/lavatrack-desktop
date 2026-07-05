// Controlador de inventarios físicos ciegos. Traduce HTTP ↔ inventarioService.
import * as inventarioService from '../services/inventarioService.js';
import { errorValidacion } from '../services/errores.js';

function idDe(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw errorValidacion('Id de inventario inválido.');
  return id;
}

export function listar(req, res) {
  const filtros = {
    estado: req.query.estado || null,
    sector_id: req.query.sector_id ? Number(req.query.sector_id) : null,
  };
  res.json(inventarioService.listar(filtros));
}

export function detalle(req, res) {
  res.json(inventarioService.detalle(idDe(req)));
}

export function crear(req, res) {
  const { sector_id, usuario } = req.body || {};
  res.status(201).json(inventarioService.iniciar({ sector_id: Number(sector_id), usuario }));
}

export function conteo(req, res) {
  res.json(inventarioService.registrarConteo(idDe(req), req.body || {}));
}

export function cerrar(req, res) {
  res.json(inventarioService.cerrar(idDe(req), req.body || {}));
}
