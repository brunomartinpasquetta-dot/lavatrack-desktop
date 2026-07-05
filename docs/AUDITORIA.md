# Auditoría integral LavaTrack — Técnica + Dominio

**Fecha:** 2026-07-05 · **Alcance:** `/server`, `/client`, `/electron`, `/docs` · **Modo:** read-only (cero modificación de código/DB) · **Método:** 8 ejes en paralelo, con evidencia empírica (queries, `EXPLAIN QUERY PLAN`, scripts que ejercitan los servicios sobre DBs temporales aisladas; la DB demo no se tocó).

---

## 1. Resumen ejecutivo

**Veredicto global: OBSERVACIONES — apto para demo comercial, con deuda acotada para producción. Ningún hallazgo CRÍTICO.** El núcleo (kárdex como única fuente de verdad, atomicidad transaccional con rollback total, correlativo a prueba de concurrencia, separación de capas en el server, superficie de errores en español) está **verificado y sano**. Los hallazgos se concentran en: robustez de entradas, resiliencia ante fallos raros, completitud de dominio (reproceso, bajas manuales, obsolescencia) y fricción operativa en terminal táctil.

| Eje | Veredicto | Hallazgos (A/M/B) |
|---|---|---|
| 1 · Seguridad | OBSERVACIONES | 1 / 1 / 2 |
| 2 · Lógica de negocio | SANO c/observaciones | 0 / 2 / 1 |
| 3 · Manejo de errores | OBSERVACIONES | 0 / 2 / 2 |
| 4 · SOLID / calidad | OBSERVACIONES (server SANO) | 0 / 3 / 4 |
| 5 · Performance | SANO c/observaciones | 0 / 2 / 1 |
| 6 · Cumplimiento normativo | OBSERVACIONES | 0 / 3 / 0 |
| 7 · Fidelidad al dominio | OBSERVACIONES | 3 / 3 / 1 |
| 8 · Experiencia operativa | OBSERVACIONES | 2 / 4 / 4 |

**Total: 6 ALTA · 20 MEDIA · 15 BAJA · 0 CRÍTICA.**

> Nota: NO se re-reportan como hallazgos los pendientes ya documentados en el roadmap (Fase 1: autenticación, firma doble, rótulo normativo de impresión, entidad transportista) — salvo cuando su ausencia rompe algo hoy.

---

## 2. Hallazgos (ordenados por severidad)

### 🔴 ALTA

**AUD-001 · Eje 1 — Endpoints de escritura/borrado sin auth + CORS wildcard + bind 0.0.0.0 (DNS-rebinding).**
`server/src/app.js:25` (`cors()` sin opciones), `server/src/index.js:11` / `electron/main.js:68` (`0.0.0.0`), `server/src/routes/index.js:54,60` (`DELETE` sectores/tipos).
*Impacto:* la falta de auth es Fase 1 conocida, pero el matiz nuevo es que `cors()` reflejando cualquier origen + sin verificar `Host`/`Origin` permite que un navegador que visite una web maliciosa dispare `POST/PUT/DELETE` contra la API LAN (DNS-rebinding), incluido el borrado en cascada de sectores/tipos (`dotacion_par` con `ON DELETE CASCADE`, `schema.js:22-23`). Va más allá del "acceso físico a la LAN" ya asumido.
*Recomendación:* aunque la auth sea Fase 2, mitigar YA con (a) `cors()` restringido a orígenes conocidos, (b) chequeo de header `Host`/`Origin` anti-rebinding, (c) confirmación server-side o soft-delete en los `DELETE`.

**AUD-002 · Eje 7 — El descarte se registra en el kárdex con motivo `BAJA_ROTURA` siendo fin de vida útil.**
`server/src/services/remitosService.js:253-260` (la `bajas` usa `FIN_VIDA_UTIL` pero el movimiento de stock usa `BAJA_ROTURA`), `server/src/db/schema.js:76` (el CHECK no tiene un motivo de fin de vida), `server/src/db/seed.js:244` (mismo aplastamiento `FIN_VIDA_UTIL→BAJA_ROTURA`).
*Impacto:* el saldo corrido **por motivo** miente; la tabla `bajas` (motivo correcto) y el kárdex (motivo forzado a rotura) no concilian; cualquier reporte de causas de baja / auditoría de obsolescencia sale mal.
*Recomendación:* agregar `BAJA_FIN_VIDA_UTIL` al CHECK de `movimientos_stock` y usarlo en el descarte y en el seed.

