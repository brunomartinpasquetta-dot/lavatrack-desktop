// Controladores de "Reposición del día" y distribución interna.
import { calcularReposicion, generarDistribucion } from '../services/reposicionService.js';

export function reposicion(req, res) {
  res.json(calcularReposicion());
}

export function distribuir(req, res) {
  // AUD-010: header Idempotency-Key opcional para evitar duplicar la distribución en reintentos.
  const idempotencyKey = (req.get('Idempotency-Key') || '').trim() || null;
  const distribucion = generarDistribucion(req.body || {}, idempotencyKey);
  res.status(201).json(distribucion);
}
