// Middleware de autenticación y autorización.
// - autenticar: exige un Bearer token válido; deja el payload en req.usuario.
// - requireRol / rolAlMenos: control de acceso por rol con jerarquía.
import { verifyToken } from '../services/authUtil.js';
import { errorAuth, errorProhibido } from '../services/errores.js';

// Jerarquía de roles (mayor número = más privilegios).
const JERARQUIA = { OPERARIO: 1, SUPERVISOR: 2, ADMIN: 3 };

// Lee el token del header Authorization: Bearer <token>. Si no hay o es inválido → 401.
export function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const [esquema, token] = header.split(' ');
  if (esquema !== 'Bearer' || !token) {
    return next(errorAuth('Falta el token de autenticación.'));
  }
  const payload = verifyToken(token);
  if (!payload) {
    return next(errorAuth('Token inválido o expirado.'));
  }
  req.usuario = payload;
  next();
}

// ¿El usuario del request tiene al menos el rol indicado (por jerarquía)?
export function rolAlMenos(req, rolMinimo) {
  const actual = JERARQUIA[req.usuario?.rol] || 0;
  const minimo = JERARQUIA[rolMinimo] || 0;
  return actual >= minimo && actual > 0;
}

// Exige que el rol del usuario esté a la altura del MENOR de los roles pedidos
// (por jerarquía). Ej: requireRol('SUPERVISOR') deja pasar SUPERVISOR y ADMIN.
export function requireRol(...roles) {
  const minimo = Math.min(...roles.map((r) => JERARQUIA[r] || Infinity));
  return (req, res, next) => {
    if (!req.usuario) return next(errorAuth('No autenticado.'));
    const actual = JERARQUIA[req.usuario.rol] || 0;
    if (actual < minimo) {
      return next(errorProhibido('No tenés permisos para esta acción.'));
    }
    next();
  };
}
