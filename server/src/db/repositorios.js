// Capa de datos: todo el acceso a SQLite vive acá, agrupado por entidad.
// Los controladores y servicios NO ejecutan SQL directamente; usan estas funciones.
import { getDb } from './connection.js';
import { enTransaccion } from './tx.js';

// ---------- Sectores ----------
export const sectoresRepo = {
  listar() {
    const rows = getDb().prepare('SELECT * FROM sectores ORDER BY id').all();
    return rows.map(parsearSector);
  },
  obtener(id) {
    const row = getDb().prepare('SELECT * FROM sectores WHERE id = ?').get(id);
    return row ? parsearSector(row) : null;
  },
  crear({ nombre, stock_minimo, metodo_reposicion }) {
    const info = getDb()
      .prepare('INSERT INTO sectores (nombre, stock_minimo_json, metodo_reposicion) VALUES (?, ?, ?)')
      .run(nombre, JSON.stringify(stock_minimo || {}), metodo_reposicion || 'PAR');
    return this.obtener(Number(info.lastInsertRowid));
  },
  actualizar(id, { nombre, stock_minimo, metodo_reposicion }) {
    getDb()
      .prepare('UPDATE sectores SET nombre = ?, stock_minimo_json = ?, metodo_reposicion = ? WHERE id = ?')
      .run(nombre, JSON.stringify(stock_minimo || {}), metodo_reposicion || 'PAR', id);
    return this.obtener(id);
  },
  eliminar(id) {
    getDb().prepare('DELETE FROM sectores WHERE id = ?').run(id);
  },
};

function parsearSector(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    stock_minimo: JSON.parse(row.stock_minimo_json || '{}'),
    metodo_reposicion: row.metodo_reposicion || 'PAR',
  };
}

// ---------- Dotación par (cantidad par / mínima por sector × tipo de prenda) ----------
export const dotacionRepo = {
  porSector(sectorId) {
    return getDb()
      .prepare(
        `SELECT dp.*, tp.nombre AS tipo_prenda, tp.costo_reposicion_ars, tp.peso_promedio_gr
         FROM dotacion_par dp JOIN tipos_prenda tp ON tp.id = dp.tipo_prenda_id
         WHERE dp.sector_id = ? ORDER BY dp.tipo_prenda_id`
      )
      .all(sectorId);
  },
  todas() {
    return getDb().prepare('SELECT * FROM dotacion_par').all();
  },
  // Upsert de una fila de dotación (par y mínima) para un sector×tipo.
  guardar(sectorId, tipoPrendaId, cantidadPar, cantidadMinima) {
    getDb()
      .prepare(
        `INSERT INTO dotacion_par (sector_id, tipo_prenda_id, cantidad_par, cantidad_minima)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (sector_id, tipo_prenda_id)
         DO UPDATE SET cantidad_par = excluded.cantidad_par, cantidad_minima = excluded.cantidad_minima`
      )
      .run(sectorId, tipoPrendaId, cantidadPar, cantidadMinima);
  },
};

// ---------- Tipos de prenda ----------
export const tiposRepo = {
  listar() {
    return getDb().prepare('SELECT * FROM tipos_prenda ORDER BY id').all();
  },
  obtener(id) {
    return getDb().prepare('SELECT * FROM tipos_prenda WHERE id = ?').get(id) || null;
  },
  crear({ nombre, peso_promedio_gr, vida_util_ciclos, costo_reposicion_ars }) {
    const info = getDb()
      .prepare(
        `INSERT INTO tipos_prenda (nombre, peso_promedio_gr, vida_util_ciclos, costo_reposicion_ars)
         VALUES (?, ?, ?, ?)`
      )
      .run(nombre, peso_promedio_gr, vida_util_ciclos, costo_reposicion_ars);
    return this.obtener(Number(info.lastInsertRowid));
  },
  actualizar(id, { nombre, peso_promedio_gr, vida_util_ciclos, costo_reposicion_ars }) {
    getDb()
      .prepare(
        `UPDATE tipos_prenda
         SET nombre = ?, peso_promedio_gr = ?, vida_util_ciclos = ?, costo_reposicion_ars = ?
         WHERE id = ?`
      )
      .run(nombre, peso_promedio_gr, vida_util_ciclos, costo_reposicion_ars, id);
    return this.obtener(id);
  },
  eliminar(id) {
    getDb().prepare('DELETE FROM tipos_prenda WHERE id = ?').run(id);
  },
};

