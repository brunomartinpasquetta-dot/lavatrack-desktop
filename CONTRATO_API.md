# LavaTrack — Contrato API + Diseño (fuente de verdad compartida)

Demo de gestión de ropa hospitalaria (circuito clínica ↔ lavandería tercerizada).
Todo el servidor corre en **http://localhost:3051**. API bajo prefijo **`/api`**.
Sin autenticación en esta demo. Todo en español rioplatense. Moneda: ARS.

---

## 1. Dominio (enums y formatos)

- **Sectores**: Internación A, Internación B, Quirófano, Guardia, Consultorios, Ropería Central.
- **Tipos de prenda**: Sábana, Funda de almohada, Frazada, Toalla, Ambo, Camisolín, Campo quirúrgico.
- **Remito.tipo**: `ENVIO` | `RETORNO`.
- **Remito.estado**: `BORRADOR` | `ENVIADO` | `RECIBIDO` | `CONCILIADO` | `CON_DIFERENCIA`.
- **Movimiento.motivo**: `ENVIO` | `RETORNO` | `BAJA_ROTURA` | `BAJA_PERDIDA` | `ALTA_REPOSICION`.
- **Baja.motivo**: `ROTURA` | `PERDIDA` | `FIN_VIDA_UTIL`.
- **Número de remito**: formato `LT-2026-0001` (secuencial, 4 dígitos).
- **Semáforo stock**: `ok` (>= mínimo) | `bajo` (>=50% del mínimo y < mínimo) | `critico` (< 50% del mínimo).

---

## 2. Endpoints

### GET `/api/dashboard`
```json
{
  "prendas_en_lavanderia": 342,
  "kg_enviados_mes": 128.5,
  "mermas_mes": { "unidades": 14, "ars": 245800 },
  "sectores_stock_bajo": [
    { "sector_id": 1, "sector": "Internación A", "tipo_prenda": "Sábana", "actual": 40, "minimo": 80, "nivel": "critico" }
  ],
  "ultimos_remitos": [
    { "id": 30, "numero": "LT-2026-0025", "tipo": "ENVIO", "estado": "ENVIADO",
      "fecha": "2026-06-28", "sector": "Quirófano", "peso_total_kg": 12.3, "firmante": "María Gómez" }
  ]
}
```

### GET `/api/stock`
Matriz sector × tipo de prenda.
```json
{
  "tipos_prenda": [ { "id": 1, "nombre": "Sábana" }, ... ],
  "sectores": [
    {
      "sector_id": 1, "sector": "Internación A",
      "celdas": [
        { "tipo_prenda_id": 1, "tipo_prenda": "Sábana", "actual": 40, "minimo": 80, "nivel": "critico" }
      ]
    }
  ]
}
```

### GET `/api/mermas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
`desde`/`hasta` opcionales (default: últimos 60 días).
```json
{
  "desde": "2026-05-04", "hasta": "2026-07-03",
  "totales": { "unidades": 47, "ars": 812400 },
  "diferencias": [
    { "remito_id": 12, "numero": "LT-2026-0008", "fecha": "2026-06-10", "sector": "Guardia",
      "tipo_prenda": "Toalla", "faltante": 6, "costo_unitario": 8500, "costo_ars": 51000 }
  ],
  "bajas": [
    { "id": 3, "fecha": "2026-06-15", "tipo_prenda": "Sábana", "cantidad": 5,
      "motivo": "FIN_VIDA_UTIL", "autorizado_por": "Lic. Roberto Díaz", "costo_ars": 75000 }
  ]
}
```

### GET `/api/remitos?estado=&sector_id=&tipo=&desde=&hasta=`
Todos los filtros opcionales. Devuelve array (sin items anidados, para el listado):
```json
[
  { "id": 30, "numero": "LT-2026-0025", "tipo": "ENVIO", "estado": "ENVIADO",
    "fecha": "2026-06-28", "sector_id": 3, "sector": "Quirófano",
    "peso_total_kg": 12.3, "firmante": "María Gómez", "observaciones": "",
    "remito_envio_id": null, "total_prendas": 45 }
]
```

### GET `/api/remitos/:id`
Detalle con items anidados. Si es ENVIO, incluye `retorno` (el remito de retorno vinculado, o null) y `conciliacion` (si aplica).
```json
{
  "id": 12, "numero": "LT-2026-0008", "tipo": "ENVIO", "estado": "CON_DIFERENCIA",
  "fecha": "2026-06-10", "sector_id": 4, "sector": "Guardia",
  "peso_total_kg": 18.2, "firmante": "Juan Pérez", "observaciones": "",
  "remito_envio_id": null,
  "items": [
    { "id": 1, "tipo_prenda_id": 1, "tipo_prenda": "Sábana", "cantidad": 30,
      "cantidad_contaminada": 4, "peso_promedio_gr": 600 }
  ],
  "retorno": {
    "id": 13, "numero": "LT-2026-0009", "tipo": "RETORNO", "estado": "RECIBIDO",
    "fecha": "2026-06-12", "firmante": "Ana Ruiz",
    "items": [ { "tipo_prenda_id": 1, "tipo_prenda": "Sábana", "cantidad": 28, "cantidad_contaminada": 0 } ]
  },
  "conciliacion": {
    "estado": "CON_DIFERENCIA",
    "diferencias": [
      { "tipo_prenda_id": 1, "tipo_prenda": "Sábana", "enviado": 30, "recibido": 28,
        "faltante": 2, "costo_unitario": 2500, "costo_ars": 5000 }
    ],
    "costo_total_ars": 5000
  }
}
```
En un ENVIO sin retorno: `retorno: null`, `conciliacion: null`.

