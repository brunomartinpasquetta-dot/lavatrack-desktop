// Capa de datos: todo el acceso a SQLite vive acá, agrupado por entidad.
// Los controladores y servicios NO ejecutan SQL directamente; usan estas funciones.
import { getDb } from './connection.js';

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

  crearItem(remitoId, { tipo_prenda_id, cantidad, cantidad_contaminada, cantidad_relavado, cantidad_costura, cantidad_descarte }) {
    getDb()
      .prepare(
        `INSERT INTO remito_items
           (remito_id, tipo_prenda_id, cantidad, cantidad_contaminada, cantidad_relavado, cantidad_costura, cantidad_descarte)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        remitoId, tipo_prenda_id, cantidad,
        cantidad_contaminada || 0, cantidad_relavado || 0, cantidad_costura || 0, cantidad_descarte || 0
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
};
