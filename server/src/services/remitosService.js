// Lógica de negocio de remitos: creación de envíos/retornos, validaciones y conciliación.
// Toda escritura multi-tabla va dentro de enTransaccion() (BEGIN IMMEDIATE): así el
// correlativo y los movimientos de stock son atómicos frente a varias terminales.
import { remitosRepo, sectoresRepo, tiposRepo, stockRepo, bajasRepo } from '../db/repositorios.js';
import { enTransaccion } from '../db/tx.js';
import { errorValidacion, errorNoEncontrado } from './errores.js';
import * as cicloService from './cicloService.js';
import * as prendaService from './prendaService.js';

// Estados que indican que un envío ya fue conciliado (no admite nuevo retorno ni reconciliación).
const ESTADOS_CONCILIADOS = ['CONCILIADO', 'CON_DIFERENCIA'];

// --- Helpers de validación ---

const esEnteroPositivo = (n) => Number.isInteger(n) && n > 0;
const esEnteroNoNegativo = (n) => Number.isInteger(n) && n >= 0;

// Valida las líneas y devuelve los tipos de prenda involucrados (para reusar pesos/costos).
// En RETORNO (categorizar=true) valida el desglose por calidad: relavado+costura+descarte <= cantidad.
function validarItems(items, { permitirCero = false, categorizar = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw errorValidacion('El remito debe tener al menos una línea de prenda.');
  }
  const tiposCache = new Map();
  for (const it of items) {
    const cantOk = permitirCero ? esEnteroNoNegativo(it.cantidad) : esEnteroPositivo(it.cantidad);
    if (!cantOk) {
      throw errorValidacion(`La cantidad debe ser un número entero ${permitirCero ? '≥ 0' : '> 0'}.`);
    }
    const contaminada = it.cantidad_contaminada ?? 0;
    if (!esEnteroNoNegativo(contaminada) || contaminada > it.cantidad) {
      throw errorValidacion('La cantidad contaminada debe ser un entero entre 0 y la cantidad de la línea.');
    }
    if (categorizar) {
      const rel = it.cantidad_relavado ?? 0;
      const cos = it.cantidad_costura ?? 0;
      const des = it.cantidad_descarte ?? 0;
      if (![rel, cos, des].every(esEnteroNoNegativo)) {
        throw errorValidacion('Las cantidades de relavado, costura y descarte deben ser enteros ≥ 0.');
      }
      if (rel + cos + des > it.cantidad) {
        throw errorValidacion(
          'La suma de apta + relavado + costura + descarte no puede superar la cantidad retornada de la línea.'
        );
      }
    }
    const tipo = tiposCache.get(it.tipo_prenda_id) || tiposRepo.obtener(it.tipo_prenda_id);
    if (!tipo) throw errorValidacion(`No existe el tipo de prenda con id ${it.tipo_prenda_id}.`);
    tiposCache.set(it.tipo_prenda_id, tipo);
  }
  return tiposCache;
}

// Calcula el peso total en kg a partir de las cantidades y el peso promedio de cada prenda.
function calcularPesoKg(items, tiposCache) {
  const gramos = items.reduce(
    (acc, it) => acc + it.cantidad * tiposCache.get(it.tipo_prenda_id).peso_promedio_gr,
    0
  );
  return Math.round((gramos / 1000) * 10) / 10;
}

// Añade el array `codigos` (parseando codigos_json) a un item de remito para el detalle.
function conCodigos(item) {
  let codigos = null;
  if (item.codigos_json) {
    try { codigos = JSON.parse(item.codigos_json); } catch { codigos = null; }
  }
  return { ...item, codigos };
}

// --- Construcción del detalle completo de un remito (shape del contrato) ---

export function construirDetalle(id) {
  const remito = remitosRepo.obtener(id);
  if (!remito) throw errorNoEncontrado(`No se encontró el remito ${id}.`);

  const items = remitosRepo.itemsDe(id).map(conCodigos);
  const detalle = { ...remito, items };

  if (remito.tipo === 'ENVIO') {
    const retorno = remitosRepo.retornoDe(id);
    detalle.retorno = retorno ? { ...retorno, items: remitosRepo.itemsDe(retorno.id).map(conCodigos) } : null;
    detalle.conciliacion = retorno ? construirConciliacion(remito, retorno) : null;
  }
  return detalle;
}