### POST `/api/remitos`  (crear ENVIO o RETORNO)
Body:
```json
{
  "tipo": "ENVIO",
  "sector_id": 3,
  "fecha": "2026-07-03",
  "firmante": "María Gómez",
  "observaciones": "",
  "remito_envio_id": null,
  "items": [ { "tipo_prenda_id": 1, "cantidad": 30, "cantidad_contaminada": 4 } ]
}
```
Reglas:
- `cantidad` entero > 0; `cantidad_contaminada` entero >= 0 y <= cantidad.
- `sector_id` y cada `tipo_prenda_id` deben existir → 400 con mensaje claro si no.
- ENVIO: descuenta stock del sector (movimientos motivo ENVIO, delta negativo). Estado inicial `ENVIADO`.
- RETORNO: requiere `remito_envio_id` válido de un ENVIO no conciliado. Suma stock (motivo RETORNO). Al crearse, **dispara conciliación automática**.
- Validación RETORNO: si alguna cantidad recibida > enviada para ese tipo, rechazar con 400 salvo `confirmar: true` en el body.
- No permitir crear RETORNO para un ENVIO ya conciliado (400).
Respuesta 201: el remito creado (mismo shape que GET `/api/remitos/:id`).

### POST `/api/remitos/:id/conciliar`
Reconcilia manualmente un ENVIO con su RETORNO (idempotencia: si ya está CONCILIADO/CON_DIFERENCIA → 400 "El envío ya fue conciliado").
- Compara cantidades por tipo. Todo devuelto → estado `CONCILIADO`. Falta algo → `CON_DIFERENCIA` + detalle de faltantes con costo de reposición (costo_reposicion_ars del tipo × faltante). Registra movimientos/bajas de merma si corresponde.
Respuesta 200: el remito ENVIO con su `conciliacion` (mismo shape que GET detalle).

### CRUD tipos_prenda
- GET `/api/tipos-prenda` → array `{ id, nombre, peso_promedio_gr, vida_util_ciclos, costo_reposicion_ars }`
- POST `/api/tipos-prenda` (body sin id) → 201
- PUT `/api/tipos-prenda/:id` → 200
- DELETE `/api/tipos-prenda/:id` → 204

### CRUD sectores
- GET `/api/sectores` → array `{ id, nombre, stock_minimo: { "<tipo_prenda_id>": 80, ... } }`
- POST `/api/sectores` → 201
- PUT `/api/sectores/:id` → 200
- DELETE `/api/sectores/:id` → 204

### Errores
Todas las respuestas de error: `{ "error": "mensaje en español" }` con código HTTP correcto (400 validación, 404 no encontrado, 409 conflicto lógico opcional, 500 interno). Middleware centralizado.

---

## 3. Diseño Frontend (React + Vite + Tailwind, español rioplatense)

Identidad **propia** de LavaTrack (no reutilizar otros proyectos). Tema claro sanitario-profesional.

Paleta Tailwind:
- Base/fondos: `slate` (bg `slate-50`, texto `slate-800`, bordes `slate-200`).
- Primario: `teal-600` (sidebar activa, botones primarios, acentos de marca). Hover `teal-700`.
- Alertas/advertencias (stock bajo): `amber` (badge `amber-100`/`amber-700`).
- Diferencias / crítico / faltantes: `rose` (badge `rose-100`/`rose-700`).
- OK / conciliado / éxito: `emerald`.
- Tipografía: Inter del sistema (`font-family: Inter, system-ui, sans-serif`).
- Cards: `bg-white rounded-xl shadow-sm border border-slate-200`.
- Sidebar fija a la izquierda (ancho ~240px), logo "LavaTrack" con ícono (una gota/prenda en SVG inline teal), navegación con ícono + nombre, item activo con fondo `teal-50` y texto `teal-700`.
- Layout denso y escaneable, tablas con `hover:bg-slate-50`.

