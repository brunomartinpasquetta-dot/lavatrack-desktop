// Lógica de negocio de remitos: creación de envíos/retornos, validaciones y conciliación.
// Toda escritura multi-tabla va dentro de enTransaccion() (BEGIN IMMEDIATE): así el
// correlativo y los movimientos de stock son atómicos frente a varias terminales.
import { remitosRepo, sectoresRepo, tiposRepo, stockRepo, bajasRepo, idempotenciaRepo, transportistasRepo } from '../db/repositorios.js';
import { enTransaccion } from '../db/tx.js';
import { errorValidacion, errorNoEncontrado } from './errores.js';
import * as cicloService from './cicloService.js';
import * as prendaService from './prendaService.js';

// Estados que indican que un envío ya fue conciliado (no admite nuevo retorno ni reconciliación).
const ESTADOS_CONCILIADOS = ['CONCILIADO', 'CON_DIFERENCIA'];

// --- Helpers de validación ---

const esEnteroPositivo = (n) => Number.isInteger(n) && n > 0;
const esEnteroNoNegativo = (n) => Number.isInteger(n) && n >= 0;

// Fecha de hoy en formato YYYY-MM-DD (fecha local del server).
const hoyISO = () => new Date().toISOString().slice(0, 10);

// Valida y normaliza una fecha de remito (AUD-007). Devuelve la fecha en YYYY-MM-DD.
// - Si no viene, usa hoy (no se rompe el default).
// - Debe ser un YYYY-MM-DD real (no "2026-13-40" ni basura) y no futura (<= hoy).
// - Si se pasa `minima` (fecha del envío), exige fecha >= minima (retorno no anterior al envío).
export function validarFecha(valor, { minima = null } = {}) {
  if (valor === undefined || valor === null || valor === '') return hoyISO();
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw errorValidacion('La fecha debe tener el formato AAAA-MM-DD.');
  }
  // Chequeo de fecha real: reconstruir con UTC y comparar que no hubo "roll-over"
  // (ej. 2026-02-30 → Date la corre a marzo, así que no vuelve a dar la misma cadena).
  const [a, m, d] = valor.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw errorValidacion('La fecha no es una fecha válida del calendario.');
  }
  if (valor > hoyISO()) {
    throw errorValidacion('La fecha no puede ser futura.');
  }
  if (minima && valor < minima) {
    throw errorValidacion('El retorno no puede ser anterior al envío.');
  }
  return valor;
}

// Transportista opcional (Ola 4): si viene, debe existir y estar activo. Devuelve el id
// (number) validado o null si no se indicó. Acepta null/undefined/'' como "sin transportista".
export function validarTransportista(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw errorValidacion('El transportista indicado no es válido.');
  }
  const t = transportistasRepo.obtener(id);
  if (!t) throw errorValidacion(`No existe el transportista con id ${id}.`);
  if (!t.activo) throw errorValidacion('El transportista indicado no está activo.');
  return id;
}

// Firmante obligatorio server-side (AUD-015): no vacío tras trim. Devuelve el trim.
export function validarFirmante(valor) {
  const f = typeof valor === 'string' ? valor.trim() : '';
  if (!f) throw errorValidacion('Indicá el firmante responsable.');
  return f;
}

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

  // Transportista anidado (Ola 4): objeto {id,nombre,documento} para el rótulo imprimible,
  // o null si el remito no tiene transportista asignado. Los campos planos del JOIN
  // (transportista, transportista_documento) se dejan igual por compatibilidad.
  detalle.transportista = remito.transportista_id
    ? { id: remito.transportista_id, nombre: remito.transportista, documento: remito.transportista_documento || '' }
    : null;

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

// crearRemito acepta una idempotencyKey opcional (AUD-010): si llega y ya hay un remito
// asociado a esa key, se devuelve ese remito (no se crea otro). Si no, se crea dentro de la
// misma transacción y se registra la key (el PRIMARY KEY de idempotencia cierra la carrera).
export function crearRemito(payload, idempotencyKey = null) {
  const tipo = payload.tipo;
  if (tipo !== 'ENVIO' && tipo !== 'RETORNO') {
    throw errorValidacion("El campo 'tipo' debe ser ENVIO o RETORNO.");
  }

  // Fast-path: si la key ya está registrada, devolver el remito existente sin re-crear.
  if (idempotencyKey) {
    const previo = idempotenciaRepo.buscar(idempotencyKey);
    if (previo) return construirDetalle(previo.entidad_id);
  }

  return enTransaccion(() => {
    const detalle = tipo === 'ENVIO' ? crearEnvioCore(payload) : crearRetornoCore(payload);
    if (idempotencyKey) {
      // detalle.id es el remito devuelto: en ENVIO es el propio envío; en RETORNO es el
      // ENVÍO conciliado (la vista útil que devuelve crearRetornoCore). Registrar esa entidad
      // hace que el reintento con la misma key devuelva exactamente el mismo detalle.
      idempotenciaRepo.registrar(idempotencyKey, `REMITO_${tipo}`, detalle.id);
    }
    return detalle;
  });
}

