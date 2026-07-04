// Controladores de remitos: traducen HTTP ↔ servicios. Sin lógica de negocio acá.
import { remitosRepo } from '../db/repositorios.js';
import { crearRemito, construirDetalle, conciliar } from '../services/remitosService.js';
import { errorValidacion } from '../services/errores.js';

export function listar(req, res) {
  const filtros = {
    estado: req.query.estado || null,
    tipo: req.query.tipo || null,
    sector_id: req.query.sector_id ? Number(req.query.sector_id) : null,
    desde: req.query.desde || null,
    hasta: req.query.hasta || null,
  };
  res.json(remitosRepo.listar(filtros));
}

export function detalle(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw errorValidacion('Id de remito inválido.');
  res.json(construirDetalle(id));
}

export function crear(req, res) {
  const detalle = crearRemito(req.body || {});
  res.status(201).json(detalle);
}

export function conciliarRemito(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw errorValidacion('Id de remito inválido.');
  res.json(conciliar(id));
}
