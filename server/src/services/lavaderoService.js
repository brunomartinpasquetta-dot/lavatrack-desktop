// Servicio de lavaderos (San Jerónimo): valida y delega en el repo. La gestión (alta/uso)
// es OPERARIO+ y la edición SUPERVISOR+ (control de rol en las rutas). El soft-delete se
// hace poniendo activo=0 vía actualizar(); no hay borrado físico para preservar la
// referencia histórica desde remitos.lavadero_id.
import { lavaderosRepo } from '../db/repositorios.js';
import { errorValidacion, errorNoEncontrado } from './errores.js';

function validarNombre(nombre) {
  const n = typeof nombre === 'string' ? nombre.trim() : '';
  if (!n) throw errorValidacion('El nombre del lavadero es obligatorio.');
  return n;
}

function traerOFallar(id) {
  const fila = lavaderosRepo.obtener(id);
  if (!fila) throw errorNoEncontrado(`No existe el lavadero ${id}.`);
  return fila;
}

export const lavaderoService = {
  // listar({activo}): activo === true → solo activos; false → solo inactivos; undefined → todos.
  listar({ activo } = {}) {
    return lavaderosRepo.listar({ activo });
  },

  crear({ nombre } = {}) {
    const n = validarNombre(nombre);
    const id = lavaderosRepo.crear({
      nombre: n,
      fecha_alta: new Date().toISOString(),
    });
    return lavaderosRepo.obtener(id);
  },

  actualizar(id, { nombre, activo } = {}) {
    const fila = traerOFallar(id);
    const n = validarNombre(nombre);
    // activo: si no viene en el body, se conserva el estado actual (update de perfil sin togglear).
    const nuevoActivo = activo === undefined ? fila.activo : (activo ? 1 : 0);
    return lavaderosRepo.actualizar(id, { nombre: n, activo: nuevoActivo });
  },
};