**AUD-003 · Eje 7 — El reproceso (relavado/costura) nunca reingresa al stock ni sale de "en lavandería".**
`server/src/services/remitosService.js:229-242` (excluye relavado+costura del reingreso), `server/src/db/repositorios.js:237-245` (`prendasEnLavanderia` suma todo relavado+costura histórico sin vencimiento). No existe endpoint de reingreso del reproceso.
*Impacto:* el textil mandado a relavado/costura desaparece del inventario para siempre y el KPI "prendas en lavandería" crece de forma monótona (nunca baja por esa vía). En el estándar (rewash/repair) el reproceso es un ciclo que **vuelve** a stock. Gap nuevo, no en el roadmap.
*Recomendación:* modelar el reingreso del reproceso (segundo retorno o movimiento "reingreso de reproceso") para cerrar el ciclo.

**AUD-004 · Eje 7 — No hay forma de registrar bajas manuales (ROTURA / PÉRDIDA) en producción.**
`server/src/routes/index.js` (sin ruta de bajas); `bajasRepo.crear` solo se invoca desde `seed.js:231` y el descarte de retorno (`remitosService.js:246`). El motivo `PERDIDA` (`schema.js:86`) es inalcanzable en runtime.
*Impacto:* una rotura o pérdida detectada en sector/ropería no se puede registrar; la referencia (LinenTech/ISG) tiene alta de baja/ajuste manual.
*Recomendación:* endpoint `POST /bajas` que cree la baja **y** su movimiento de kárdex atómicamente.

**AUD-005 · Eje 8 — El firmante no se recuerda entre operaciones (re-tipeo constante).**
`client/src/pages/RemitoNuevo.jsx:25`, `RemitoDetalle.jsx:46,68`, `Reposicion.jsx:47`. Sin `localStorage`/`sessionStorage` en todo el client.
*Impacto:* el mismo operario tipea su nombre en cada envío, cada retorno y **cada sector** de la reposición (5 sectores = 5 veces en la misma pantalla). Texto libre → tipeos inconsistentes.
*Recomendación:* recordar el último firmante en `localStorage` y precargarlo; en Reposición, firmante único a nivel página. Idealmente selector de operarios.

**AUD-006 · Eje 8 — Ningún input de cantidad trae teclado numérico en táctil.**
`RemitoNuevo.jsx:207,218`, `RemitoDetalle.jsx:284,296,304,314`, `Reposicion.jsx:153` (`type="number"` sin `inputMode`). Cero `inputMode`/`pattern` en el client.
*Impacto:* en muchos navegadores táctiles `type="number"` no garantiza teclado numérico (y trae spinners + cambio de valor al hacer scroll con el dedo). Carga de cantidades más lenta y con errores.
*Recomendación:* `inputMode="numeric"` (o `"decimal"`) en todos los inputs de cantidad.

### 🟠 MEDIA

**AUD-007 · Eje 2 — Fechas sin validación (formato ni coherencia).** `server/src/services/remitosService.js:148,208`. Evidencia: retorno con fecha anterior al envío → aceptado; envío con fecha futura `2099-01-01` → aceptado; envío con fecha basura `"banana"` → persistido. *Impacto:* distorsiona mermas por período, `kgEnviadosUltimos30` y la antigüedad de pendientes (todos comparan strings). *Recomendación:* validar `YYYY-MM-DD`, no futura, y `fecha_retorno ≥ fecha_envio`.

**AUD-008 · Eje 2 — `confirmar:true` infla stock y admite tipos jamás enviados.** `remitosService.js:195-206,232-242`. Evidencia: retorno de 15 sobre envío de 10 con `confirmar:true` deja stock +5 sobre lo enviado; retorno con un `tipo_prenda_id` nunca enviado reingresa un tipo que jamás salió. *Impacto:* kárdex con movimientos positivos irreales. *Recomendación:* aun con `confirmar:true`, acotar el reingreso a lo enviado por tipo (o registrar el excedente con motivo auditable) y rechazar tipos ausentes del envío.

