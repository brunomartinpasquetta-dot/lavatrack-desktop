// Migraciones incrementales sobre bases EXISTENTES (sin pérdida de datos).
// Se ejecutan después de aplicar el esquema base. Cada paso es idempotente:
// verifica si ya está aplicado antes de tocar nada, así correr N veces es seguro.

// ¿La tabla tiene esa columna?
function tieneColumna(db, tabla, columna) {
  const cols = db.prepare(`PRAGMA table_info(${tabla})`).all();
  return cols.some((c) => c.name === columna);
}

// Agrega una columna si falta (ALTER idempotente).
function agregarColumnaSiFalta(db, tabla, columna, definicion) {
  if (!tieneColumna(db, tabla, columna)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion};`);
    return true;
  }
  return false;
}

// Reconstruye movimientos_stock para ampliar el CHECK de motivo (SQLite no permite
// ALTER de un CHECK: hay que crear la tabla nueva, copiar, drop, rename y recrear
// índices). Se hace con foreign_keys OFF y dentro de una transacción propia, siguiendo
// el procedimiento seguro de rebuild de la doc de SQLite. Nada referencia a
// movimientos_stock con FK, así que el rename es seguro.
function reconstruirMovimientosStock(db) {
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE movimientos_stock__nueva (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        sector_id INTEGER NOT NULL REFERENCES sectores(id),
        tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
        delta INTEGER NOT NULL,
        motivo TEXT NOT NULL CHECK (motivo IN ('ENVIO','RETORNO','BAJA_ROTURA','BAJA_PERDIDA','BAJA_FIN_VIDA_UTIL','ALTA_REPOSICION','AJUSTE','REINGRESO_REPROCESO')),
        remito_id INTEGER REFERENCES remitos(id)
      );
    `);
    db.exec(`
      INSERT INTO movimientos_stock__nueva (id, fecha, sector_id, tipo_prenda_id, delta, motivo, remito_id)
      SELECT id, fecha, sector_id, tipo_prenda_id, delta, motivo, remito_id FROM movimientos_stock;
    `);
    db.exec('DROP TABLE movimientos_stock;');
    db.exec('ALTER TABLE movimientos_stock__nueva RENAME TO movimientos_stock;');
    // Los índices se perdieron con la tabla vieja: recreamos el covering (AUD-011).
    db.exec('CREATE INDEX IF NOT EXISTS idx_mov_cover ON movimientos_stock(sector_id, tipo_prenda_id, delta);');
    db.exec('PRAGMA foreign_key_check;');
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ya sin transacción */ }
    db.exec('PRAGMA foreign_keys = ON;');
    throw e;
  }
  db.exec('PRAGMA foreign_keys = ON;');
}

