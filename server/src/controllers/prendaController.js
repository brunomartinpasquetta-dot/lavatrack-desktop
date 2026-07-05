// Controlador de prendas identificadas (barcode-ready). Traduce HTTP ↔ prendaService.
import * as prendaService from '../services/prendaService.js';

export function listar(req, res) {
  const filtros = {
    estado: req.query.estado || null,
    tipo_prenda_id: req.query.tipo_prenda_id ? Number(req.query.tipo_prenda_id) : null,
  };
  res.json(prendaService.listar(filtros));
}

export function detalle(req, res) {
  res.json(prendaService.obtenerPorCodigo(req.params.codigo));
}

export function crear(req, res) {
  const { codigo, tipo_prenda_id, sector_actual_id } = req.body || {};
  res.status(201).json(
    prendaService.altaManual({
      codigo,
      tipo_prenda_id: Number(tipo_prenda_id),
      sector_actual_id: sector_actual_id != null ? Number(sector_actual_id) : null,
    })
  );
}
