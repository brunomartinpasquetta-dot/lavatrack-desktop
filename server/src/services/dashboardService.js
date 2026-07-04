// Agrega los KPIs del dashboard a partir del resto de los servicios.
import { stockRepo, remitosRepo } from '../db/repositorios.js';
import { alertasStockBajo } from './stockService.js';
import { resumenMermasMes } from './mermasService.js';

export function obtenerDashboard() {
  return {
    prendas_en_lavanderia: stockRepo.prendasEnLavanderia(),
    kg_enviados_mes: stockRepo.kgEnviadosUltimos30(),
    mermas_mes: resumenMermasMes(),
    sectores_stock_bajo: alertasStockBajo(),
    ultimos_remitos: remitosRepo.ultimos(5),
  };
}
