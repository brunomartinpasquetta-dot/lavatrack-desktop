// Servicio de autenticación: login (verifica credenciales, emite token) y
// resolución del usuario actual a partir del payload del token.
import { usuariosRepo } from '../db/repositorios.js';
import { verifyPassword, signToken } from './authUtil.js';
import { errorValidacion, errorAuth } from './errores.js';

// Datos públicos del usuario (nunca exponen hash/salt).
function usuarioPublico(fila) {
  return { id: fila.id, usuario: fila.usuario, nombre: fila.nombre, rol: fila.rol };
}

// Roles habilitados para co-firmar (SUPERVISOR o superior).
const ROLES_COFIRMA = ['SUPERVISOR', 'ADMIN'];

// Valida una co-firma (firma doble): un 2º usuario, DISTINTO del actor, activo,
// con rol >= SUPERVISOR y contraseña correcta. Devuelve el usuario público del
// co-firmante o lanza un error de dominio con mensaje claro (sin filtrar si el
// usuario existe o no: las credenciales siempre dan un mensaje genérico).
export function cofirmar({ usuario, password, actorId } = {}) {
  if (!usuario || typeof usuario !== 'string' || !password || typeof password !== 'string') {
    throw errorValidacion('La co-firma requiere usuario y contraseña de un supervisor.');
  }
  const fila = usuariosRepo.obtenerPorUsuario(usuario.trim());
  const credencialesMal = () => errorAuth('Credenciales de co-firma inválidas.');
  // Usuario inexistente o inactivo o clave incorrecta → mensaje genérico (no filtramos existencia).
  if (!fila || !fila.activo) throw credencialesMal();
  if (!verifyPassword(password, fila.password_hash, fila.password_salt)) throw credencialesMal();
  // Debe ser un supervisor DISTINTO del operario que originó la acción.
  if (actorId != null && fila.id === actorId) {
    throw errorValidacion('La co-firma debe ser de un supervisor distinto al operario.');
  }
  if (!ROLES_COFIRMA.includes(fila.rol)) {
    throw errorValidacion('La co-firma debe ser de un supervisor distinto al operario.');
  }
  return usuarioPublico(fila);
}

export const authService = {
  // Valida usuario activo + contraseña. OK → { token, usuario }. Mal → 401 genérico.
  login({ usuario, password } = {}) {
    if (!usuario || typeof usuario !== 'string' || !password || typeof password !== 'string') {
      throw errorValidacion('Usuario y contraseña son obligatorios.');
    }
    const fila = usuariosRepo.obtenerPorUsuario(usuario.trim());
    // Mensaje único para no filtrar si el usuario existe o no.
    const credencialesMal = () => errorAuth('Usuario o contraseña incorrectos.');
    if (!fila || !fila.activo) throw credencialesMal();
    if (!verifyPassword(password, fila.password_hash, fila.password_salt)) throw credencialesMal();

    const pub = usuarioPublico(fila);
    const token = signToken({ sub: pub.id, usuario: pub.usuario, rol: pub.rol, nombre: pub.nombre });
    return { token, usuario: pub };
  },

  // Resuelve el usuario actual desde el payload ya verificado (req.usuario).
  // Relee la fila fresca (por si cambió rol/estado) y rechaza si fue desactivado.
  meDe(payload) {
    if (!payload || !payload.sub) throw errorAuth('Token inválido.');
    const fila = usuariosRepo.obtener(payload.sub);
    if (!fila || !fila.activo) throw errorAuth('La sesión ya no es válida.');
    return { usuario: usuarioPublico(fila) };
  },
};
