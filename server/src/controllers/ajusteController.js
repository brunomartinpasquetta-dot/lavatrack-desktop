// Controlador de ajustes manuales de stock. Traduce HTTP ↔ ajusteService.
import * as ajusteService from '../services/ajusteService.js';

export function listar(req, res) {
  res.json(ajusteService.listar(req.query.desde || null, req.query.hasta || null));
}

export function crear(req, res) {
  const { sector_id, tipo_prenda_id, delta, motivo, autorizado_por, cofirma } = req.body || {};
  res.status(201).json(
    ajusteService.crear({
      sector_id: Number(sector_id),
      tipo_prenda_id: Number(tipo_prenda_id),
      delta: Number(delta),
      motivo,
      autorizado_por: autorizado_por || req.usuario?.nombre,
      cofirma,
      actorId: req.usuario?.sub,
    })
  );
}