Rutas (react-router-dom):
- `/` → redirige a `/dashboard`
- `/dashboard` → KPIs en cards (prendas en lavandería, kg del mes, mermas mes unidades+ARS), panel de alertas de stock bajo, tabla últimos 5 remitos.
- `/remitos` → listado con filtros (estado, sector, fecha desde/hasta), badge de color por estado, link a detalle.
- `/remitos/nuevo` → formulario ENVIO: selector sector, líneas (tipo_prenda + cantidad + cantidad contaminada), peso estimado calculado en vivo (Σ cantidad × peso_promedio_gr / 1000 kg), botón confirmar → POST.
- `/remitos/:id` → detalle. Si ENVIO sin retorno: botón "Registrar retorno" que abre formulario precargado con las líneas del envío (cantidades editables como recibidas) → POST RETORNO con remito_envio_id. Mostrar conciliación con diferencias resaltadas en rose.
- `/stock` → matriz sector × prenda con semáforo (celda coloreada: emerald ok / amber bajo / rose crítico), mostrando actual/mínimo.
- `/mermas` → reporte por período (inputs desde/hasta), tabla de diferencias y tabla de bajas, totales en unidades y ARS.

Badges por estado de remito:
- BORRADOR → slate, ENVIADO → teal, RECIBIDO → sky/blue, CONCILIADO → emerald, CON_DIFERENCIA → rose.

Componentes reutilizables mínimos: `Card`, `Badge`, `KpiCard`, `TablaRemitos`, `SemaforoStock`, `Sidebar`, `FiltrosRemitos`.

Config Vite: dev server con proxy `/api` → `http://localhost:3051`. Build a `client/dist`.
Helper `api.js` con fetch a rutas relativas `/api/...` (funciona igual en dev con proxy y en prod servido por Express).

Formato de moneda: `$ 245.800` (es-AR, sin decimales para ARS grandes). Fechas: `DD/MM/YYYY`.

---

## 4. AMPLIACIÓN — LavaTrack Desktop (refactor Electron + par + retorno categorizado)

### Sectores — método de reposición
`GET /api/sectores` y el detalle ahora incluyen `metodo_reposicion` (`PAR` | `CARRO_INTERCAMBIO` | `PEDIDO`, default PAR). POST/PUT lo aceptan.

### Stock — dotación par
Cada celda de `GET /api/stock` ahora incluye `par` además de `actual`/`minimo`/`nivel`. Cada fila de sector incluye `metodo_reposicion`. El `minimo` viene de la dotación par (`cantidad_minima`).

### Retorno categorizado por calidad
En `POST /api/remitos` con `tipo: 'RETORNO'`, cada línea de `items` acepta además:
`cantidad_relavado`, `cantidad_costura`, `cantidad_descarte` (enteros ≥ 0).
Regla: `relavado + costura + descarte ≤ cantidad` (el resto es "apta"). El descarte genera baja automática FIN_VIDA_UTIL. La **merma** se computa solo sobre lo NO retornado (`enviado − cantidad_total_retornado`); lo categorizado no es merma.
El bloque `conciliacion` del detalle del ENVÍO ahora incluye:
```json
"categorias": { "apta": 30, "relavado": 4, "costura": 3, "descarte": 3 }
```

### GET /api/reposicion  (Reposición del día)
```json
{
  "sectores": [
    {
      "sector_id": 1, "sector": "Internación A", "metodo_reposicion": "PAR",
      "lineas": [
        { "tipo_prenda_id": 1, "tipo_prenda": "Sábana", "stock_actual": 58, "minima": 80, "par": 160, "a_entregar": 102 }
      ]
    }
  ]
}
```
Por método: `PAR` → `a_entregar = max(0, par − stock_actual)`; `CARRO_INTERCAMBIO` → `a_entregar = par` (carga del carro); `PEDIDO` → `a_entregar = 0` (carga manual, sin sugerencia). La Ropería Central no aparece (es el origen).

### POST /api/reposicion/distribuir  (genera remito de distribución interna)
Body: `{ sector_id, firmante, observaciones?, items: [{ tipo_prenda_id, cantidad }] }` (cantidades enteras > 0).
Efecto: mueve stock de Ropería Central → sector (movimientos ALTA_REPOSICION). Respuesta 201:
```json
{ "id": 1, "numero": "LT-D-2026-0001", "fecha": "2026-07-03", "sector_id": 4, "sector": "Guardia",
  "firmante": "Enf. Vega", "observaciones": "", "lineas": [{ "tipo_prenda_id": 4, "cantidad": 60 }] }
```

### GET /api/health   (health-check para terminales)
`{ "ok": true, "servicio": "lavatrack", "puerto": 3051, "ips": [{ "interfaz": "en0", "ip": "192.168.18.158" }], "ts": 1234567890 }`

### GET /api/config  y  PUT /api/config   (ajustes de la instalación)
GET → `{ "puerto": 3051 }`. PUT body `{ "puerto": 3060 }` → `{ "config": { "puerto": 3060 }, "reiniciar": true }` (cambiar el puerto requiere reiniciar la app). Validación: entero 1024–65535.

### Página servida por el servidor (no SPA)
`GET /terminal-info` → HTML con las URLs de acceso LAN y el comando `chrome --app=...`.