// Arma el bloque de conciliación comparando envío vs retorno.
function construirConciliacion(envio, retorno) {
  const { diferencias, costo_total } = calcularFaltantes(envio, retorno);
  const items = remitosRepo.itemsDe(retorno.id);
  // Resumen del desglose por calidad del retorno (para mostrar en la UI).
  const categorias = items.reduce(
    (acc, r) => {
      const relavado = r.cantidad_relavado || 0;
      const costura = r.cantidad_costura || 0;
      const descarte = r.cantidad_descarte || 0;
      acc.relavado += relavado;
      acc.costura += costura;
      acc.descarte += descarte;
      acc.apta += r.cantidad - relavado - costura - descarte;
      return acc;
    },
    { apta: 0, relavado: 0, costura: 0, descarte: 0 }
  );
  return {
    estado: diferencias.length ? 'CON_DIFERENCIA' : 'CONCILIADO',
    diferencias,
    costo_total_ars: costo_total,
    categorias,
  };
}

// Merma = lo enviado que NO volvió NI fue categorizado. recibido = total retornado (cantidad),
// que ya incluye apta + relavado + costura + descarte, así que lo categorizado no cuenta como merma.
export function calcularFaltantes(envio, retorno) {
  const enviados = remitosRepo.itemsDe(envio.id);
  const recibidos = remitosRepo.itemsDe(retorno.id);
  const mapaRecibido = new Map(recibidos.map((r) => [r.tipo_prenda_id, r.cantidad]));

  const diferencias = [];
  let costo_total = 0;
  for (const e of enviados) {
    const recibido = mapaRecibido.get(e.tipo_prenda_id) ?? 0;
    const faltante = e.cantidad - recibido;
    if (faltante > 0) {
      const costo_ars = faltante * e.costo_reposicion_ars;
      costo_total += costo_ars;
      diferencias.push({
        tipo_prenda_id: e.tipo_prenda_id,
        tipo_prenda: e.tipo_prenda,
        enviado: e.cantidad,
        recibido,
        faltante,
        costo_unitario: e.costo_reposicion_ars,
        costo_ars,
      });
    }
  }
  return { diferencias, costo_total };
}

// --- Creación de remitos (envuelta en transacción) ---

export function crearRemito(payload) {
  const tipo = payload.tipo;
  if (tipo !== 'ENVIO' && tipo !== 'RETORNO') {
    throw errorValidacion("El campo 'tipo' debe ser ENVIO o RETORNO.");
  }
  return enTransaccion(() => (tipo === 'ENVIO' ? crearEnvioCore(payload) : crearRetornoCore(payload)));
}

function crearEnvioCore(payload) {
  const sector = sectoresRepo.obtener(payload.sector_id);
  if (!sector) throw errorValidacion(`No existe el sector con id ${payload.sector_id}.`);

  const tiposCache = validarItems(payload.items);
  // Validar códigos de prendas identificadas por línea (si vinieran).
  for (const it of payload.items) {
    prendaService.validarCodigosItem(it, tiposCache.get(it.tipo_prenda_id)?.nombre);
  }
  const fecha = payload.fecha || new Date().toISOString().slice(0, 10);
  const peso = calcularPesoKg(payload.items, tiposCache);

  const id = remitosRepo.crear({
    numero: remitosRepo.proximoNumero(), // dentro de la transacción → sin duplicados
    tipo: 'ENVIO',
    fecha,
    sector_id: payload.sector_id,
    estado: 'ENVIADO',
    peso_total_kg: peso,
    firmante: payload.firmante,
    observaciones: payload.observaciones,
    remito_envio_id: null,
  });

  for (const it of payload.items) {
    remitosRepo.crearItem(id, it); // persiste codigos_json si it.codigos viene
    // El envío saca prendas del sector hacia la lavandería (delta negativo).
    stockRepo.crearMovimiento({
      fecha,
      sector_id: payload.sector_id,
      tipo_prenda_id: it.tipo_prenda_id,
      delta: -it.cantidad,
      motivo: 'ENVIO',
      remito_id: id,
    });
    // Prendas identificadas de la línea → EN_LAVANDERIA.
    prendaService.aplicarEnvio(it, payload.sector_id, fecha);
  }
  return construirDetalle(id);
}

