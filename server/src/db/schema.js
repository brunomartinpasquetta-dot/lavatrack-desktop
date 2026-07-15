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

-- Transportistas: quien traslada la ropa entre la clínica y la lavandería.
-- documento es libre (CUIT / DNI / patente); contacto es teléfono/observación libre.
-- activo=1 habilita su uso en remitos nuevos; el soft-delete se hace poniendo activo=0.
CREATE TABLE IF NOT EXISTS transportistas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  documento TEXT NOT NULL DEFAULT '',
  contacto TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1,
  fecha_alta TEXT NOT NULL
);

-- Remitos de envío (clínica → lavandería) y retorno (lavandería → clínica).
-- remito_envio_id vincula un RETORNO con su ENVIO de origen.
-- transportista_id (nullable): quién trasladó la ropa (Ola 4); alimenta el rótulo imprimible.
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
  remito_envio_id INTEGER REFERENCES remitos(id),
  transportista_id INTEGER REFERENCES transportistas(id)
);

-- Líneas de cada remito: cantidad total y cuántas van en bolsa roja (contaminada).
-- En RETORNO, la cantidad se desglosa por calidad al recibir de la lavandería:
--   apta (implícita) + relavado + costura + descarte = cantidad retornada.
-- El descarte genera baja automática (FIN_VIDA_UTIL); relavado y costura siguen "en lavandería".
-- codigos_json: JSON array de códigos de prendas identificadas de la línea (o NULL).
-- Se usa para el flujo barcode-ready; nullable para no romper líneas anónimas.
CREATE TABLE IF NOT EXISTS remito_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remito_id INTEGER NOT NULL REFERENCES remitos(id) ON DELETE CASCADE,
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  cantidad INTEGER NOT NULL,
  cantidad_contaminada INTEGER NOT NULL DEFAULT 0,
  cantidad_relavado INTEGER NOT NULL DEFAULT 0,
  cantidad_costura INTEGER NOT NULL DEFAULT 0,
  cantidad_descarte INTEGER NOT NULL DEFAULT 0,
  codigos_json TEXT
);

-- Libro mayor de movimientos de stock por sector y tipo de prenda.
-- delta positivo = ingreso al sector, negativo = egreso.
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  sector_id INTEGER NOT NULL REFERENCES sectores(id),
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  delta INTEGER NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('ENVIO','RETORNO','BAJA_ROTURA','BAJA_PERDIDA','BAJA_FIN_VIDA_UTIL','ALTA_REPOSICION','AJUSTE','REINGRESO_REPROCESO')),
  remito_id INTEGER REFERENCES remitos(id)
);

-- Registro de bajas de prendas (rotura, pérdida, fin de vida útil).
-- sector_id (nullable): sector del que se descuenta la baja manual (Ola 2, AUD-004).
-- cofirmante (nullable): usuario/nombre del supervisor que co-firma las bajas manuales.
CREATE TABLE IF NOT EXISTS bajas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  sector_id INTEGER REFERENCES sectores(id),
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  cantidad INTEGER NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('ROTURA','PERDIDA','FIN_VIDA_UTIL')),
  autorizado_por TEXT NOT NULL DEFAULT '',
  cofirmante TEXT
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

-- ============================================================================
-- Refactor de dominio: vida útil por ciclos, inventario cíclico, ajustes,
-- presets de carga y prendas identificadas (barcode-ready).
-- ============================================================================

-- Promedio de ciclos de lavado acumulado por tipo de prenda (nivel LOTE, no individual).
-- Se actualiza al conciliar retornos (suma ciclo prorrateado) y al dar de alta (dilución).
CREATE TABLE IF NOT EXISTS ciclos_prenda (
  tipo_prenda_id INTEGER PRIMARY KEY REFERENCES tipos_prenda(id) ON DELETE CASCADE,
  ciclos_acumulados_promedio REAL NOT NULL DEFAULT 0,
  ultima_actualizacion TEXT NOT NULL DEFAULT ''
);

-- Inventario físico cíclico por sector (conteo ciego). Cabecera.
CREATE TABLE IF NOT EXISTS inventarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  sector_id INTEGER NOT NULL REFERENCES sectores(id),
  usuario TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL CHECK (estado IN ('EN_CURSO','CERRADO')) DEFAULT 'EN_CURSO',
  observaciones TEXT NOT NULL DEFAULT ''
);

