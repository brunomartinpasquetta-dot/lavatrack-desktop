// Servicio de transportistas (Ola 4): valida y delega en el repo. La gestión (alta/uso)
// es OPERARIO+ y la edición SUPERVISOR+ (control de rol en las rutas). El soft-delete se
// hace poniendo activo=0 vía actualizar(); no hay borrado físico para preservar la
// referencia histórica desde remitos.transportista_id.
import { transportistasRepo } from '../db/repositorios.js';
import { errorValidacion, errorNoEncontrado } from './errores.js';

function validarNombre(nombre) {
  const n = typeof nombre === 'string' ? nombre.trim() : '';
  if (!n) throw errorValidacion('El nombre del transportista es obligatorio.');
  return n;
}

// documento/contacto son libres y opcionales; se normalizan a string trim (o '').
function normalizarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function traerOFallar(id) {
  const fila = transportistasRepo.obtener(id);
  if (!fila) throw errorNoEncontrado(`No existe el transportista ${id}.`);
  return fila;
}

export const transportistaService = {
  // listar({activo}): activo === true → solo activos; false → solo inactivos; undefined → todos.
  listar({ activo } = {}) {
    return transportistasRepo.listar({ activo });
  },

  crear({ nombre, documento, contacto } = {}) {
    const n = validarNombre(nombre);
    const id = transportistasRepo.crear({
      nombre: n,
      documento: normalizarTexto(documento),
      contacto: normalizarTexto(contacto),
      fecha_alta: new Date().toISOString(),
    });
    return transportistasRepo.obtener(id);
  },

  actualizar(id, { nombre, documento, contacto, activo } = {}) {
    const fila = traerOFallar(id);
    const n = validarNombre(nombre);
    // activo: si no viene en el body, se conserva el estado actual (update de perfil sin togglear).
    const nuevoActivo = activo === undefined ? fila.activo : (activo ? 1 : 0);
    return transportistasRepo.actualizar(id, {
      nombre: n,
      documento: normalizarTexto(documento),
      contacto: normalizarTexto(contacto),
      activo: nuevoActivo,
    });
  },
};
