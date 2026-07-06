// Servicio de autenticación: login (verifica credenciales, emite token) y
// resolución del usuario actual a partir del payload del token.
import { usuariosRepo } from '../db/repositorios.js';
import { verifyPassword, signToken } from './authUtil.js';
import { errorValidacion, errorAuth } from './errores.js';

// Datos públicos del usuario (nunca exponen hash/salt).
function usuarioPublico(fila) {
  return { id: fila.id, usuario: fila.usuario, nombre: fila.nombre, rol: fila.rol };
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