**AUD-009 · Eje 3 — Restore no valida integridad del backup antes de pisar la DB.** `server/src/db/backup.js:70-91`. Evidencia: un `.gz` gzip-válido con contenido basura completa el restore, deja la DB viva corrupta (`file is not a database` al reabrir) y solo se recupera renombrando `.pre-restore` a mano. *Impacto:* un backup dañado deja la app sin arrancar tras el relaunch. *Recomendación:* escribir a temporal, abrir con `DatabaseSync` + `PRAGMA integrity_check`, y solo entonces swap atómico (`renameSync`); ante fallo, restaurar `.pre-restore` automáticamente. (Nota: el caso gzip-inválido SÍ es seguro — falla antes de tocar la DB.)

**AUD-010 · Eje 3 — Sin idempotencia: corte de red tras el commit puede duplicar remitos.** `client/src/api.js:35-41` + `remitosService.js:135-176`. Si el server commitea y la respuesta se pierde, el operario reintenta y se crea un segundo remito con nuevo correlativo. *Impacto:* doble envío/distribución fantasma en red inestable. *Recomendación:* `Idempotency-Key` (UUID del cliente) + índice único server-side por lote.

**AUD-011 · Eje 5 — `stockRepo.matriz()` usa índice NO covering (la query más caliente).** `repositorios.js:214-222`, índice en `schema.js:107`. La disparan `/api/stock`, `/api/dashboard` y `/api/reposicion`; escanea las 15.027 filas (a 2 años) y hace lookup a la tabla por `delta`. Evidencia (misma DB): índice actual **2.45 ms** vs índice **covering** `(sector_id,tipo_prenda_id,delta)` **0.62 ms** (**4×**). *Recomendación:* `CREATE INDEX idx_mov_cover ON movimientos_stock(sector_id, tipo_prenda_id, delta);` (reemplaza al actual, lo prefija). Largo plazo: snapshot de stock.

**AUD-012 · Eje 5 — `/api/remitos` crece lineal sin paginación (payload + render).** `repositorios.js:116-132` (sin `LIMIT`), `client/src/pages/Remitos.jsx:146-160` (sin virtualización). Evidencia: 596 remitos → payload **138,9 KB**; a 5 años ~350 KB y ~1.500 `<tr>` montados. La subquery `total_prendas` está bien indexada (no es N+1 real). *Recomendación:* paginar (`LIMIT`/keyset por `fecha,id`) en server y grilla; índice `remitos(fecha DESC, id DESC)` para eliminar el `TEMP B-TREE FOR ORDER BY`.

**AUD-013 · Eje 6 — `cantidad_contaminada` (bolsa roja/biopeligroso) es un campo inerte.** Se captura y persiste solo en ENVÍO (`RemitoNuevo.jsx:80-82`, `repositorios.js:184-194`, `schema.js:62`) y se muestra (`RemitoDetalle.jsx:214`), pero **no dispara ningún control** (no está en conciliación/mermas/stock/alerta/rótulo) y en RETORNO se fuerza a 0 (`RemitoDetalle.jsx:110`). *Impacto:* el circuito no segrega ni alerta sobre material biopeligroso; el dato es decorativo. *Recomendación:* capturar contaminada también en retorno y usarla en algún control/alerta/rótulo, o documentar que es informativa.

**AUD-014 · Eje 6 — El peso es derivado (no medido) y el cruce de mermas es por unidades, no por kg.** `peso_total_kg = cantidad × peso_promedio_gr` (`remitosService.js:53-59`); `calcularFaltantes` cruza unidades, nunca kg (`remitosService.js:106-131`). El doc afirma lo contrario (`PROCESO-LAVANDERIA.md:22,33` "cruza unidades y kg"). *Impacto:* discrepancia doc↔código; el kg no puede detectar un desvío que las unidades no detecten (robo por peso). *Lado positivo:* el peso no es manipulable (siempre server-side, sin endpoint de edición). *Recomendación:* corregir el doc, o permitir pesaje real de balanza y cruzarlo como métrica independiente.

**AUD-015 · Eje 6 — Firmante opcional server-side en envío, retorno y distribución.** `RemitoNuevo.jsx:155-163` (sin obligatoriedad), `RemitoDetalle.jsx:353` (botón no valida firmante), `reposicionService.js:82` (acepta vacío; el `Reposicion.jsx:105` lo exige solo en cliente → evitable por API), `repositorios.js:180` (`firmante || ''`). *Impacto:* remitos sin operario responsable identificado, debilita la trazabilidad exigida por el proceso. *Recomendación:* exigir firmante no vacío en el server para envío, retorno y distribución.

