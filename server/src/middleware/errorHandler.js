// Manejo de errores centralizado: convierte cualquier error en { error: mensaje } con su status.
import { ErrorAPI } from '../services/errores.js';

// Middleware 404 para rutas de API no encontradas.
export function noEncontrado(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// Middleware de error (4 argumentos: Express lo reconoce como manejador de errores).
export function manejadorErrores(err, req, res, next) {
  if (err instanceof ErrorAPI) {
    return res.status(err.status).json({ error: err.message });
  }
  // Errores no controlados: log en consola y 500 genérico (sin filtrar detalles internos).
  console.error('[LavaTrack] Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}
