# Fase 1 — Plan de implementación

> **Estado: COMPLETADA (v1.1.0).** Las 5 olas implementadas, verificadas y en `main`.
> Ola 1 auth+hardening · Ola 2 firma doble+bajas+reproceso · Ola 3 integridad
> (AUD-007/008/009/010/012/015) · Ola 4 transportistas + remito imprimible ·
> Ola 5 QA integral (kárdex 0, las 4 olas conviven). Usuarios demo:
> admin/admin1234 · super/super1234 · oper/oper1234.


Objetivo: llevar LavaTrack de demo a apto-producción para la clínica. Auth + roles + firma doble + remito imprimible con rótulo + transportistas + el lote Fase 1 de la auditoría (AUD-001/003/004/007-010/012/015/016/035).

## Decisiones de arquitectura (pinneadas)

1. **Auth sin librerías nuevas** — implementado con `node:crypto`:
   - Passwords: `scrypt` (hash + salt por usuario). Sin bcrypt (evita módulo nativo que complica el empaquetado Electron).
   - Token: JWT propio HMAC-SHA256 (`header.payload.signature` base64url), ~30 líneas. Secreto random generado en el primer arranque y persistido en `config.json` (userData en Electron, `LAVATRACK_CONFIG_PATH`), NUNCA en el repo.
2. **Modelo de acceso de terminales**: login por usuario (JWT en localStorage de cada terminal, header `Authorization: Bearer`). El operario loguea al inicio del turno; las operaciones críticas exigen **firma doble** (co-firma de un SUPERVISOR/ADMIN presente que se autentica en el momento).
3. **Roles**: `OPERARIO` (envío, retorno, reposición/distribución, conteo de inventario, ver) · `SUPERVISOR` (+ conciliación con diferencia, bajas manuales, ajustes, cerrar inventario, co-firma, CRUD catálogos) · `ADMIN` (+ gestión de usuarios, config/puerto, backup/restore).
4. **Firma doble**: operaciones críticas (baja manual, ajuste ROBO_PERDIDA, conciliación CON_DIFERENCIA, descarte sobre umbral) aceptan `cofirma:{usuario,password}`; el server valida credencial de un 2º usuario DISTINTO con rol SUPERVISOR+ y registra ambos firmantes.
5. **Sin romper el modelo LAN**: Express sigue sirviendo el SPA; se agrega login + guard de rutas. `/api/health` y `/api/auth/login` quedan públicos; el resto exige token.

## Olas de ejecución

### Ola 1 — Fundación auth + hardening de seguridad  ← EN CURSO
- **Datos**: tabla `usuarios` (usuario UNIQUE, nombre, rol, password_hash, password_salt, activo, fecha_alta) + `usuariosRepo` + seed de 3 usuarios demo.
- **Endpoints**: util cripto (scrypt + token HMAC, secreto en config); `POST /api/auth/login`, `GET /api/auth/me`; middleware `autenticar` (Bearer) en todo `/api` salvo health/login; `requireRol(...)`; CRUD `/api/usuarios` (ADMIN). **AUD-001** (CORS restringido + chequeo Host/Origin anti-rebinding + DELETE catálogos → SUPERVISOR+), **AUD-035** (`express.json({limit:'1mb'})`), **AUD-016** (Electron `setWindowOpenHandler` deny + `will-navigate` guard).
- **Cliente**: `AuthContext` + pantalla de Login; `api.js` agrega el header y ante 401 desloguea; guard de rutas (sin token → /login); gating por rol en nav/acciones; usuario actual + logout en el layout; pantalla de Usuarios (ADMIN).
- **QA**: 401 sin token; login ok; guards por rol; anti-rebinding; el E2E existente sigue andando con auth; verificar-kardex 0.

### Ola 2 — Firma doble + bajas manuales + reingreso de reproceso
- Flujo de co-firma (depende de roles). **AUD-004** endpoint de bajas manuales (ROTURA/PÉRDIDA) con firma doble. **AUD-003** reingreso del reproceso (relavado/costura vuelven a stock).

### Ola 3 — Lote de integridad de la auditoría
- **AUD-007** validación de fechas · **AUD-008** acotar reingreso con confirmar · **AUD-009** restore con integrity_check + swap atómico · **AUD-010** idempotencia de remitos (Idempotency-Key) · **AUD-012** paginación `/api/remitos` · **AUD-015** firmante obligatorio server-side.

### Ola 4 — Remito imprimible con rótulo normativo + transportistas
- Entidad `transportistas` (CRUD) + `remitos.transportista_id`. Vista de impresión (print CSS, `window.print`, sin libs) con rótulo: origen/destino, transportista, cantidades, contaminadas/bolsa roja, firmas, fecha, número.

### Ola 5 — QA integral + re-verificar-kardex + cierre
- Regresión completa del circuito + los nuevos flujos; luego habilita la re-auditoría (item 5 del roadmap).

## Restricciones
Sin librerías nuevas (auth con node:crypto). Migraciones in-place idempotentes. Escrituras multi-tabla en transacción. Estética slate/teal. Español rioplatense. Secretos fuera del repo.