**AUD-016 · Eje 1 — Electron sin `setWindowOpenHandler` ni `will-navigate`.** `electron/main.js:347-378`. *Impacto:* nada restringe que el renderer abra ventanas nuevas o navegue a URLs externas (acotado por sandbox+contextIsolation, pero es hardening estándar que falta). *Recomendación:* `webContents.setWindowOpenHandler(() => ({ action: 'deny' }))` + bloquear `will-navigate` fuera de `http://localhost:puerto`.

**AUD-017 · Eje 7 — `vida_util_ciclos` es dato muerto (sin contador de lavados ni alarma de obsolescencia).** `schema.js:34` (solo CRUD de catálogo). No hay contador de ciclos ni identidad por prenda/lote (stock agregado por sector×tipo). `PROCESO-LAVANDERIA.md:36` promete "alarma de obsolescencia" que no existe. *Recomendación:* requiere trazabilidad por lote/prenda; documentarlo como pendiente o quitarlo del discurso comercial hasta implementarlo.

**AUD-018 · Eje 7 — Movimientos de `ALTA_REPOSICION` y de bajas no referencian su documento de origen.** `reposicionService.js:96,106` (`remito_id: null`, sin `distribucion_id`); baja del seed `seed.js:245` (sin `baja_id`). *Impacto:* el saldo se reconstruye en total, pero cada delta no siempre es trazable hasta su comprobante. *Recomendación:* columna de referencia (`distribucion_id`/`baja_id` o referencia polimórfica).

**AUD-019 · Eje 8 — La reposición puede duplicarse si se refresca la página.** `Reposicion.jsx:220` ("completado hoy" solo en memoria de sesión) + `reposicionService.js` (sin guard de duplicado sector+día). *Impacto:* en un kiosko que se refresca, el operario puede generar una segunda distribución para un sector ya repuesto, duplicando la entrega. *Recomendación:* derivar "completado hoy" de las distribuciones del día en el server y/o validar duplicado por sector+día en backend.

**AUD-020 · Eje 8 — Crear remito (envío / distribución) sin confirmación ni resumen previo.** `RemitoNuevo.jsx:268-275`, `Reposicion.jsx:196-202` (POST directo). *Impacto:* en táctil un toque accidental genera un remito real y mueve stock. *Recomendación:* resumen + confirmación al menos en la distribución ("vas a entregar X a sector Y"). (El caso destructivo real —recibir más de lo enviado— SÍ está bien resuelto con doble confirmación, `RemitoDetalle.jsx:133-140`.)

**AUD-021 · Eje 8 — Doble paso "Registrar retorno" con el mismo rótulo.** `Retornos.jsx:92-100` (el botón solo navega) → `RemitoDetalle.jsx:228-234` (otro "Registrar retorno" para abrir el formulario). *Impacto:* dos clics con idéntico texto para lo que se percibe como una acción. *Recomendación:* renombrar el de la lista a "Abrir/Ver envío" o deep-link con el formulario ya expandido.

**AUD-022 · Eje 8 — Mensajes de error con jerga técnica visible al operario.** `remitosService.js:200-202` (`Reenviá con "confirmar": true...` llega al `window.confirm`), IDs crudos en `remitosService.js:46` y `reposicionService.js:59`. *Impacto:* personal de ropería lee instrucciones sobre un parámetro JSON y IDs numéricos. *Recomendación:* separar el mensaje de dominio del detalle técnico; usar nombres, no IDs.

**AUD-023 · Eje 4 — `RemitoDetalle.jsx` con responsabilidades múltiples (481 líneas, el archivo más grande del repo).** Mezcla fetch, estado del formulario de retorno, validación, cálculo de dominio y 4 bloques de render. *Recomendación:* extraer `FormularioRetorno` y `BloqueConciliacion`.

**AUD-024 · Eje 4 — Lógica de dominio replicada en el client (doble fuente de verdad).** "apta" (`RemitoDetalle.jsx:269` ≈ `remitosService.js:91`), validación de desglose (`RemitoDetalle.jsx:84-102` ≈ `remitosService.js:39-43`), peso estimado (`RemitoNuevo.jsx:52-60` ≈ `remitosService.js:53-59`), agregados en el cliente (`Dashboard.jsx:80-89`, `Reportes.jsx:106-135`). *Impacto:* si cambia una regla hay que sincronizar dos implementaciones. *Recomendación:* que el server exponga los agregados de Dashboard/Reportes; tratar el resto como espejo explícito, no como fuente.

