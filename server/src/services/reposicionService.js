// "Reposición del día": sugiere cuánto entregar a cada sector para volver a su dotación par,
// y genera el remito de distribución interna (Ropería Central → sector) con su movimiento de stock.
import { sectoresRepo, dotacionRepo, stockRepo, tiposRepo, distribucionesRepo } from '../db/repositorios.js';
import { enTransaccion } from '../db/tx.js';
import { errorValidacion } from './errores.js';
import * as cicloService from './cicloService.js';

const NOMBRE_ROPERIA = 'Ropería Central';

// Stock actual por "sectorId:tipoId".
function indiceStock() {
  const idx = new Map();
  for (const m of stockRepo.matriz()) idx.set(`${m.sector_id}:${m.tipo_prenda_id}`, m.actual);
  return idx;
}

// Sugerencia de reposición por sector según su método.
export function calcularReposicion() {
  const sectores = sectoresRepo.listar();
  const stock = indiceStock();

  // Sectores que ya tienen una distribución con fecha de hoy: sirve para que la terminal
  // sepa que ese sector ya fue repuesto aunque se refresque la página (AUD-019).
  const hoy = new Date().toISOString().slice(0, 10);
  const completadosHoy = new Set(distribucionesRepo.sectorIdsPorFecha(hoy));

  const filas = sectores
    // La Ropería Central es el depósito de origen: no se repone a sí misma.
    .filter((s) => s.nombre !== NOMBRE_ROPERIA)
    .map((sector) => {
      const dot = dotacionRepo.porSector(sector.id);
      const lineas = dot.map((d) => {
        const actual = stock.get(`${sector.id}:${d.tipo_prenda_id}`) ?? 0;
        let sugerido;
        if (sector.metodo_reposicion === 'PAR') {
          sugerido = Math.max(0, d.cantidad_par - actual); // reponer hasta el par
        } else if (sector.metodo_reposicion === 'CARRO_INTERCAMBIO') {
          sugerido = d.cantidad_par; // carga del carro = par completo
        } else {
          sugerido = 0; // PEDIDO: carga manual, sin sugerencia
        }
        return {
          tipo_prenda_id: d.tipo_prenda_id,
          tipo_prenda: d.tipo_prenda,
          stock_actual: actual,
          minima: d.cantidad_minima,
          par: d.cantidad_par,
          a_entregar: sugerido,
        };
      });
      return {
        sector_id: sector.id,
        sector: sector.nombre,
        metodo_reposicion: sector.metodo_reposicion,
        completado_hoy: completadosHoy.has(sector.id),
        lineas,
      };
    });

  return { sectores: filas };
}

// Genera el remito de distribución interna: mueve stock de Ropería Central al sector.
export function generarDistribucion(payload) {
  const sector = sectoresRepo.obtener(payload.sector_id);
  if (!sector) throw errorValidacion(`No existe el sector con id ${payload.sector_id}.`);

  const items = (payload.items || []).filter((it) => Number(it.cantidad) > 0);
  if (!items.length) {
    throw errorValidacion('La distribución debe tener al menos una línea con cantidad mayor a 0.');
  }
  for (const it of items) {
    if (!Number.isInteger(it.cantidad) || it.cantidad <= 0) {
      throw errorValidacion('Las cantidades a entregar deben ser enteros mayores a 0.');
    }
    if (!tiposRepo.obtener(it.tipo_prenda_id)) {
      throw errorValidacion(`No existe el tipo de prenda con id ${it.tipo_prenda_id}.`);
    }
  }

  const roperia = sectoresRepo.listar().find((s) => s.nombre === NOMBRE_ROPERIA);
  const fecha = payload.fecha || new Date().toISOString().slice(0, 10);

  // Guard anti-duplicado (AUD-019/020): si ya hay una distribución para este sector en
  // esta fecha, no la generamos de nuevo salvo que el operario confirme explícitamente.
  // Evita la doble entrega si se refresca la terminal o se toca dos veces.
  if (payload.confirmar !== true && distribucionesRepo.existePorSectorFecha(sector.id, fecha)) {
    throw errorValidacion(
      `Ya se registró una distribución para el sector ${sector.nombre} con fecha ${fecha}. ` +
        'Confirmá para generar otra.'
    );
  }

  return enTransaccion(() => {
    const id = distribucionesRepo.crear({
      numero: distribucionesRepo.proximoNumero(),
      fecha,
      sector_id: sector.id,
      firmante: payload.firmante,
      observaciones: payload.observaciones,
      lineas: items,
    });

    for (const it of items) {
      // Vida útil: las unidades que ingresan diluyen el promedio de ciclos del tipo.
      // Se toma el circulante ANTES de crear los movimientos del alta.
      const circulanteAntes = stockRepo.circulantePorTipo(it.tipo_prenda_id);
      cicloService.registrarDilucionAlta(it.tipo_prenda_id, it.cantidad, fecha, circulanteAntes);
      // Ingreso al sector destino.
      stockRepo.crearMovimiento({
        fecha,
        sector_id: sector.id,
        tipo_prenda_id: it.tipo_prenda_id,
        delta: it.cantidad,
        motivo: 'ALTA_REPOSICION',
        remito_id: null,
      });
      // Egreso del depósito central (si existe la Ropería Central).
      if (roperia) {
        stockRepo.crearMovimiento({
          fecha,
          sector_id: roperia.id,
          tipo_prenda_id: it.tipo_prenda_id,
          delta: -it.cantidad,
          motivo: 'ALTA_REPOSICION',
          remito_id: null,
        });
      }
    }

    return distribucionesRepo.obtener(id);
  });
}
