// Manejo de errores centralizado: convierte cualquier error en { error: mensaje } con su status.
import { ErrorAPI } from '../services/errores.js';

// Middleware 404 para rutas de API no encontradas.
export function noEncontrado(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// Middleware de error (4 argumentos: Express lo reconoce como manejador de errores).
export function manejadorErrores(err, req, res, next) {
  // Errores de dominio (incluye 401/403 de auth): status + mensaje propio.
  if (err instanceof ErrorAPI) {
    return res.status(err.status).json({ error: err.message });
  }
  // Errores de cliente con status conocido (ej. body-parser: PayloadTooLargeError 413,
  // JSON malformado 400). Respetamos su status; el mensaje de estas libs es seguro.
  const status = Number(err && (err.status || err.statusCode));
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ error: err.message || 'Solicitud inválida.' });
  }
  // Errores no controlados: log en consola y 500 genérico (sin filtrar detalles internos ni stack).
  console.error('[LavaTrack] Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}