**AUD-025 · Eje 4 — Componentes muertos que además duplican lógica.** `components/{TablaRemitos,FiltrosRemitos,SemaforoStock}.jsx` no se importan en ningún lado; las pantallas reimplementan lo mismo inline (`Remitos.jsx:12-19,70-113`, `Stock.jsx:10-21,29-61`). *Recomendación:* adoptarlos o borrarlos, y centralizar los estilos de nivel en `Badge.jsx`.

**AUD-026 · Eje 7 — Falta la categoría de retorno "rechazo en recepción" / apta-contaminada.** `schema.js:63-65` (solo relavado/costura/descarte). El estándar contempla además el rechazo al ingreso (prenda que vuelve sucia). *Recomendación:* evaluar sumar la categoría de rechazo para completar el ciclo rewash/reclaim/discard/reject.

### 🟡 BAJA

**AUD-027 · Eje 4 — Estilos del semáforo triplicados.** `Badge.jsx:20-26`, `Stock.jsx:10-15`, `SemaforoStock.jsx:3-13`. Cambiar un color exige tocar 3 archivos. *Recomendación:* única fuente en `Badge.jsx`.

**AUD-028 · Eje 4 — Tablas crudas `<table>` fuera del sistema de primitivas.** `Mermas.jsx:106-156,166-201` (y el muerto `TablaRemitos.jsx`). Queda desalineado con el resto. *Recomendación:* migrar a `Tabla/Th/Td/Fila`.

**AUD-029 · Eje 4 — Constantes/utilidades dispersas.** `claseInput` repetido (`RemitoNuevo/Mermas/Reposicion/RemitoDetalle/Ajustes/Remitos`), `MOTIVO_BAJA` duplicado (`Mermas.jsx:12-16` ≈ `Reportes.jsx:34-38`), SQL directo en `seed.js`/`migrations.js` fuera de `repositorios.js`. *Recomendación:* `<Input>` compartido + módulo de constantes de dominio.

**AUD-030 · Eje 4 — Doble fuente de verdad de mínimos de stock.** `stockService.js:36` cae al legado `stock_minimo_json` cuando falta la fila en `dotacion_par`. *Recomendación:* migrar todo a `dotacion_par` y deprecar el JSON.

**AUD-031 · Eje 5 — N+1 en `reporteMermas` (3 queries por envío CON_DIFERENCIA).** `mermasService.js:15-40` (`retornoDe` + `calcularFaltantes` que llama `itemsDe` 2×). Todas indexadas (sub-ms), pero lo ejecuta también el KPI del dashboard (`resumenMermasMes`) en cada carga. *Recomendación:* colapsar a un JOIN agregado envío↔retorno↔items; usar un `listar` liviano sin la subquery `total_prendas`.

**AUD-032 · Eje 2 — El correlativo `LT-AAAA-NNNN` no resetea por año.** `repositorios.js:103-114` (contador global monótono; `LT-2025-0099 → LT-2026-0100`). Cosmético (no genera duplicados; `numero` es UNIQUE). *Recomendación:* filtrar el máximo por año en curso si se quiere numeración anual, o documentar que es global.

**AUD-033 · Eje 3 — Body JSON malformado devuelve HTTP 500 en vez de 400.** `middleware/errorHandler.js:10-17` solo contempla `ErrorAPI` y cae al 500 genérico (no filtra stack, pero el código semántico es erróneo). *Recomendación:* respetar `err.status||err.statusCode` cuando `err.expose===true` → 400 "Cuerpo JSON inválido."

**AUD-034 · Eje 3 — DB corrupta al arranque: mensaje engañoso y sin fallback.** `connection.js:22-42` + `main.js:394-411` (el diálogo dice "Puede que el puerto esté ocupado", que no aplica a DB corrupta; no ofrece restaurar del último backup/`.pre-restore`). No crashea silenciosamente (bien). *Recomendación:* distinguir error de DB vs puerto y ofrecer restaurar desde el último backup.

**AUD-035 · Eje 1 — `express.json()` sin límite de tamaño.** `app.js:26`. Un body enorme desde la LAN consume memoria (DoS liviano). *Recomendación:* `express.json({ limit: '1mb' })`.

**AUD-036 · Eje 1 — SQL dinámico por interpolación en migrations (frágil, hoy no explotable).** `migrations.js:7,14` (`PRAGMA table_info(${tabla})`, `ALTER TABLE ${tabla}...`) con identificadores constantes hardcodeados. *Recomendación:* dejar el invariante comentado o usar whitelist.

