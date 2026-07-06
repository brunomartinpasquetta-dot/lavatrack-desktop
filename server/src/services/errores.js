// Error de dominio con código HTTP asociado. El middleware central lo traduce
// a una respuesta JSON { error: mensaje } con el status correcto.
export class ErrorAPI extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
    this.name = 'ErrorAPI';
  }
}

export const errorValidacion = (msg) => new ErrorAPI(400, msg);
export const errorAuth = (msg) => new ErrorAPI(401, msg);
export const errorProhibido = (msg) => new ErrorAPI(403, msg);
export const errorNoEncontrado = (msg) => new ErrorAPI(404, msg);
export const errorConflicto = (msg) => new ErrorAPI(409, msg);