export function correrMigraciones(db) {
  const cambios = [];

  // --- M1: sectores.metodo_reposicion (default PAR) ---
  // El CHECK va solo en el esquema fresco; en bases viejas alcanza con el default,
  // la validación de valores se hace en la capa de servicio.
  if (agregarColumnaSiFalta(db, 'sectores', 'metodo_reposicion', "TEXT NOT NULL DEFAULT 'PAR'")) {
    cambios.push('sectores.metodo_reposicion');
  }

  // --- M2: remito_items desglose de calidad en retorno ---
  for (const col of ['cantidad_relavado', 'cantidad_costura', 'cantidad_descarte']) {
    if (agregarColumnaSiFalta(db, 'remito_items', col, 'INTEGER NOT NULL DEFAULT 0')) {
      cambios.push(`remito_items.${col}`);
    }
  }

  // --- M3: tabla dotacion_par (la crea el esquema base con IF NOT EXISTS) ---
  // Backfill: por cada mínimo en sectores.stock_minimo_json que no tenga fila en
  // dotacion_par, insertar cantidad_minima = ese mínimo y cantidad_par = mínima × 2.
  const sectores = db.prepare('SELECT id, stock_minimo_json FROM sectores').all();
  const existe = db.prepare(
    'SELECT 1 FROM dotacion_par WHERE sector_id = ? AND tipo_prenda_id = ?'
  );
  const insertar = db.prepare(
    `INSERT INTO dotacion_par (sector_id, tipo_prenda_id, cantidad_par, cantidad_minima)
     VALUES (?, ?, ?, ?)`
  );
  let filasPar = 0;
  for (const s of sectores) {
    let minimos = {};
    try {
      minimos = JSON.parse(s.stock_minimo_json || '{}');
    } catch {
      minimos = {};
    }
    for (const [tipoIdStr, minimo] of Object.entries(minimos)) {
      const tipoId = Number(tipoIdStr);
      const min = Number(minimo) || 0;
      if (!existe.get(s.id, tipoId)) {
        insertar.run(s.id, tipoId, min * 2, min);
        filasPar++;
      }
    }
  }
  if (filasPar > 0) cambios.push(`dotacion_par (+${filasPar} filas backfill)`);

  // --- M4: motivo BAJA_FIN_VIDA_UTIL en movimientos_stock (AUD-002) ---
  // 4a) Ampliar el CHECK de motivo para admitir BAJA_FIN_VIDA_UTIL. Idempotente:
  // solo reconstruye si el CHECK actual (en sqlite_master.sql) todavía no lo admite.
  const movSql = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='movimientos_stock'")
    .get();
  if (movSql && !movSql.sql.includes('BAJA_FIN_VIDA_UTIL')) {
    reconstruirMovimientosStock(db);
    cambios.push('movimientos_stock (CHECK ampliado con BAJA_FIN_VIDA_UTIL)');
  }

  // 4b) Corregir movimientos históricos mal asentados: un movimiento BAJA_ROTURA con
  // delta<0 cuya (fecha, tipo_prenda_id, |delta|) coincide con una baja FIN_VIDA_UTIL
  // es en realidad un fin de vida útil aplastado a rotura → lo pasamos a BAJA_FIN_VIDA_UTIL.
  // NO toca los que corresponden a bajas ROTURA reales. Idempotente: al reasentarlos,
  // dejan de matchear como BAJA_ROTURA y en corridas siguientes changes = 0.
  const infoUpd = db
    .prepare(
      `UPDATE movimientos_stock
          SET motivo = 'BAJA_FIN_VIDA_UTIL'
        WHERE motivo = 'BAJA_ROTURA' AND delta < 0
          AND EXISTS (
            SELECT 1 FROM bajas b
             WHERE b.motivo = 'FIN_VIDA_UTIL'
               AND b.fecha = movimientos_stock.fecha
               AND b.tipo_prenda_id = movimientos_stock.tipo_prenda_id
               AND b.cantidad = -movimientos_stock.delta
          )`
    )
    .run();
  if (infoUpd.changes > 0) {
    cambios.push(`movimientos_stock (${infoUpd.changes} mov. BAJA_ROTURA→BAJA_FIN_VIDA_UTIL)`);
  }

  // --- M5: índice covering en movimientos_stock (AUD-011) ---
  // Reemplaza idx_mov_sector_tipo (no covering) por idx_mov_cover, que incluye delta
  // para resolver stockRepo.matriz() sin lookup a la tabla. Idempotente.
  const indices = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='movimientos_stock'")
    .all()
    .map((r) => r.name);
  db.exec('CREATE INDEX IF NOT EXISTS idx_mov_cover ON movimientos_stock(sector_id, tipo_prenda_id, delta);');
  if (indices.includes('idx_mov_sector_tipo')) {
    db.exec('DROP INDEX IF EXISTS idx_mov_sector_tipo;');
    cambios.push('idx_mov_sector_tipo → idx_mov_cover (covering)');
  }

  // --- M6: refactor de dominio (ciclos / inventario / ajustes / presets / prendas) ---
  // Las 7 tablas nuevas las crea el esquema base (SCHEMA_SQL, IF NOT EXISTS), igual que
  // dotacion_par en M3. Acá solo van los cambios in-place sobre tablas EXISTENTES.

  // 6a) remito_items.codigos_json (barcode-ready): JSON array de códigos o NULL.
  if (agregarColumnaSiFalta(db, 'remito_items', 'codigos_json', 'TEXT')) {
    cambios.push('remito_items.codigos_json');
  }

  // 6b) Ampliar el CHECK de movimientos_stock.motivo para admitir 'AJUSTE'. Idempotente:
  // solo reconstruye si el CHECK actual (en sqlite_master.sql) todavía no lo admite.
  // Reusa reconstruirMovimientosStock() (que ya genera el CHECK con 'AJUSTE' incluido).
  const movSqlAjuste = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='movimientos_stock'")
    .get();
  if (movSqlAjuste && !movSqlAjuste.sql.includes('AJUSTE')) {
    reconstruirMovimientosStock(db);
    cambios.push('movimientos_stock (CHECK ampliado con AJUSTE)');
  }

  // --- M8: firma doble + bajas manuales + reingreso de reproceso (Ola 2) ---
  // 8a) Columnas nuevas (ALTER idempotente). El CHECK del motivo de bajas/ajustes va
  //     solo en el esquema fresco; la validación de valores la hace la capa de servicio.
  if (agregarColumnaSiFalta(db, 'bajas', 'sector_id', 'INTEGER REFERENCES sectores(id)')) {
    cambios.push('bajas.sector_id');
  }
  if (agregarColumnaSiFalta(db, 'bajas', 'cofirmante', 'TEXT')) {
    cambios.push('bajas.cofirmante');
  }
  if (agregarColumnaSiFalta(db, 'ajustes', 'cofirmante', 'TEXT')) {
    cambios.push('ajustes.cofirmante');
  }

  // 8b) Ampliar el CHECK de movimientos_stock.motivo para admitir 'REINGRESO_REPROCESO'.
  //     Idempotente: solo reconstruye si el CHECK actual (en sqlite_master.sql) todavía no
  //     lo admite. Reusa reconstruirMovimientosStock() (ya genera el CHECK completo).
  const movSqlReproceso = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='movimientos_stock'")
    .get();
  if (movSqlReproceso && !movSqlReproceso.sql.includes('REINGRESO_REPROCESO')) {
    reconstruirMovimientosStock(db);
    cambios.push('movimientos_stock (CHECK ampliado con REINGRESO_REPROCESO)');
  }

  // --- M7: usuarios (auth Fase 1) ---
  // La tabla usuarios + idx_usuarios_usuario los crea el esquema base (SCHEMA_SQL,
  // IF NOT EXISTS), igual que dotacion_par (M3) y el refactor de dominio (M6). NO se
  // duplica el CREATE TABLE acá. La carga de los usuarios demo la hace el seed.
  //
  // Guard anti-lockout (idempotente): si la tabla YA tiene usuarios pero ninguno es
  // ADMIN activo, se reactiva el ADMIN de menor id (evita quedar sin acceso admin sobre
  // una base migrada). Si no existe ningún ADMIN, no hace nada (el seed crea el admin).
  const hayUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
  if (hayUsuarios > 0) {
    const adminsActivos = db
      .prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'ADMIN' AND activo = 1")
      .get().n;
    if (adminsActivos === 0) {
      const info = db
        .prepare(
          `UPDATE usuarios SET activo = 1
            WHERE id = (SELECT id FROM usuarios WHERE rol = 'ADMIN' ORDER BY id LIMIT 1)`
        )
        .run();
      if (info.changes > 0) cambios.push('usuarios (reactivado 1 ADMIN para garantizar acceso)');
    }
  }

  if (cambios.length) {
    console.log('[migrations] Aplicadas:', cambios.join(', '));
  }
  return cambios;
}