**AUD-037 · Eje 7 — `movimientos_stock.fecha` es TEXT `YYYY-MM-DD` sin hora.** `schema.js:71`. Reconstruye saldo a una fecha pero no el orden intradiario ni auditoría con timestamp fino. *Recomendación:* considerar timestamp ISO completo si se necesita auditoría fina.

**AUD-038 · Eje 8 — Targets táctiles chicos.** Checkboxes `h-4 w-4` (16px, `Reposicion.jsx:145`, `Stock.jsx:99,102`), inputs `py-1`/`py-1.5` (~30-34px), botones `py-2/2.5` (~36-40px) — por debajo de los 44px recomendados. *Recomendación:* checkboxes ≥24px, inputs/botones ≥44px en la vista operativa.

**AUD-039 · Eje 8 — Falta feedback explícito tras crear (envío y retorno).** `RemitoNuevo.jsx:99` (solo navega), `RemitoDetalle.jsx:130-131` (cierra y recarga). Reposición SÍ muestra el número (`Reposicion.jsx:177-180`), patrón a replicar. *Recomendación:* toast de éxito con el número de remito.

**AUD-040 · Eje 8 — Sin `autoFocus` ni orden de foco pensado, y "Contaminadas" siempre visible.** Cero `autoFocus` en el client; la columna Contaminadas ocupa espacio aunque el caso normal es 0 (`RemitoNuevo.jsx:215-224`). *Recomendación:* `autoFocus` en el primer campo; colapsar Contaminadas tras un toggle.

---

## 3. Verificaciones que PASARON (para la propuesta comercial)

**Integridad de datos y dominio**
- **Kárdex = única fuente de verdad**: el stock siempre se deriva de `SUM(delta)` sobre `movimientos_stock`; NO existe columna de stock cacheada ni `UPDATE` de existencias. Los 5 caminos (envío, retorno, descarte, distribución, alta) pasan por movimiento. (Eje 7)
- **Atomicidad multi-tabla con rollback total**: verificado inyectando un fallo a mitad de `crearRetornoCore` → contadores exactos al baseline, sin estado parcial; la `conciliar()` anidada participa del mismo commit/rollback (reentrancia `tx.js`). (Ejes 2, 3)
- **Correlativo a prueba de concurrencia**: 2 procesos × 40 envíos simultáneos → 80 remitos, 0 duplicados, 0 `SQLITE_BUSY` (`BEGIN IMMEDIATE` + `busy_timeout=5000`). (Ejes 2, 3)
- **Conciliación correcta**: apta+relavado+costura+descarte = total retornado; merma = enviado − total_retornado; descarte no cuenta como faltante y genera su baja. (Eje 2)
- **Doble conciliación y estados inválidos bloqueados**: no se puede conciliar dos veces, ni 2º retorno, ni RETORNO sin ENVIO, ni conciliar un RETORNO. (Eje 2)
- **Marcha hacia adelante sólida**: sin borrado/edición de remitos; conciliación irreversible; sin des-conciliar; DELETE de catálogos bloqueado por FK RESTRICT (sin remitos huérfanos). (Eje 6)
- **Par vs mínimo bien diferenciados**: semáforo usa el mínimo, reposición usa el par; los 3 métodos (PAR/CARRO/PEDIDO) implementados coherentes. (Eje 7)
- **Peso no manipulable** por el usuario (siempre server-side, sin endpoint de edición). (Eje 6)
- **Pendientes normativos correctamente marcados** (transportista, rótulo, firma doble ausentes y no sobre-declarados como cumplidos). (Eje 6)

**Seguridad y errores**
- **SQL 100% parametrizado** en repositorios y services; las 3 interpolaciones (backup/migrations) usan valores server-controlled/constantes. (Ejes 1, 4)
- **Sin secretos** en el árbol trackeado; `.gitignore` protege `.env`/DB/claves; el bundle no incluye datos sensibles. (Eje 1)
- **Path traversal no explotable**: backups/exports por diálogos nativos y rutas fijas en `userData`. (Eje 1)
- **Electron endurecido**: `contextIsolation`+`sandbox` ON, `nodeIntegration` OFF, carga same-origin `http://localhost`, preload expone solo metadata. (Eje 1)
- **Errores JSON consistentes y en español** con HTTP correcto, sin filtrar stack/HTML (500 genérico, stack solo a consola). (Ejes 1, 3)
- **Frontend bloquea escrituras sin conexión** (los 4 forms con `disabled={pendiente||!online}`, polling `/api/health` cada 10s, `api.js` sin auto-reintento). (Eje 3)
- **Restore seguro en caso normal** (cierra conexión + checkpoint + borra sidecars WAL + `.pre-restore`) y ante gzip inválido (falla antes de tocar la DB). (Eje 3)
- **Updater y backups tolerantes a fallo** (offline-silence, try/catch); **instancia única** Electron. (Eje 3)

