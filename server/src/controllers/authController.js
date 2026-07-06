// Controladores de autenticación: login y usuario actual (me).
import { authService } from '../services/authService.js';

// POST /api/auth/login {usuario,password} → {token, usuario:{...}}
export function login(req, res) {
  res.json(authService.login(req.body || {}));
}

// GET /api/auth/me (Bearer) → {usuario:{...}} (usa req.usuario del middleware autenticar).
export function me(req, res) {
  res.json(authService.meDe(req.usuario));
}
