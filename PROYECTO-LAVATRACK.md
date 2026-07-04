# LavaTrack — Definición de proyecto y roadmap

> Ubicación sugerida: `docs/PROYECTO-LAVATRACK.md`
> Estado: demo funcional en localhost:3051 · julio 2026 · BPSG Sistemas

---

## 1. Qué estamos construyendo

**LavaTrack** es un sistema de gestión y trazabilidad de ropa hospitalaria para clínicas privadas argentinas. Controla el circuito completo clínica ↔ lavandería (propia o tercerizada): envíos, retornos, conciliación, stock por sector, mermas valorizadas y bajas.

**Problema que resuelve**: las clínicas pierden entre 15% y 25% del inventario textil por falta de control documental. Hoy lo llevan en papel o Excel, sin conciliación sistemática ni valorización de faltantes.

**Propuesta de valor**: cada prenda que sale tiene que volver. El sistema detecta automáticamente qué falta, cuánto cuesta y quién firmó.

**Qué NO es (fuera de alcance)**: no gestiona el proceso interno de lavado (máquinas, químicos, programas), no es RFID (fase futura opcional), no factura a pacientes, no gestiona uniformes del personal en esta etapa.

---

## 2. Estado actual (lo que ya existe)

| Componente | Estado |
|---|---|
| Backend Node + Express + SQLite (remitos, conciliación, stock, mermas, bajas) | ✅ Demo funcional |
| Frontend React + Vite + Tailwind (dashboard, remitos, stock, mermas) | ✅ Demo funcional |
| Seed con 60 días de historia realista | ✅ |
| Documentación de proceso normado (`docs/PROCESO-LAVANDERIA.md`) | ✅ |
| Deploy demo en localhost:3051 | ✅ |
| Autenticación y roles | ❌ No existe |
| Remito imprimible con rótulo normativo | ❌ Pendiente |
| Multi-establecimiento / deploy productivo | ❌ Pendiente |

---

## 3. Hito inmediato: reunión de relevamiento con la clínica

**La demo actual es la herramienta de venta.** Antes de escribir una línea más de código, la reunión define el alcance real. Checklist de relevamiento:

1. ¿Lavandería propia o tercerizada? → define si se modela la fase interna de lavado o solo el circuito documental.
2. ¿Facturan por kg o por prenda? → define el dato duro del remito.
3. ¿Cuántos sectores retiran ropa y quién firma en cada punto?
4. ¿Qué planilla/Excel usan hoy? → pedir copia: es la especificación funcional gratis.
5. ¿Necesitan trazar prenda individual o alcanza por lote? → define si entra código de barras.
6. ¿Quién autoriza bajas por rotura/pérdida?
7. ¿Cantidad de usuarios y perfiles? (ropería, enfermería por sector, administración, dirección)
8. ¿Dónde lo quieren corrido: servidor local de la clínica o cloud (VPS BPSG)?
9. Volumen: camas, kg/semana estimados, cantidad de tipos de prenda reales.
10. ¿Auditorías de obra social / acreditación (ITAES, CENAS) que exijan registro documental?

**Salida de la reunión**: acta de alcance firmada que congela el MVP de Fase 1.

---

## 4. Roadmap por fases

### Fase 0 — Preventa (ahora)
- Demo localhost:3051 pulida para presentar.
- Presupuesto dos niveles registrado en Mem (`BPSG — Presupuestos`, correlativo BPSG-2026-004):
  - **Plan Control**: circuito de remitos + conciliación + mermas + stock. Monousuario/pocos usuarios, deploy simple.
  - **Plan Trazabilidad**: lo anterior + roles y auditoría + remito normativo imprimible + reportes gerenciales + soporte.
- Cierre: acta de alcance + seña.