function crearEnvioCore(payload) {
  const sector = sectoresRepo.obtener(payload.sector_id);
  if (!sector) throw errorValidacion(`No existe el sector con id ${payload.sector_id}.`);

  const firmante = validarFirmante(payload.firmante); // AUD-015
  const transportista_id = validarTransportista(payload.transportista_id); // Ola 4
  const tiposCache = validarItems(payload.items);
  // Validar códigos de prendas identificadas por línea (si vinieran).
  for (const it of payload.items) {
    prendaService.validarCodigosItem(it, tiposCache.get(it.tipo_prenda_id)?.nombre);
  }
  const fecha = validarFecha(payload.fecha); // AUD-007
  const peso = calcularPesoKg(payload.items, tiposCache);

  const id = remitosRepo.crear({
    numero: remitosRepo.proximoNumero(), // dentro de la transacción → sin duplicados
    tipo: 'ENVIO',
    fecha,
    sector_id: payload.sector_id,
    estado: 'ENVIADO',
    peso_total_kg: peso,
    firmante,
    observaciones: payload.observaciones,
    remito_envio_id: null,
    transportista_id,
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

  const firmante = validarFirmante(payload.firmante); // AUD-015
  const transportista_id = validarTransportista(payload.transportista_id); // Ola 4
  const tiposCache = validarItems(payload.items, { permitirCero: true, categorizar: true });
  // Validar códigos de prendas identificadas por línea (si vinieran).
  for (const it of payload.items) {
    prendaService.validarCodigosItem(it, tiposCache.get(it.tipo_prenda_id)?.nombre);
  }

  // Mapa tipo→cantidad enviada, base de las reglas de conteo (AUD-008).
  const enviados = new Map(remitosRepo.itemsDe(envio.id).map((e) => [e.tipo_prenda_id, e.cantidad]));

  // AUD-008 (a): nunca se aceptan tipos que NO estaban en el envío, ni siquiera con
  // confirmar:true. Un tipo no enviado no puede "volver" de la lavandería.
  for (const it of payload.items) {
    if (!enviados.has(it.tipo_prenda_id) && it.cantidad > 0) {
      const nombrePrenda = tiposCache.get(it.tipo_prenda_id)?.nombre || 'esa prenda';
      throw errorValidacion(
        `No se puede retornar ${nombrePrenda}: no formaba parte del envío de origen.`
      );
    }
  }

  // Regla: no se acepta recibir MÁS de lo enviado por tipo, salvo confirmación explícita.
  // Con confirmar:true la diferencia se REGISTRA (para la conciliación) pero, por AUD-008 (b),
  // el reingreso al stock del sector se acota a lo enviado (ver más abajo).
  if (!payload.confirmar) {
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

  const fecha = validarFecha(payload.fecha, { minima: envio.fecha }); // AUD-007
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
    transportista_id,
  });

  for (const it of payload.items) {
    remitosRepo.crearItem(idRetorno, it);

    const relavado = it.cantidad_relavado || 0;
    const costura = it.cantidad_costura || 0;
    const descarte = it.cantidad_descarte || 0;
    // AUD-008 (b): aun con confirmar:true, lo que reingresa al stock del sector se ACOTA a lo
    // enviado por tipo. La línea del retorno queda registrada tal cual (para la conciliación/
    // auditoría), pero el excedente por sobre lo enviado NO suma stock.
    //   ingreso bruto = todo lo retornado que "vuelve" al sector = cantidad - relavado - costura
    //                   (relavado+costura se quedan en la lavandería para reprocesar).
    //   Se acota a lo enviado: reingreso = min(cantidad, enviado) - relavado - costura (>= 0).
    // El reingreso incluye el descarte (que se contra-asienta abajo con -descarte), pero el
    // descarte que impacta stock también se acota para que el neto del sector nunca supere lo
    // enviado ni quede negativo por esta línea.
    const enviadoTipo = enviados.get(it.tipo_prenda_id) ?? 0;
    const retornableAcotado = Math.min(it.cantidad, enviadoTipo);
    const reingreso = Math.max(0, retornableAcotado - relavado - costura);
    // Descarte acotado a lo que efectivamente reingresó (no se puede dar de baja del sector
    // más de lo que entró por esta línea). Preserva el invariante del kárdex (baja ⇔ egreso).
    const descarteStock = Math.min(descarte, reingreso);
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

    // Descarte → baja automática por fin de vida útil + su movimiento de stock (neto sobre el
    // sector: 0). La baja y su egreso de stock usan el descarte ACOTADO (descarteStock): solo se
    // da de baja del sector lo que efectivamente había en él. Así se preserva el invariante del
    // kárdex (SUM(bajas FIN_VIDA_UTIL) == -SUM(mov BAJA_FIN_VIDA_UTIL)) que verifica el verificador.
    // El excedente recibido de más (confirmar:true) queda en la línea del retorno pero no genera
    // baja de stock, porque nunca ingresó al inventario del sector.
    if (descarteStock > 0) {
      bajasRepo.crear({
        fecha,
        tipo_prenda_id: it.tipo_prenda_id,
        cantidad: descarteStock,
        motivo: 'FIN_VIDA_UTIL',
        autorizado_por: firmante,
      });
      stockRepo.crearMovimiento({
        fecha,
        sector_id: envio.sector_id,
        tipo_prenda_id: it.tipo_prenda_id,
        delta: -descarteStock,
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
