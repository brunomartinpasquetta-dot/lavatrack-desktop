// Definición del esquema SQLite de LavaTrack.
// Se ejecuta al abrir la base; los CREATE TABLE usan IF NOT EXISTS para ser idempotentes.

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- Sectores del circuito clínico. stock_minimo_json guarda un objeto
-- { "<tipo_prenda_id>": cantidad_minima } por cada tipo de prenda (compatibilidad).
-- La fuente de verdad de mínimos/par pasó a la tabla dotacion_par.
-- metodo_reposicion: PAR (repone hasta la dotación par) | CARRO_INTERCAMBIO | PEDIDO.
CREATE TABLE IF NOT EXISTS sectores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  stock_minimo_json TEXT NOT NULL DEFAULT '{}',
  metodo_reposicion TEXT NOT NULL DEFAULT 'PAR'
    CHECK (metodo_reposicion IN ('PAR','CARRO_INTERCAMBIO','PEDIDO'))
);

-- Dotación par por sector y tipo de prenda: cantidad ideal (par) y mínima (alerta).
CREATE TABLE IF NOT EXISTS dotacion_par (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sector_id INTEGER NOT NULL REFERENCES sectores(id) ON DELETE CASCADE,
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id) ON DELETE CASCADE,
  cantidad_par INTEGER NOT NULL DEFAULT 0,
  cantidad_minima INTEGER NOT NULL DEFAULT 0,
  UNIQUE (sector_id, tipo_prenda_id)
);

-- Catálogo de tipos de prenda con datos logísticos y de costo.
CREATE TABLE IF NOT EXISTS tipos_prenda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  peso_promedio_gr INTEGER NOT NULL,
  vida_util_ciclos INTEGER NOT NULL,
  costo_reposicion_ars INTEGER NOT NULL
);

-- Remitos de envío (clínica → lavandería) y retorno (lavandería → clínica).
-- remito_envio_id vincula un RETORNO con su ENVIO de origen.
CREATE TABLE IF NOT EXISTS remitos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENVIO','RETORNO')),
  fecha TEXT NOT NULL,
  sector_id INTEGER NOT NULL REFERENCES sectores(id),
  estado TEXT NOT NULL CHECK (estado IN ('BORRADOR','ENVIADO','RECIBIDO','CONCILIADO','CON_DIFERENCIA')),
  peso_total_kg REAL NOT NULL DEFAULT 0,
  firmante TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  remito_envio_id INTEGER REFERENCES remitos(id)
);

-- Líneas de cada remito: cantidad total y cuántas van en bolsa roja (contaminada).
-- En RETORNO, la cantidad se desglosa por calidad al recibir de la lavandería:
--   apta (implícita) + relavado + costura + descarte = cantidad retornada.
-- El descarte genera baja automática (FIN_VIDA_UTIL); relavado y costura siguen "en lavandería".
CREATE TABLE IF NOT EXISTS remito_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remito_id INTEGER NOT NULL REFERENCES remitos(id) ON DELETE CASCADE,
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  cantidad INTEGER NOT NULL,
  cantidad_contaminada INTEGER NOT NULL DEFAULT 0,
  cantidad_relavado INTEGER NOT NULL DEFAULT 0,
  cantidad_costura INTEGER NOT NULL DEFAULT 0,
  cantidad_descarte INTEGER NOT NULL DEFAULT 0
);

-- Libro mayor de movimientos de stock por sector y tipo de prenda.
-- delta positivo = ingreso al sector, negativo = egreso.
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  sector_id INTEGER NOT NULL REFERENCES sectores(id),
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  delta INTEGER NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('ENVIO','RETORNO','BAJA_ROTURA','BAJA_PERDIDA','ALTA_REPOSICION')),
  remito_id INTEGER REFERENCES remitos(id)
);

-- Registro de bajas de prendas (rotura, pérdida, fin de vida útil).
CREATE TABLE IF NOT EXISTS bajas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  cantidad INTEGER NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('ROTURA','PERDIDA','FIN_VIDA_UTIL')),
  autorizado_por TEXT NOT NULL DEFAULT ''
);

-- Remitos de distribución interna: reposición de Ropería Central hacia un sector.
-- Las líneas se guardan como JSON (documento simple); el impacto real de stock
-- queda registrado en movimientos_stock (motivo ALTA_REPOSICION).
CREATE TABLE IF NOT EXISTS distribuciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  fecha TEXT NOT NULL,
  sector_id INTEGER NOT NULL REFERENCES sectores(id),
  firmante TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  lineas_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_dotacion_sector ON dotacion_par(sector_id);
CREATE INDEX IF NOT EXISTS idx_remitos_tipo_estado ON remitos(tipo, estado);
CREATE INDEX IF NOT EXISTS idx_remitos_envio ON remitos(remito_envio_id);
CREATE INDEX IF NOT EXISTS idx_items_remito ON remito_items(remito_id);
CREATE INDEX IF NOT EXISTS idx_mov_sector_tipo ON movimientos_stock(sector_id, tipo_prenda_id);
`;
