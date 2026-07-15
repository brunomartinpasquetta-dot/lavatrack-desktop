// Controlador de reproceso (pendientes de reingreso y reingreso al stock). HTTP ↔ reprocesoService.
import * as reprocesoService from '../services/reprocesoService.js';

export function pendientes(req, res) {
  res.json(reprocesoService.pendientes());
}

export function reingresar(req, res) {
  const { sector_id, tipo_prenda_id, cantidad, fecha } = req.body || {};
  res.status(201).json(
    reprocesoService.reingresar({
      sector_id: Number(sector_id),
      tipo_prenda_id: Number(tipo_prenda_id),
      cantidad: Number(cantidad),
      fecha: fecha || null,
    })
  );
}
