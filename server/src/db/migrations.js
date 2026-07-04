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

  if (cambios.length) {
    console.log('[migrations] Aplicadas:', cambios.join(', '));
  }
  return cambios;
}
