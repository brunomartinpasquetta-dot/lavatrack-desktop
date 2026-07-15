// Controlador de bajas manuales (ROTURA / PÉRDIDA con firma doble). HTTP ↔ bajaService.
import * as bajaService from '../services/bajaService.js';

export function listar(req, res) {
  res.json(bajaService.listar(req.query.desde || null, req.query.hasta || null));
}

export function crear(req, res) {
  const { sector_id, tipo_prenda_id, cantidad, motivo, cofirma } = req.body || {};
  res.status(201).json(
    bajaService.crearBajaManual({
      sector_id: Number(sector_id),
      tipo_prenda_id: Number(tipo_prenda_id),
      cantidad: Number(cantidad),
      motivo,
      cofirma,
      actorId: req.usuario?.sub,
      actorNombre: req.usuario?.nombre,
    })
  );
}
