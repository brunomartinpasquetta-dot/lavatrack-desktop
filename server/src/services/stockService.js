// Cálculo de stock por sector × tipo de prenda con semáforo de alertas.
import { sectoresRepo, tiposRepo, stockRepo, dotacionRepo } from '../db/repositorios.js';

// Determina el nivel del semáforo comparando el stock actual contra el mínimo del sector.
export function nivelSemaforo(actual, minimo) {
  if (!minimo || minimo <= 0) return 'ok';
  if (actual < minimo * 0.5) return 'critico';
  if (actual < minimo) return 'bajo';
  return 'ok';
}

// Devuelve la matriz completa: sectores (filas) × tipos de prenda (columnas) con nivel por celda.
export function matrizStock() {
  const sectores = sectoresRepo.listar();
  const tipos = tiposRepo.listar();
  const movs = stockRepo.matriz();

  // Índice rápido de stock actual por "sectorId:tipoId".
  const actualPor = new Map();
  for (const m of movs) actualPor.set(`${m.sector_id}:${m.tipo_prenda_id}`, m.actual);

  // Índice de dotación par (fuente de verdad de mínimos): "sectorId:tipoId" → {minima, par}.
  const dotacionPor = new Map();
  for (const d of dotacionRepo.todas()) {
    dotacionPor.set(`${d.sector_id}:${d.tipo_prenda_id}`, d);
  }

  const filas = sectores.map((sector) => ({
    sector_id: sector.id,
    sector: sector.nombre,
    metodo_reposicion: sector.metodo_reposicion,
    celdas: tipos.map((tipo) => {
      const actual = actualPor.get(`${sector.id}:${tipo.id}`) ?? 0;
      const dot = dotacionPor.get(`${sector.id}:${tipo.id}`);
      // Mínimo desde dotacion_par; si no hay fila, se cae al legado stock_minimo_json.
      const minimo = dot ? dot.cantidad_minima : sector.stock_minimo[String(tipo.id)] ?? 0;
      const par = dot ? dot.cantidad_par : 0;
      return {
        tipo_prenda_id: tipo.id,
        tipo_prenda: tipo.nombre,
        actual,
        minimo,
        par,
        nivel: nivelSemaforo(actual, minimo),
      };
    }),
  }));

  return {
    tipos_prenda: tipos.map((t) => ({ id: t.id, nombre: t.nombre })),
    sectores: filas,
  };
}

// Lista plana de celdas en alerta (nivel bajo o crítico), usada por el dashboard.
export function alertasStockBajo() {
  const { sectores } = matrizStock();
  const alertas = [];
  for (const fila of sectores) {
    for (const celda of fila.celdas) {
      if (celda.nivel === 'bajo' || celda.nivel === 'critico') {
        alertas.push({
          sector_id: fila.sector_id,
          sector: fila.sector,
          tipo_prenda: celda.tipo_prenda,
          actual: celda.actual,
          minimo: celda.minimo,
          nivel: celda.nivel,
        });
      }
    }
  }
  // Primero lo más crítico.
  alertas.sort((a, b) => (a.nivel === 'critico' ? -1 : 1) - (b.nivel === 'critico' ? -1 : 1));
  return alertas;
}
