// Controladores de administración de usuarios (solo ADMIN). HTTP ↔ servicio.
import { usuarioService } from '../services/usuarioService.js';
import { errorValidacion } from '../services/errores.js';

function idParam(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw errorValidacion('Id inválido.');
  return id;
}

export const usuarios = {
  listar: (req, res) => res.json(usuarioService.listar()),
  crear: (req, res) => res.status(201).json(usuarioService.crear(req.body || {})),
  actualizar: (req, res) => res.json(usuarioService.actualizar(idParam(req), req.body || {})),
  password: (req, res) => res.json(usuarioService.resetPassword(idParam(req), (req.body || {}).password)),
  activo: (req, res) => res.json(usuarioService.setActivo(idParam(req), (req.body || {}).activo)),
};
