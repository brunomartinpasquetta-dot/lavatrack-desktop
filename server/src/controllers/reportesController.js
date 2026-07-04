// Controladores de dashboard, stock y mermas.
import { obtenerDashboard } from '../services/dashboardService.js';
import { matrizStock } from '../services/stockService.js';
import { reporteMermas } from '../services/mermasService.js';

export function dashboard(req, res) {
  res.json(obtenerDashboard());
}

export function stock(req, res) {
  res.json(matrizStock());
}

export function mermas(req, res) {
  res.json(reporteMermas(req.query.desde || null, req.query.hasta || null));
}
