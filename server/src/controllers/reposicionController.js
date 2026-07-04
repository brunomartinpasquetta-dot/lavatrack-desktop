// Controladores de "Reposición del día" y distribución interna.
import { calcularReposicion, generarDistribucion } from '../services/reposicionService.js';

export function reposicion(req, res) {
  res.json(calcularReposicion());
}

export function distribuir(req, res) {
  const distribucion = generarDistribucion(req.body || {});
  res.status(201).json(distribucion);
}
