// Inventario físico CIEGO por sector: el operario cuenta sin ver el teórico.
// Al cerrar, la diferencia (contado - teórico) genera un ajuste INVENTARIO y su
// movimiento AJUSTE en el kárdex, todo en una sola transacción.
import {
  inventariosRepo,
  ajustesRepo,
  stockRepo,
  dotacionRepo,
  sectoresRepo,
} from '../db/repositorios.js';
import { enTransaccion } from '../db/tx.js';
import { errorValidacion, errorNoEncontrado } from './errores.js';

// --- Detalle (respeta el conteo ciego) ---
// EN_CURSO: solo nombre + cantidad_contada (SIN teórico ni diferencia).
// CERRADO: teórico, contado y diferencia completos.
export function detalle(id) {
  const cab = inventariosRepo.obtener(id);
  if (!cab) throw errorNoEncontrado(`No se encontró el inventario ${id}.`);
  const items = inventariosRepo.itemsDe(id);
  const ciego = cab.estado === 'EN_CURSO';
  return {
    id: cab.id,
    fecha: cab.fecha,
    sector_id: cab.sector_id,
    sector: cab.sector,
    usuario: cab.usuario,
    estado: cab.estado,
    observaciones: cab.observaciones,
    items: items.map((it) =>
      ciego
        ? {
            tipo_prenda_id: it.tipo_prenda_id,
            tipo_prenda: it.tipo_prenda,
            cantidad_contada: it.cantidad_contada,
          }
        : {
            tipo_prenda_id: it.tipo_prenda_id,
            tipo_prenda: it.tipo_prenda,
            cantidad_teorica: it.cantidad_teorica,
            cantidad_contada: it.cantidad_contada,
            diferencia: it.diferencia,
          }
    ),
  };
}

export function listar(filtros = {}) {
  return inventariosRepo.listar(filtros);
}

// Inicia un inventario: guard anti-duplicado + snapshot teórico desde el stock del sector.
export function iniciar({ sector_id, usuario }) {
  const sector = sectoresRepo.obtener(sector_id);
  if (!sector) throw errorValidacion(`No existe el sector con id ${sector_id}.`);

  const abierto = inventariosRepo.abiertoPorSector(sector_id);
  if (abierto) {
    throw errorValidacion(`Ya hay un inventario en curso para el sector ${sector.nombre}.`);
  }

  // Stock actual del sector por tipo.
  const stockPorTipo = new Map();
  for (const m of stockRepo.matriz()) {
    if (m.sector_id === sector_id) stockPorTipo.set(m.tipo_prenda_id, m.actual);
  }
  // Tipos con dotación par definida en el sector (aunque su stock sea 0).
  const tiposConDotacion = new Set(dotacionRepo.porSector(sector_id).map((d) => d.tipo_prenda_id));

  // Universo a contar: tipos con stock != 0 o con dotación par.
  const tipoIds = new Set();
  for (const [tipoId, actual] of stockPorTipo) if (actual !== 0) tipoIds.add(tipoId);
  for (const t of tiposConDotacion) tipoIds.add(t);

  const fecha = new Date().toISOString().slice(0, 10);
  return enTransaccion(() => {
    const id = inventariosRepo.crear({ fecha, sector_id, usuario, observaciones: '' });
    for (const tipoId of [...tipoIds].sort((a, b) => a - b)) {
      inventariosRepo.crearItem(id, {
        tipo_prenda_id: tipoId,
        cantidad_teorica: stockPorTipo.get(tipoId) ?? 0,
      });
    }
    return detalle(id);
  });
}

// Registra las cantidades contadas (sigue EN_CURSO).
export function registrarConteo(id, { conteos }) {
  const cab = inventariosRepo.obtener(id);
  if (!cab) throw errorNoEncontrado(`No se encontró el inventario ${id}.`);
  if (cab.estado !== 'EN_CURSO') {
    throw errorValidacion('El inventario ya está cerrado; no admite nuevos conteos.');
  }
  if (!Array.isArray(conteos)) {
    throw errorValidacion('Se esperaba una lista de conteos.');
  }
  return enTransaccion(() => {
    for (const c of conteos) {
      if (c.cantidad_contada != null && !Number.isInteger(c.cantidad_contada)) {
        throw errorValidacion('La cantidad contada debe ser un número entero.');
      }
      inventariosRepo.setContada(id, c.tipo_prenda_id, c.cantidad_contada);
    }
    return detalle(id);
  });
}

// Cierra el inventario: calcula diferencias, genera ajustes INVENTARIO + movimientos AJUSTE.
export function cerrar(id, { observaciones, autorizado_por } = {}) {
  const cab = inventariosRepo.obtener(id);
  if (!cab) throw errorNoEncontrado(`No se encontró el inventario ${id}.`);
  if (cab.estado !== 'EN_CURSO') {
    throw errorValidacion('El inventario ya está cerrado.');
  }
  const fecha = new Date().toISOString().slice(0, 10);
  return enTransaccion(() => {
    const items = inventariosRepo.itemsDe(id);
    for (const it of items) {
      // Si no se contó, se asume que coincide con el teórico (diferencia 0).
      const contada = it.cantidad_contada ?? it.cantidad_teorica;
      const diferencia = contada - it.cantidad_teorica;
      inventariosRepo.setDiferencia(it.id, diferencia);
      if (diferencia !== 0) {
        ajustesRepo.crear({
          fecha,
          sector_id: cab.sector_id,
          tipo_prenda_id: it.tipo_prenda_id,
          delta: diferencia,
          motivo: 'INVENTARIO',
          autorizado_por: autorizado_por || '',
          inventario_id: id,
        });
        stockRepo.crearMovimiento({
          fecha,
          sector_id: cab.sector_id,
          tipo_prenda_id: it.tipo_prenda_id,
          delta: diferencia,
          motivo: 'AJUSTE',
          remito_id: null,
        });
      }
    }
    inventariosRepo.cerrar(id, { observaciones: observaciones || cab.observaciones || '' });
    return detalle(id);
  });
}
