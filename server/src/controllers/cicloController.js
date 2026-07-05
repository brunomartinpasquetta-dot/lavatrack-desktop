// Controlador de vida útil por ciclos. Traduce HTTP ↔ cicloService.
import { alertas } from '../services/cicloService.js';

export function listar(req, res) {
  // Shape del contrato: { tipos: [ {tipo_prenda_id, tipo_prenda, promedio, vida_util_ciclos, pct, circulante, estado, costo_estimado} ] }
  res.json({ tipos: alertas() });
}
