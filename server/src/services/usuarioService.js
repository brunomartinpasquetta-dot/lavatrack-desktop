// Servicio de administración de usuarios (solo ADMIN). Valida, hashea claves y
// protege al "último ADMIN activo" (no se lo puede desactivar ni rebajar de rol).
import { usuariosRepo } from '../db/repositorios.js';
import { hashPassword } from './authUtil.js';
import { errorValidacion, errorNoEncontrado, errorConflicto } from './errores.js';

const ROLES = ['ADMIN', 'SUPERVISOR', 'OPERARIO'];

function validarUsuarioStr(usuario) {
  if (!usuario || typeof usuario !== 'string' || !usuario.trim()) {
    throw errorValidacion('El nombre de usuario es obligatorio.');
  }
  const u = usuario.trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(u)) {
    throw errorValidacion('El usuario debe tener 3 a 32 caracteres (letras, números, . _ -).');
  }
  return u;
}
function validarNombre(nombre) {
  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    throw errorValidacion('El nombre es obligatorio.');
  }
  return nombre.trim();
}
function validarRol(rol) {
  if (!ROLES.includes(rol)) throw errorValidacion(`Rol inválido. Debe ser uno de: ${ROLES.join(', ')}.`);
  return rol;
}
function validarPassword(password) {
  if (!password || typeof password !== 'string' || password.length < 4) {
    throw errorValidacion('La contraseña debe tener al menos 4 caracteres.');
  }
  return password;
}
function traerOFallar(id) {
  const fila = usuariosRepo.obtener(id);
  if (!fila) throw errorNoEncontrado(`No existe el usuario ${id}.`);
  return fila;
}
// Guard del último ADMIN activo: no permitir dejar el sistema sin ningún ADMIN.
// Se invoca cuando un usuario que HOY es ADMIN activo va a dejar de serlo
// (por desactivación o por cambio de rol).
function protegerUltimoAdmin(filaActual) {
  if (filaActual.rol === 'ADMIN' && filaActual.activo) {
    if (usuariosRepo.contarPorRol('ADMIN') <= 1) {
      throw errorConflicto('No se puede dejar el sistema sin ningún administrador activo.');
    }
  }
}

export const usuarioService = {
  listar: () => usuariosRepo.listar(),

  crear({ usuario, nombre, rol, password } = {}) {
    const u = validarUsuarioStr(usuario);
    const n = validarNombre(nombre);
    const r = validarRol(rol);
    const p = validarPassword(password);
    if (usuariosRepo.existeUsuario(u)) {
      throw errorConflicto(`Ya existe un usuario '${u}'.`);
    }
    const { hash, salt } = hashPassword(p);
    const id = usuariosRepo.crear({
      usuario: u,
      nombre: n,
      rol: r,
      password_hash: hash,
      password_salt: salt,
      fecha_alta: new Date().toISOString(),
    });
    return usuariosRepo.obtener(id);
  },

  actualizar(id, { nombre, rol, activo } = {}) {
    const fila = traerOFallar(id);
    const n = validarNombre(nombre);
    const r = validarRol(rol);
    const nuevoActivo = activo ? 1 : 0;

    // Si este usuario es el último ADMIN activo y se lo quiere desactivar o rebajar → bloquear.
    if (r !== 'ADMIN' || !nuevoActivo) {
      protegerUltimoAdmin(fila);
    }
    return usuariosRepo.actualizar(id, { nombre: n, rol: r, activo: nuevoActivo });
  },

  resetPassword(id, password) {
    traerOFallar(id);
    const p = validarPassword(password);
    const { hash, salt } = hashPassword(p);
    usuariosRepo.setPassword(id, { password_hash: hash, password_salt: salt });
    return { ok: true };
  },

  setActivo(id, activo) {
    const fila = traerOFallar(id);
    const nuevoActivo = activo ? 1 : 0;
    if (!nuevoActivo) protegerUltimoAdmin(fila); // no desactivar al último ADMIN
    usuariosRepo.actualizar(id, { nombre: fila.nombre, rol: fila.rol, activo: nuevoActivo });
    return usuariosRepo.obtener(id);
  },
};