function crearRetornoCore(payload) {
  if (!payload.remito_envio_id) {
    throw errorValidacion('Un retorno debe indicar el remito de envío de origen (remito_envio_id).');
  }
  const envio = remitosRepo.obtener(payload.remito_envio_id);
  if (!envio) throw errorNoEncontrado(`No existe el remito de envío ${payload.remito_envio_id}.`);
  if (envio.tipo !== 'ENVIO') throw errorValidacion('El remito de origen no es un envío.');
  if (ESTADOS_CONCILIADOS.includes(envio.estado)) {
    throw errorValidacion('El envío ya fue conciliado; no admite un nuevo retorno.');
  }
  if (remitosRepo.retornoDe(envio.id)) {
    throw errorValidacion('El envío ya tiene un retorno registrado.');
  }

  const tiposCache = validarItems(payload.items, { permitirCero: true, categorizar: true });
  // Validar códigos de prendas identificadas por línea (si vinieran).
  for (const it of payload.items) {
    prendaService.validarCodigosItem(it, tiposCache.get(it.tipo_prenda_id)?.nombre);
  }

  // Regla: no se acepta recibir más de lo enviado por tipo, salvo confirmación explícita.
  if (!payload.confirmar) {
    const enviados = new Map(remitosRepo.itemsDe(envio.id).map((e) => [e.tipo_prenda_id, e.cantidad]));
    for (const it of payload.items) {
      const enviado = enviados.get(it.tipo_prenda_id) ?? 0;
      if (it.cantidad > enviado) {
        const nombrePrenda = tiposCache.get(it.tipo_prenda_id)?.nombre || 'esta prenda';
        throw errorValidacion(
          `La cantidad recibida (${it.cantidad}) supera la enviada (${enviado}) para ${nombrePrenda}. ` +
            'Verificá el conteo o confirmá para registrar la diferencia.'
        );
      }
    }
  }

  const fecha = payload.fecha || new Date().toISOString().slice(0, 10);
  const peso = calcularPesoKg(payload.items, tiposCache);

  const idRetorno = remitosRepo.crear({
    numero: remitosRepo.proximoNumero(),
    tipo: 'RETORNO',
    fecha,
    sector_id: envio.sector_id,
    estado: 'RECIBIDO',
    peso_total_kg: peso,
    firmante: payload.firmante,
    observaciones: payload.observaciones,
    remito_envio_id: envio.id,
  });

  for (const it of payload.items) {
    remitosRepo.crearItem(idRetorno, it);

    const relavado = it.cantidad_relavado || 0;
    const costura = it.cantidad_costura || 0;
    const descarte = it.cantidad_descarte || 0;
    // Lo que reingresa físicamente al sector = todo lo retornado menos lo que la
    // lavandería retiene para reprocesar (relavado + costura). Incluye el descarte,
    // que luego se da de baja (así el descarte tiene su movimiento y no se duplica el conteo).
    const reingreso = it.cantidad - relavado - costura;
    if (reingreso > 0) {
      stockRepo.crearMovimiento({
        fecha,
        sector_id: envio.sector_id,
        tipo_prenda_id: it.tipo_prenda_id,
        delta: reingreso,
        motivo: 'RETORNO',
        remito_id: idRetorno,
      });
    }

    // Descarte → baja automática por fin de vida útil + su movimiento de stock (neto sobre el sector: 0).
    if (descarte > 0) {
      bajasRepo.crear({
        fecha,
        tipo_prenda_id: it.tipo_prenda_id,
        cantidad: descarte,
        motivo: 'FIN_VIDA_UTIL',
        autorizado_por: payload.firmante || 'Recepción lavandería',
      });
      stockRepo.crearMovimiento({
        fecha,
        sector_id: envio.sector_id,
        tipo_prenda_id: it.tipo_prenda_id,
        delta: -descarte,
        motivo: 'BAJA_FIN_VIDA_UTIL',
        remito_id: idRetorno,
      });
    }

    // Vida útil: cada unidad retornada hizo un ciclo de lavado (prorrateo sobre el circulante).
    cicloService.registrarCiclosRetorno(it.tipo_prenda_id, it.cantidad, fecha);
    // Prendas identificadas de la línea → reingreso (EN_SECTOR, ciclos+1) o baja (descarte).
    prendaService.aplicarRetorno(it, envio.sector_id, fecha);
  }

  // Conciliación automática (se une a esta misma transacción por re-entrancia).
  conciliar(envio.id);

  // Devolvemos el detalle del ENVÍO ya conciliado: es la vista útil tras registrar el retorno.
  return construirDetalle(envio.id);
}

// --- Conciliación ---

export function conciliar(envioId) {
  return enTransaccion(() => {
    const envio = remitosRepo.obtener(envioId);
    if (!envio) throw errorNoEncontrado(`No existe el remito de envío ${envioId}.`);
    if (envio.tipo !== 'ENVIO') throw errorValidacion('Solo se pueden conciliar remitos de envío.');
    if (ESTADOS_CONCILIADOS.includes(envio.estado)) {
      throw errorValidacion('El envío ya fue conciliado.');
    }
    const retorno = remitosRepo.retornoDe(envioId);
    if (!retorno) throw errorValidacion('El envío no tiene un retorno registrado para conciliar.');

    const { diferencias } = calcularFaltantes(envio, retorno);
    remitosRepo.actualizarEstado(envioId, diferencias.length ? 'CON_DIFERENCIA' : 'CONCILIADO');
    return construirDetalle(envioId);
  });
}