-- Líneas del inventario: teórico (snapshot al iniciar), contado (ciego) y diferencia (al cerrar).
CREATE TABLE IF NOT EXISTS inventario_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventario_id INTEGER NOT NULL REFERENCES inventarios(id) ON DELETE CASCADE,
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  cantidad_teorica INTEGER NOT NULL,
  cantidad_contada INTEGER,
  diferencia INTEGER
);

-- Ajustes de stock (por inventario, corrección manual o robo/pérdida). Cada uno
-- genera su movimiento AJUSTE en el kárdex (conciliable por (sector,tipo)).
CREATE TABLE IF NOT EXISTS ajustes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  sector_id INTEGER NOT NULL REFERENCES sectores(id),
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  delta INTEGER NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('INVENTARIO','CORRECCION','ROBO_PERDIDA')),
  autorizado_por TEXT NOT NULL DEFAULT '',
  inventario_id INTEGER REFERENCES inventarios(id),
  -- cofirmante (nullable): supervisor co-firmante exigido en ajustes motivo ROBO_PERDIDA (Ola 2).
  cofirmante TEXT
);

-- Presets de carga reutilizables (plantillas de líneas para remitos/carros).
-- sector_id NULL = preset global.
CREATE TABLE IF NOT EXISTS presets_carga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  sector_id INTEGER REFERENCES sectores(id),
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS presets_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preset_id INTEGER NOT NULL REFERENCES presets_carga(id) ON DELETE CASCADE,
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  cantidad INTEGER NOT NULL
);

-- Prendas identificadas individualmente (barcode-ready). Trazabilidad por unidad.
CREATE TABLE IF NOT EXISTS prendas_identificadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  tipo_prenda_id INTEGER NOT NULL REFERENCES tipos_prenda(id),
  estado TEXT NOT NULL CHECK (estado IN ('EN_SECTOR','EN_LAVANDERIA','BAJA')) DEFAULT 'EN_SECTOR',
  sector_actual_id INTEGER REFERENCES sectores(id),
  ciclos INTEGER NOT NULL DEFAULT 0,
  fecha_alta TEXT NOT NULL,
  fecha_baja TEXT
);

-- ============================================================================
-- Auth (Fase 1): usuarios del sistema con rol y credenciales scrypt.
-- password_hash/password_salt guardan el scrypt canónico (scryptSync keylen 64,
-- salt hex de 16 bytes, todo en hex) que el server usa para verificar el login.
-- rol define el nivel de acceso: ADMIN > SUPERVISOR > OPERARIO.
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('ADMIN','SUPERVISOR','OPERARIO')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  fecha_alta TEXT NOT NULL
);

-- Idempotencia de operaciones POST (AUD-010). El cliente manda un header
-- Idempotency-Key (UUID) por intento de operación; si la MISMA key se repite
-- (p. ej. reintento tras corte de red), se devuelve la entidad ya creada en
-- lugar de crear un duplicado. clave es PRIMARY KEY: el INSERT UNIQUE previene
-- la carrera. tipo/entidad_id apuntan a qué se creó (ej. 'REMITO' → remitos.id).
CREATE TABLE IF NOT EXISTS idempotencia (
  clave TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  entidad_id INTEGER NOT NULL,
  fecha TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dotacion_sector ON dotacion_par(sector_id);
CREATE INDEX IF NOT EXISTS idx_remitos_tipo_estado ON remitos(tipo, estado);
CREATE INDEX IF NOT EXISTS idx_remitos_envio ON remitos(remito_envio_id);
-- Orden de listado paginado de remitos (fecha DESC, id DESC) — AUD-012.
CREATE INDEX IF NOT EXISTS idx_remitos_fecha ON remitos(fecha DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_items_remito ON remito_items(remito_id);
-- Índice covering para stockRepo.matriz() (la query más caliente): incluye delta
-- para que el SUM(delta) por (sector_id, tipo_prenda_id) se resuelva sin lookup a la tabla.
CREATE INDEX IF NOT EXISTS idx_mov_cover ON movimientos_stock(sector_id, tipo_prenda_id, delta);
-- Índices del refactor de dominio.
CREATE INDEX IF NOT EXISTS idx_inv_items_inv ON inventario_items(inventario_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_fecha ON ajustes(fecha);
CREATE INDEX IF NOT EXISTS idx_presets_items_preset ON presets_items(preset_id);
CREATE INDEX IF NOT EXISTS idx_prendas_estado ON prendas_identificadas(estado);
-- Índice de auth: búsqueda por nombre de usuario en el login (usuario ya es UNIQUE,
-- el índice lo respalda explícitamente y documenta la intención de la query caliente).
CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios(usuario);
`;
