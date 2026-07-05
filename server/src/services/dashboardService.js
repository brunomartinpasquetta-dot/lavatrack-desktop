// Agrega los KPIs del dashboard a partir del resto de los servicios.
import { stockRepo, remitosRepo, ajustesRepo } from '../db/repositorios.js';
import { alertasStockBajo } from './stockService.js';
import { resumenMermasMes } from './mermasService.js';
import { alertas as alertasVidaUtil } from './cicloService.js';

export function obtenerDashboard() {
  return {
    prendas_en_lavanderia: stockRepo.prendasEnLavanderia(),
    kg_enviados_mes: stockRepo.kgEnviadosUltimos30(),
    mermas_mes: resumenMermasMes(),
    sectores_stock_bajo: alertasStockBajo(),
    ultimos_remitos: remitosRepo.ultimos(5),
    // Alarmas de vida útil (solo las que no están 'ok'), shape recortado para el dashboard.
    alertas_vida_util: alertasVidaUtil()
      .filter((a) => a.estado !== 'ok')
      .map((a) => ({
        tipo_prenda: a.tipo_prenda,
        pct: a.pct,
        estado: a.estado,
        costo_estimado: a.costo_estimado,
      })),
    // Merma interna del mes (ajustes negativos), separada de mermas_mes (vs lavandería).
    merma_interna_mes: ajustesRepo.resumenNegativosMes(),
  };
}
