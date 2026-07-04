# Checklist de Demostración — LavaTrack (8 pasos)

> Guion para la reunión con la clínica. Duración estimada: 8–10 min.
> **Antes de empezar:** correr `npm run demo`, abrir **http://localhost:3051** en pantalla completa (idealmente 1440×900).
> La base arranca con datos ficticios ya cargados (60 días de historia). Sin login (demo).

## Preparación (30 s antes de la reunión)
- [ ] `npm run demo` levantó el server y muestra el resumen en consola.
- [ ] http://localhost:3051 carga en el Dashboard sin errores.
- [ ] Zoom del navegador en 100 %, ventana maximizada.

---

## Los 8 pasos

| # | Ruta | Acción | Qué mostrar / decir |
|---|------|--------|---------------------|
| **1** | `/dashboard` | Abrir el panel principal | "Esto ve la administración cada mañana": KPIs de **prendas en lavandería**, **kg del mes** y **mermas del mes en $**. Señalar el panel de **alertas de stock bajo** y los **últimos remitos**. |
| **2** | `/stock` | Mostrar la matriz sector × prenda | El **semáforo**: verde OK, amarillo bajo, **rojo crítico**. "De un vistazo sabés qué falta y en qué sector" (ej. Toalla en Guardia en rojo). |
| **3** | `/remitos` | Filtrar por estado | Mostrar el historial completo. Filtrar por **CON_DIFERENCIA** y por **sector**. Señalar los **badges de color** por estado. |
| **4** | `/remitos/nuevo` | Crear un envío en vivo | Elegir **sector**, agregar 2 líneas (ej. Sábana 20 / Toalla 15), marcar algunas **contaminadas** (bolsa roja). Mostrar el **peso estimado que se calcula solo**. Confirmar → queda **ENVIADO**. |
| **5** | `/remitos/:id` (el recién creado, o un **pendiente** existente) | Registrar el retorno | Botón **"Registrar retorno"**: precarga las líneas. Devolver **menos** de un tipo (ej. 18 de 20 sábanas) para simular una pérdida. Confirmar. |
| **6** | `/remitos/:id` | Ver la conciliación | El sistema marca **CON_DIFERENCIA**: muestra enviado vs recibido, el **faltante** y **cuánto costó** (resaltado en rojo, en ARS). "El sistema te pone precio a lo que no volvió." |
| **7** | `/mermas` | Ver el reporte del período | El faltante recién generado ya aparece en **Faltantes por conciliación**. Totales de **merma en unidades y en $**. Mostrar también las **bajas** por rotura / fin de vida útil. |
| **8** | `/stock` | Cerrar el círculo | Volver a Stock: la prenda faltante **bajó el nivel** del sector (puede haber pasado a bajo/crítico). "Todo el circuito queda trazado y valorizado, sin planillas." |

---

## Puntos de venta para remarcar durante la demo
- **Conciliación automática**: nadie compara remitos a mano; el sistema detecta el faltante y lo valoriza.
- **Todo en pesos**: cada pérdida tiene costo de reposición → argumento directo para justificar el sistema.
- **Alertas de stock**: evita quedarse sin ropa en un sector crítico (Quirófano, Guardia).
- **Trazabilidad**: quién firmó, cuándo, qué sector, cuánto pesó cada lote.

## Datos de la demo (para referencia del presentador)
- **6 sectores**: Internación A, Internación B, Quirófano, Guardia, Consultorios, Ropería Central.
- **7 tipos de prenda** con peso, vida útil y costo de reposición en ARS.
- **2 remitos pendientes de retorno** listos para demostrar el paso 5 sin tener que crear uno.
- **3 remitos con diferencia** ya cargados para mostrar conciliación (paso 6) si se prefiere no crear en vivo.

## Si algo falla en vivo (plan B)
- Si no querés crear un envío nuevo, usá directamente un **remito pendiente** (Dashboard → últimos remitos → uno en estado *Enviado*) para el paso 5.
- Para mostrar conciliación sin crear nada, abrí un remito ya **CON_DIFERENCIA** desde `/remitos` (filtro por estado).
- Para reiniciar los datos a cero: detener el server, borrar `server/data/lavatrack.db` y volver a correr `npm run demo`.