// ---------- Remitos ----------
export const remitosRepo = {
  // Genera el próximo número secuencial con formato LT-2026-0001.
  proximoNumero() {
    const row = getDb()
      .prepare(`SELECT numero FROM remitos ORDER BY id DESC LIMIT 1`)
      .get();
    let siguiente = 1;
    if (row && row.numero) {
      const partes = row.numero.split('-');
      siguiente = Number(partes[2]) + 1;
    }
    const anio = new Date().getFullYear();
    return `LT-${anio}-${String(siguiente).padStart(4, '0')}`;
  },

  listar(filtros = {}) {
    const where = [];
    const params = [];
    if (filtros.estado) { where.push('r.estado = ?'); params.push(filtros.estado); }
    if (filtros.sector_id) { where.push('r.sector_id = ?'); params.push(filtros.sector_id); }
    if (filtros.tipo) { where.push('r.tipo = ?'); params.push(filtros.tipo); }
    if (filtros.desde) { where.push('r.fecha >= ?'); params.push(filtros.desde); }
    if (filtros.hasta) { where.push('r.fecha <= ?'); params.push(filtros.hasta); }
    const sql = `
      SELECT r.*, s.nombre AS sector,
             (SELECT COALESCE(SUM(cantidad),0) FROM remito_items WHERE remito_id = r.id) AS total_prendas
      FROM remitos r
      JOIN sectores s ON s.id = r.sector_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY r.fecha DESC, r.id DESC`;
    return getDb().prepare(sql).all(...params);
  },

  obtener(id) {
    return getDb()
      .prepare(
        `SELECT r.*, s.nombre AS sector
         FROM remitos r JOIN sectores s ON s.id = r.sector_id
         WHERE r.id = ?`
      )
      .get(id) || null;
  },

  itemsDe(remitoId) {
    return getDb()
      .prepare(
        `SELECT ri.*, tp.nombre AS tipo_prenda, tp.peso_promedio_gr, tp.costo_reposicion_ars
         FROM remito_items ri
         JOIN tipos_prenda tp ON tp.id = ri.tipo_prenda_id
         WHERE ri.remito_id = ?
         ORDER BY ri.id`
      )
      .all(remitoId);
  },

  // Devuelve el remito de RETORNO vinculado a un ENVIO, o null.
  retornoDe(envioId) {
    return getDb()
      .prepare(`SELECT * FROM remitos WHERE tipo = 'RETORNO' AND remito_envio_id = ?`)
      .get(envioId) || null;
  },

  ultimos(limite = 5) {
    return getDb()
      .prepare(
        `SELECT r.*, s.nombre AS sector,
                (SELECT COALESCE(SUM(cantidad),0) FROM remito_items WHERE remito_id = r.id) AS total_prendas
         FROM remitos r JOIN sectores s ON s.id = r.sector_id
         ORDER BY r.fecha DESC, r.id DESC LIMIT ?`
      )
      .all(limite);
  },

  crear({ numero, tipo, fecha, sector_id, estado, peso_total_kg, firmante, observaciones, remito_envio_id }) {
    const info = getDb()
      .prepare(
        `INSERT INTO remitos (numero, tipo, fecha, sector_id, estado, peso_total_kg, firmante, observaciones, remito_envio_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(numero, tipo, fecha, sector_id, estado, peso_total_kg, firmante || '', observaciones || '', remito_envio_id ?? null);
    return Number(info.lastInsertRowid);
  },

  crearItem(remitoId, { tipo_prenda_id, cantidad, cantidad_contaminada, cantidad_relavado, cantidad_costura, cantidad_descarte, codigos }) {
    // codigos: array de códigos de prendas identificadas de la línea → se guarda como JSON, o NULL.
    const codigos_json = Array.isArray(codigos) && codigos.length ? JSON.stringify(codigos) : null;
    getDb()
      .prepare(
        `INSERT INTO remito_items
           (remito_id, tipo_prenda_id, cantidad, cantidad_contaminada, cantidad_relavado, cantidad_costura, cantidad_descarte, codigos_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        remitoId, tipo_prenda_id, cantidad,
        cantidad_contaminada || 0, cantidad_relavado || 0, cantidad_costura || 0, cantidad_descarte || 0,
        codigos_json
      );
  },

  actualizarEstado(id, estado) {
    getDb().prepare('UPDATE remitos SET estado = ? WHERE id = ?').run(estado, id);
  },
};

// ---------- Movimientos de stock ----------
export const stockRepo = {
  crearMovimiento({ fecha, sector_id, tipo_prenda_id, delta, motivo, remito_id }) {
    getDb()
      .prepare(
        `INSERT INTO movimientos_stock (fecha, sector_id, tipo_prenda_id, delta, motivo, remito_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(fecha, sector_id, tipo_prenda_id, delta, motivo, remito_id ?? null);
  },

  // Circulante de un tipo de prenda = SUM(delta) de TODOS sus movimientos (net owned,
  // agregado sobre todos los sectores). Base del prorrateo de ciclos de vida útil.
  circulantePorTipo(tipoPrendaId) {
    const row = getDb()
      .prepare(
        `SELECT COALESCE(SUM(delta),0) AS circulante
         FROM movimientos_stock WHERE tipo_prenda_id = ?`
      )
      .get(tipoPrendaId);
    return row.circulante;
  },

  // Stock actual = suma de deltas por sector y tipo de prenda.
  matriz() {
    return getDb()
      .prepare(
        `SELECT sector_id, tipo_prenda_id, COALESCE(SUM(delta),0) AS actual
         FROM movimientos_stock
         GROUP BY sector_id, tipo_prenda_id`
      )
      .all();
  },

  // Prendas actualmente en lavandería:
  //  (a) las enviadas (ENVIO en estado ENVIADO) aún sin retornar, más
  //  (b) las categorizadas como relavado/costura en retornos, que siguen en la
  //      lavandería a la espera de un retorno posterior.
  prendasEnLavanderia() {
    const enviadas = getDb()
      .prepare(
        `SELECT COALESCE(SUM(ri.cantidad),0) AS n
         FROM remito_items ri
         JOIN remitos r ON r.id = ri.remito_id
         WHERE r.tipo = 'ENVIO' AND r.estado = 'ENVIADO'`
      )
      .get().n;
    const reprocesando = getDb()
      .prepare(
        `SELECT COALESCE(SUM(ri.cantidad_relavado + ri.cantidad_costura),0) AS n
         FROM remito_items ri
         JOIN remitos r ON r.id = ri.remito_id
         WHERE r.tipo = 'RETORNO'`
      )
      .get().n;
    return enviadas + reprocesando;
  },

  // Kg enviados en los últimos 30 días (ventana móvil, más representativa para la demo).
  kgEnviadosUltimos30() {
    const row = getDb()
      .prepare(
        `SELECT COALESCE(SUM(peso_total_kg),0) AS kg
         FROM remitos
         WHERE tipo = 'ENVIO' AND fecha >= date('now','-30 days')`
      )
      .get();
    return Math.round(row.kg * 10) / 10;
  },
};

// ---------- Bajas ----------
export const bajasRepo = {
  crear({ fecha, tipo_prenda_id, cantidad, motivo, autorizado_por }) {
    const info = getDb()
      .prepare(
        `INSERT INTO bajas (fecha, tipo_prenda_id, cantidad, motivo, autorizado_por)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(fecha, tipo_prenda_id, cantidad, motivo, autorizado_por || '');
    return Number(info.lastInsertRowid);
  },

  listar(desde, hasta) {
    return getDb()
      .prepare(
        `SELECT b.*, tp.nombre AS tipo_prenda, tp.costo_reposicion_ars
         FROM bajas b JOIN tipos_prenda tp ON tp.id = b.tipo_prenda_id
         WHERE b.fecha >= ? AND b.fecha <= ?
         ORDER BY b.fecha DESC, b.id DESC`
      )
      .all(desde, hasta);
  },
};

// ---------- Distribuciones internas (reposición Ropería Central → sector) ----------
export const distribucionesRepo = {
  // Correlativo LT-D-AAAA-NNNN. Debe llamarse DENTRO de la transacción del INSERT.
  proximoNumero() {
    const row = getDb()
      .prepare(`SELECT numero FROM distribuciones ORDER BY id DESC LIMIT 1`)
      .get();
    let siguiente = 1;
    if (row && row.numero) siguiente = Number(row.numero.split('-').pop()) + 1;
    return `LT-D-${new Date().getFullYear()}-${String(siguiente).padStart(4, '0')}`;
  },
  crear({ numero, fecha, sector_id, firmante, observaciones, lineas }) {
    const info = getDb()
      .prepare(
        `INSERT INTO distribuciones (numero, fecha, sector_id, firmante, observaciones, lineas_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(numero, fecha, sector_id, firmante || '', observaciones || '', JSON.stringify(lineas || []));
    return Number(info.lastInsertRowid);
  },
  obtener(id) {
    const row = getDb()
      .prepare(
        `SELECT d.*, s.nombre AS sector FROM distribuciones d
         JOIN sectores s ON s.id = d.sector_id WHERE d.id = ?`
      )
      .get(id);
    if (!row) return null;
    return { ...row, lineas: JSON.parse(row.lineas_json || '[]') };
  },
  // ¿Ya hay una distribución registrada para ese sector en esa fecha? (guard anti-duplicado).
  existePorSectorFecha(sectorId, fecha) {
    const row = getDb()
      .prepare('SELECT 1 FROM distribuciones WHERE sector_id = ? AND fecha = ? LIMIT 1')
      .get(sectorId, fecha);
    return !!row;
  },
  // Ids de sector con al menos una distribución en la fecha dada (para el flag completado_hoy).
  sectorIdsPorFecha(fecha) {
    return getDb()
      .prepare('SELECT DISTINCT sector_id FROM distribuciones WHERE fecha = ?')
      .all(fecha)
      .map((r) => r.sector_id);
  },
};

// ---------- Ciclos de vida útil (promedio de lavados por tipo, nivel lote) ----------
export const ciclosRepo = {
  obtener(tipoId) {
    return getDb()
      .prepare('SELECT * FROM ciclos_prenda WHERE tipo_prenda_id = ?')
      .get(tipoId) || null;
  },
  // Todos los tipos con su promedio (LEFT JOIN: los tipos sin fila devuelven 0).
  obtenerTodos() {
    return getDb()
      .prepare(
        `SELECT tp.id AS tipo_prenda_id,
                tp.nombre AS tipo_prenda,
                tp.vida_util_ciclos,
                tp.costo_reposicion_ars,
                COALESCE(cp.ciclos_acumulados_promedio, 0) AS ciclos_acumulados_promedio,
                COALESCE(cp.ultima_actualizacion, '') AS ultima_actualizacion
         FROM tipos_prenda tp
         LEFT JOIN ciclos_prenda cp ON cp.tipo_prenda_id = tp.id
         ORDER BY tp.id`
      )
      .all();
  },
  // Upsert del promedio acumulado.
  upsert(tipoId, promedio, fecha) {
    getDb()
      .prepare(
        `INSERT INTO ciclos_prenda (tipo_prenda_id, ciclos_acumulados_promedio, ultima_actualizacion)
         VALUES (?, ?, ?)
         ON CONFLICT (tipo_prenda_id)
         DO UPDATE SET ciclos_acumulados_promedio = excluded.ciclos_acumulados_promedio,
                       ultima_actualizacion = excluded.ultima_actualizacion`
      )
      .run(tipoId, promedio, fecha || '');
  },
};

// ---------- Inventarios (conteo físico ciego por sector) ----------
export const inventariosRepo = {
  crear({ fecha, sector_id, usuario, observaciones }) {
    const info = getDb()
      .prepare(
        `INSERT INTO inventarios (fecha, sector_id, usuario, estado, observaciones)
         VALUES (?, ?, ?, 'EN_CURSO', ?)`
      )
      .run(fecha, sector_id, usuario || '', observaciones || '');
    return Number(info.lastInsertRowid);
  },
  obtener(id) {
    return getDb()
      .prepare(
        `SELECT i.*, s.nombre AS sector
         FROM inventarios i JOIN sectores s ON s.id = i.sector_id
         WHERE i.id = ?`
      )
      .get(id) || null;
  },
  listar({ estado, sector_id } = {}) {
    const where = [];
    const params = [];
    if (estado) { where.push('i.estado = ?'); params.push(estado); }
    if (sector_id) { where.push('i.sector_id = ?'); params.push(sector_id); }
    const sql = `
      SELECT i.*, s.nombre AS sector
      FROM inventarios i JOIN sectores s ON s.id = i.sector_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY i.fecha DESC, i.id DESC`;
    return getDb().prepare(sql).all(...params);
  },
  // Inventario EN_CURSO del sector, o null (guard anti-duplicado).
  abiertoPorSector(sectorId) {
    return getDb()
      .prepare(`SELECT * FROM inventarios WHERE sector_id = ? AND estado = 'EN_CURSO' LIMIT 1`)
      .get(sectorId) || null;
  },
  crearItem(inventarioId, { tipo_prenda_id, cantidad_teorica }) {
    const info = getDb()
      .prepare(
        `INSERT INTO inventario_items (inventario_id, tipo_prenda_id, cantidad_teorica)
         VALUES (?, ?, ?)`
      )
      .run(inventarioId, tipo_prenda_id, cantidad_teorica);
    return Number(info.lastInsertRowid);
  },
  itemsDe(inventarioId) {
    return getDb()
      .prepare(
        `SELECT ii.*, tp.nombre AS tipo_prenda
         FROM inventario_items ii
         JOIN tipos_prenda tp ON tp.id = ii.tipo_prenda_id
         WHERE ii.inventario_id = ?
         ORDER BY ii.tipo_prenda_id`
      )
      .all(inventarioId);
  },
  setContada(inventarioId, tipoPrendaId, cantidadContada) {
    getDb()
      .prepare(
        `UPDATE inventario_items SET cantidad_contada = ?
         WHERE inventario_id = ? AND tipo_prenda_id = ?`
      )
      .run(cantidadContada, inventarioId, tipoPrendaId);
  },
  setDiferencia(itemId, diferencia) {
    getDb()
      .prepare('UPDATE inventario_items SET diferencia = ? WHERE id = ?')
      .run(diferencia, itemId);
  },
  cerrar(inventarioId, { observaciones } = {}) {
    getDb()
      .prepare(`UPDATE inventarios SET estado = 'CERRADO', observaciones = ? WHERE id = ?`)
      .run(observaciones || '', inventarioId);
  },
};

// ---------- Ajustes de stock ----------
export const ajustesRepo = {
  crear({ fecha, sector_id, tipo_prenda_id, delta, motivo, autorizado_por, inventario_id }) {
    const info = getDb()
      .prepare(
        `INSERT INTO ajustes (fecha, sector_id, tipo_prenda_id, delta, motivo, autorizado_por, inventario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(fecha, sector_id, tipo_prenda_id, delta, motivo, autorizado_por || '', inventario_id ?? null);
    return Number(info.lastInsertRowid);
  },
  listar(desde, hasta) {
    return getDb()
      .prepare(
        `SELECT a.*, tp.nombre AS tipo_prenda, s.nombre AS sector
         FROM ajustes a
         JOIN tipos_prenda tp ON tp.id = a.tipo_prenda_id
         JOIN sectores s ON s.id = a.sector_id
         WHERE a.fecha >= ? AND a.fecha <= ?
         ORDER BY a.fecha DESC, a.id DESC`
      )
      .all(desde, hasta);
  },
  // Merma interna del mes: suma de los deltas negativos (unidades perdidas) y su costo.
  resumenNegativosMes(anioMesPrefix) {
    const prefijo = anioMesPrefix || new Date().toISOString().slice(0, 7);
    const row = getDb()
      .prepare(
        `SELECT COALESCE(-SUM(a.delta), 0) AS unidades,
                COALESCE(-SUM(a.delta * tp.costo_reposicion_ars), 0) AS ars
         FROM ajustes a
         JOIN tipos_prenda tp ON tp.id = a.tipo_prenda_id
         WHERE a.delta < 0 AND substr(a.fecha, 1, 7) = ?`
      )
      .get(prefijo);
    return { unidades: row.unidades, ars: row.ars };
  },
};

// ---------- Presets de carga (plantillas de líneas reutilizables) ----------
export const presetsRepo = {
  // Adjunta los items (con nombre de tipo) a una fila de preset.
  _conItems(preset) {
    if (!preset) return null;
    const items = getDb()
      .prepare(
        `SELECT pi.tipo_prenda_id, tp.nombre AS tipo_prenda, pi.cantidad
         FROM presets_items pi
         JOIN tipos_prenda tp ON tp.id = pi.tipo_prenda_id
         WHERE pi.preset_id = ?
         ORDER BY pi.id`
      )
      .all(preset.id);
    return { ...preset, activo: preset.activo, items };
  },
  listar({ sector_id, activo } = {}) {
    const where = [];
    const params = [];
    // sector_id: trae los del sector + los globales (sector_id IS NULL).
    if (sector_id !== undefined && sector_id !== null) {
      where.push('(p.sector_id = ? OR p.sector_id IS NULL)');
      params.push(sector_id);
    }
    if (activo !== undefined && activo !== null) {
      where.push('p.activo = ?');
      params.push(activo ? 1 : 0);
    }
    const sql = `
      SELECT p.*, s.nombre AS sector
      FROM presets_carga p
      LEFT JOIN sectores s ON s.id = p.sector_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.nombre, p.id`;
    return getDb().prepare(sql).all(...params).map((p) => this._conItems(p));
  },
  obtener(id) {
    const preset = getDb()
      .prepare(
        `SELECT p.*, s.nombre AS sector
         FROM presets_carga p LEFT JOIN sectores s ON s.id = p.sector_id
         WHERE p.id = ?`
      )
      .get(id);
    return this._conItems(preset);
  },
  crear({ nombre, sector_id, activo, items }) {
    return enTransaccion(() => {
      const info = getDb()
        .prepare('INSERT INTO presets_carga (nombre, sector_id, activo) VALUES (?, ?, ?)')
        .run(nombre, sector_id ?? null, activo === undefined ? 1 : (activo ? 1 : 0));
      const id = Number(info.lastInsertRowid);
      this._reemplazarItems(id, items || []);
      return id;
    });
  },
  actualizar(id, { nombre, sector_id, activo, items }) {
    return enTransaccion(() => {
      getDb()
        .prepare('UPDATE presets_carga SET nombre = ?, sector_id = ?, activo = ? WHERE id = ?')
        .run(nombre, sector_id ?? null, activo === undefined ? 1 : (activo ? 1 : 0), id);
      this._reemplazarItems(id, items || []);
      return this.obtener(id);
    });
  },
  _reemplazarItems(presetId, items) {
    getDb().prepare('DELETE FROM presets_items WHERE preset_id = ?').run(presetId);
    const ins = getDb().prepare(
      'INSERT INTO presets_items (preset_id, tipo_prenda_id, cantidad) VALUES (?, ?, ?)'
    );
    for (const it of items) {
      ins.run(presetId, it.tipo_prenda_id, it.cantidad);
    }
  },
  eliminar(id) {
    // presets_items cae por ON DELETE CASCADE.
    getDb().prepare('DELETE FROM presets_carga WHERE id = ?').run(id);
  },
};

// ---------- Prendas identificadas (barcode-ready) ----------
export const prendasRepo = {
  listar({ estado, tipo_prenda_id } = {}) {
    const where = [];
    const params = [];
    if (estado) { where.push('p.estado = ?'); params.push(estado); }
    if (tipo_prenda_id) { where.push('p.tipo_prenda_id = ?'); params.push(tipo_prenda_id); }
    const sql = `
      SELECT p.*, tp.nombre AS tipo_prenda, s.nombre AS sector_actual
      FROM prendas_identificadas p
      JOIN tipos_prenda tp ON tp.id = p.tipo_prenda_id
      LEFT JOIN sectores s ON s.id = p.sector_actual_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY p.codigo`;
    return getDb().prepare(sql).all(...params);
  },
  obtenerPorCodigo(codigo) {
    return getDb()
      .prepare(
        `SELECT p.*, tp.nombre AS tipo_prenda, s.nombre AS sector_actual
         FROM prendas_identificadas p
         JOIN tipos_prenda tp ON tp.id = p.tipo_prenda_id
         LEFT JOIN sectores s ON s.id = p.sector_actual_id
         WHERE p.codigo = ?`
      )
      .get(codigo) || null;
  },
  existeCodigo(codigo) {
    const row = getDb()
      .prepare('SELECT 1 FROM prendas_identificadas WHERE codigo = ? LIMIT 1')
      .get(codigo);
    return !!row;
  },
  crear({ codigo, tipo_prenda_id, sector_actual_id, fecha_alta }) {
    const info = getDb()
      .prepare(
        `INSERT INTO prendas_identificadas
           (codigo, tipo_prenda_id, estado, sector_actual_id, ciclos, fecha_alta)
         VALUES (?, ?, 'EN_SECTOR', ?, 0, ?)`
      )
      .run(codigo, tipo_prenda_id, sector_actual_id ?? null, fecha_alta);
    return Number(info.lastInsertRowid);
  },
  // Update parcial: solo pisa los campos presentes en `cambios`.
  actualizar(codigo, cambios = {}) {
    const sets = [];
    const params = [];
    if ('estado' in cambios) { sets.push('estado = ?'); params.push(cambios.estado); }
    if ('sector_actual_id' in cambios) { sets.push('sector_actual_id = ?'); params.push(cambios.sector_actual_id ?? null); }
    if ('ciclos' in cambios) { sets.push('ciclos = ?'); params.push(cambios.ciclos); }
    if ('fecha_baja' in cambios) { sets.push('fecha_baja = ?'); params.push(cambios.fecha_baja ?? null); }
    if (!sets.length) return;
    params.push(codigo);
    getDb()
      .prepare(`UPDATE prendas_identificadas SET ${sets.join(', ')} WHERE codigo = ?`)
      .run(...params);
  },
};
