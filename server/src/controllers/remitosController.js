// Controladores de remitos: traducen HTTP ↔ servicios. Sin lógica de negocio acá.
import { remitosRepo } from '../db/repositorios.js';
import { crearRemito, construirDetalle, conciliar } from '../services/remitosService.js';
import { errorValidacion } from '../services/errores.js';

// GET /api/remitos
// Contrato de compatibilidad (AUD-012):
//  - SIN ?page ni ?limit  → devuelve el ARRAY plano de remitos (como siempre). Lo consumen
//    Dashboard, el badge del Sidebar (?estado=ENVIADO), Retornos y Reportes.
//  - CON ?page y/o ?limit  → devuelve { items, total, limit, offset } para paginar.
// Los filtros (estado/tipo/sector_id/desde/hasta) aplican en ambos modos.
export function listar(req, res) {
  const filtros = {
    estado: req.query.estado || null,
    tipo: req.query.tipo || null,
    sector_id: req.query.sector_id ? Number(req.query.sector_id) : null,
    desde: req.query.desde || null,
    hasta: req.query.hasta || null,
  };

  const pide = req.query.page !== undefined || req.query.limit !== undefined;
  if (!pide) {
    // Modo compat: array plano.
    return res.json(remitosRepo.listar(filtros));
  }

  // Modo paginado. limit por defecto 50, acotado 1..200. page arranca en 1.
  let limit = Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit <= 0) limit = 50;
  limit = Math.min(limit, 200);
  let page = Number.parseInt(req.query.page, 10);
  if (!Number.isInteger(page) || page <= 0) page = 1;
  const offset = (page - 1) * limit;

  const items = remitosRepo.listar({ ...filtros, limit, offset });
  const total = remitosRepo.contar(filtros);
  res.json({ items, total, limit, offset });
}

export function detalle(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw errorValidacion('Id de remito inválido.');
  res.json(construirDetalle(id));
}

export function crear(req, res) {
  // AUD-010: si el cliente manda el header Idempotency-Key, un reintento con la misma key
  // devuelve el remito ya creado en lugar de duplicarlo. Los headers de Node llegan en minúscula.
  const idempotencyKey = (req.get('Idempotency-Key') || '').trim() || null;
  const detalle = crearRemito(req.body || {}, idempotencyKey);
  res.status(201).json(detalle);
}

export function conciliarRemito(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw errorValidacion('Id de remito inválido.');
  res.json(conciliar(id));
}
