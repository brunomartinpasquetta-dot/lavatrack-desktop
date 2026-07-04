// Reporte de mermas: diferencias de conciliación + bajas registradas, con costos en ARS.
import { remitosRepo, bajasRepo } from '../db/repositorios.js';
import { calcularFaltantes } from './remitosService.js';

// Rango por defecto: últimos 60 días hasta hoy.
function rangoPorDefecto(desde, hasta) {
  const hoy = new Date();
  const fin = hasta || hoy.toISOString().slice(0, 10);
  const inicio =
    desde || new Date(hoy.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { desde: inicio, hasta: fin };
}

// Diferencias de conciliación (envíos CON_DIFERENCIA) cuyo retorno cae en el rango.
function diferenciasEnRango(desde, hasta) {
  const envios = remitosRepo.listar({ tipo: 'ENVIO', estado: 'CON_DIFERENCIA' });
  const filas = [];
  for (const envio of envios) {
    const retorno = remitosRepo.retornoDe(envio.id);
    if (!retorno) continue;
    // Se usa la fecha del ENVÍO (el remito que identifica la fila) para que coincida
    // con la fecha mostrada en el detalle del remito y evitar confusión en la demo.
    const fecha = envio.fecha;
    if (fecha < desde || fecha > hasta) continue;
    const { diferencias } = calcularFaltantes(envio, retorno);
    for (const d of diferencias) {
      filas.push({
        remito_id: envio.id,
        numero: envio.numero,
        fecha,
        sector: envio.sector,
        tipo_prenda: d.tipo_prenda,
        faltante: d.faltante,
        costo_unitario: d.costo_unitario,
        costo_ars: d.costo_ars,
      });
    }
  }
  return filas;
}

// Reporte completo de mermas para un período.
export function reporteMermas(desdeParam, hastaParam) {
  const { desde, hasta } = rangoPorDefecto(desdeParam, hastaParam);

  const diferencias = diferenciasEnRango(desde, hasta);
  const bajas = bajasRepo.listar(desde, hasta).map((b) => ({
    id: b.id,
    fecha: b.fecha,
    tipo_prenda: b.tipo_prenda,
    cantidad: b.cantidad,
    motivo: b.motivo,
    autorizado_por: b.autorizado_por,
    costo_ars: b.cantidad * b.costo_reposicion_ars,
  }));

  const unidades =
    diferencias.reduce((a, d) => a + d.faltante, 0) + bajas.reduce((a, b) => a + b.cantidad, 0);
  const ars =
    diferencias.reduce((a, d) => a + d.costo_ars, 0) + bajas.reduce((a, b) => a + b.costo_ars, 0);

  return { desde, hasta, totales: { unidades, ars }, diferencias, bajas };
}

// Resumen de mermas de los últimos 30 días (KPI del dashboard).
export function resumenMermasMes() {
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hasta = hoy.toISOString().slice(0, 10);
  const { totales } = reporteMermas(desde, hasta);
  return totales;
}