**Arquitectura y performance**
- **Separación de capas real**: NO hay una sola query SQL fuera de `server/src/db/`; controllers delgados; cadena `routes→controllers→services→repositorios` respetada; sin imports circulares. (Eje 4)
- **Nomenclatura de dominio consistente** server↔client (remito, sector, merma, baja, dotación par, relavado/costura/descarte, conciliación). (Eje 4)
- **Payloads del dashboard y stock son fijos** (1,3 KB y 4,7 KB, no crecen con la historia); queries frecuentes indexadas (prendas en lavandería con covering index, 0,11 ms); PRAGMAs de producción correctos (WAL+busy_timeout). (Eje 5)
- **Aciertos de UX**: retorno precarga las líneas del envío, reposición precarga sugeridos, fecha de hoy por defecto, "apta" en vivo, doble confirmación al recibir de más, estados vacíos con guía, badge de pendientes en sidebar. (Eje 8)

---

## 4. Plan de remediación sugerido

### Antes de la demo (rápido, alto impacto / evita papelones en vivo)
- **AUD-002** motivo de descarte en el kárdex (integridad de reportes; cambio chico en `schema.js`+`remitosService.js`+`seed.js`).
- **AUD-005 / AUD-006** recordar firmante + `inputMode="numeric"` (dos quick wins de UX operativa).
- **AUD-011** índice covering de `matriz()` (una línea, 4× en la query más caliente).
- **AUD-019 / AUD-020** guard de reposición duplicada + confirmación de distribución (evita duplicar entregas en una demo con escrituras).
- **AUD-022 / AUD-039** limpiar el mensaje técnico de retorno y agregar toast con número de remito.

### Fase 1 (antes de producción real en clínica)
- **AUD-001 / AUD-016 / AUD-035** endurecer red: CORS restringido + anti-rebinding + límite de body + handlers de navegación Electron (complementa la auth ya planificada).
- **AUD-015** firmante obligatorio server-side (trazabilidad del operario).
- **AUD-007 / AUD-008** validación de fechas + acotar el reingreso con `confirmar:true`.
- **AUD-009 / AUD-010 / AUD-034** restore con `integrity_check` + swap atómico, idempotencia de remitos, y fallback de arranque ante DB corrupta.
- **AUD-003 / AUD-004** reingreso del reproceso y endpoint de bajas manuales (cierran el ciclo del kárdex).
- **AUD-012 / AUD-018 / AUD-033** paginar `/api/remitos`, referenciar el documento en cada movimiento, y 400 (no 500) ante JSON malformado.
- **AUD-013 / AUD-014** decidir el rol de `cantidad_contaminada` (control real o informativo declarado) y del peso (medido vs derivado) + corregir el doc.

### Backlog (evolución de producto / deuda técnica)
- **AUD-017 / AUD-026 / AUD-037** obsolescencia por ciclos (requiere trazabilidad por lote/prenda), categoría de rechazo en recepción, timestamp fino — e **inventario cíclico con conteo ciego** (gap nuevo vs la referencia, no en el roadmap).
- **AUD-023 / AUD-024 / AUD-025 / AUD-027 / AUD-028 / AUD-029 / AUD-030 / AUD-031** refactors de client (descomponer `RemitoDetalle`, borrar/centralizar componentes muertos y estilos, migrar Mermas a primitivas, consolidar constantes, N+1 de mermas) — no bloqueantes, mejoran mantenibilidad.
- **AUD-032 / AUD-040** numeración anual del correlativo, `autoFocus` y colapsar "Contaminadas".

---

*Auditoría read-only. No se modificó código, configuración, la DB demo ni docs existentes. Las DBs de stress/temporales de los ejes 2, 3 y 5 fueron generadas en directorios temporales y borradas al finalizar.*