### Fase 1 — MVP productivo (post-firma, ~3-4 semanas de desarrollo)
1. **Autenticación y roles**: admin, ropería, sector (consulta y firma), dirección (solo reportes). JWT simple, tabla `usuarios`.
2. **Firma doble en remitos**: `firmante_entrega` + `firmante_recepcion` (cierre del pendiente normativo).
3. **Remito imprimible**: formato A4 y ticket, con rótulo normativo (área asistencial + establecimiento + nro. correlativo), vía `window.print()` como en Drip Burger.
4. **Entidad transportista/lavandería**: razón social, nro. de habilitación, contacto.
5. **Carga de datos reales**: tipos de prenda, sectores, dotaciones y costos de reposición de la clínica.
6. **Migración SQLite → PostgreSQL** si el volumen o la concurrencia lo justifican (decisión post-relevamiento; SQLite aguanta una clínica chica sin problema).
7. **Deploy productivo**: VPS BPSG con Docker (mismo patrón que Fragaria/SeguroApp) o servidor local de la clínica según relevamiento. Backup diario automatizado de la DB.
8. **Capacitación**: 1 sesión con ropería + material de uso en `docs/MANUAL-USO.md`.

### Fase 2 — Control operativo (mes 2-3, según adopción)
1. Export Excel de mermas y stock (openpyxl-style, patrón B'YAKKO) para administración.
2. Alertas: stock bajo por sector, envíos sin retorno a más de X días, merma mensual sobre umbral (email vía Resend, patrón SeguroApp).
3. Contador de ciclos de lavado por lote → reposición programada por vida útil.
4. Reporte gerencial mensual PDF: kg procesados, merma valorizada, costo textil por cama.
5. Integración al Command Center BPSG (adapter de monitoreo + endpoint /health).

### Fase 3 — Escalado (solo si hay tracción)
1. Multi-tenant (schema por clínica, patrón SeguroApp) → producto vendible a otras clínicas y a lavanderías industriales de la zona.
2. Código de barras por prenda de alto valor (campos quirúrgicos, frazadas) con lectores USB.
3. Portal para la lavandería tercerizada: confirma recepción y carga retorno desde su lado, doble validación real.
4. RFID: solo si un cliente grande lo paga; no es inversión propia.

---

## 5. Decisiones técnicas tomadas (no reabrir sin motivo)

| Decisión | Justificación |
|---|---|
| Trazabilidad por lote, no por prenda | El 100% del valor de control con el 20% del costo; barcode/RFID son fases posteriores pagas |
| Node + Express + React + Vite + Tailwind | Stack estándar BPSG, reuso de patrones de SeguroApp/BLACKMAN |
| SQLite en demo, PostgreSQL si hay concurrencia real | Evitar sobre-ingeniería antes del relevamiento |
| Conciliación automática con estados CONCILIADO / CON_DIFERENCIA | Núcleo del producto, ya implementado y probado en demo |
| Español rioplatense en toda UI, código y docs | Estándar BPSG |

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| La clínica quiere que la lavandería tercerizada "cargue su parte" desde el día 1 | Fase 1 registra todo del lado clínica; portal lavandería es Fase 3 y se cotiza aparte |
| Resistencia del personal de ropería al doble conteo | El sistema reduce trabajo (remito precargado desde el envío); mostrarlo en la capacitación |
| Alcance difuso ("ya que estamos, agregale uniformes/esterilización") | Acta de alcance firmada en Fase 0; todo agregado se cotiza como adicional |
| Volumen de datos subestimado | Pregunta 9 del relevamiento define SQLite vs PostgreSQL antes de firmar |

---

## 7. Próximos 5 pasos concretos

1. Pulir demo: revisar seed y UI en localhost:3051, dejar dataset presentable.
2. Agendar reunión de relevamiento con la clínica (llevar checklist de la sección 3).
3. Armar presupuesto dos niveles BPSG-2026-004 y registrarlo en Mem.
4. Presentar demo + propuesta.
5. Con acta firmada → Prompt de Acción Fase 1 para Claude Code (auth + firma doble + remito imprimible + deploy).
