# Proceso de Lavandería Hospitalaria — Terminología y Circuito

> Referencia operativa del circuito clínica ↔ lavandería tercerizada, base conceptual de LavaTrack.
> Derivado de la especificación *"Circuito Operativo: Lavandería Hospitalaria"* (clínicas privadas, Argentina).

## Circuito en dos etapas

### Etapa 1 — Área Sucia (origen y despacho)
1. **Clasificación en origen**: la ropa sucia se embolsa en la habitación/quirófano según riesgo.
   - **Bolsa blanca/verde**: ropa sucia común (sin fluidos masivos).
   - **Bolsa roja**: ropa altamente contaminada o biopeligrosa (doble embolsado). En LavaTrack se registra como **cantidad contaminada** en cada línea del remito.
2. **Recolección e hidro-transporte**: carros estancos exclusivos para material sucio.
3. **Pesaje y auditoría de salida**: control crítico en el depósito de sucio. El **peso total en kg** es la métrica base para la facturación del lavadero. Campos: sector de origen, tipo, peso, operario (**firmante** en LavaTrack).
4. **Emisión de remito**: cierre del lote de salida. El estado pasa a *"En tránsito / En lavado"* → en LavaTrack es el **remito de ENVÍO** en estado **ENVIADO**.

### Etapa 2 — Área Limpia (procesamiento, recepción y distribución)
5. **Lavado e higienización**: lavadoras de barrera, ciclos térmicos >70 °C.
6. **Secado y planchado**: calandras industriales.
7. **Control de calidad y descartes**: inspección unitaria durante el doblado.
   - Prendas manchadas → relavado.
   - Prendas rotas/desgastadas → costura o **baja de inventario** definitiva (en LavaTrack: **baja** por ROTURA / FIN_VIDA_UTIL).
8. **Recepción y cuadre de mermas**: ingreso de ropa limpia. El sistema **cruza unidades y kg devueltos vs. enviados** para detectar desvíos, pérdidas o robos → en LavaTrack es el **remito de RETORNO** y la **conciliación** automática (estado CONCILIADO o CON_DIFERENCIA).
9. **Distribución interna**: depósito central climatizado (**Ropería Central**) y reparto diario a los *offices* de enfermería de cada sector según **stock de seguridad** (stock mínimo por sector).

## Cómo se mapea al modelo de datos de LavaTrack

| Concepto del proceso | Entidad / campo en LavaTrack |
|---|---|
| Bolsa roja / biopeligroso | `remito_items.cantidad_contaminada` |
| Pesaje de salida (kg) | `remitos.peso_total_kg` (calculado con peso promedio por prenda) |
| Operario de carga | `remitos.firmante` |
| Estado "en lavado" | `remito` ENVÍO en estado `ENVIADO` |
| Cuadre de mermas (kg devueltos vs enviados) | Conciliación ENVÍO↔RETORNO → `CONCILIADO` / `CON_DIFERENCIA` |
| Baja de inventario | tabla `bajas` (ROTURA / PERDIDA / FIN_VIDA_UTIL) |
| Stock de seguridad por sector | `sectores.stock_minimo_json` + semáforo (ok/bajo/crítico) |
| Ciclo de vida textil (obsolescencia) | `tipos_prenda.vida_util_ciclos` |
| Equivalencia peso (1 sábana ≈ 600 g) | `tipos_prenda.peso_promedio_gr` |

## Nota de alcance de la demo
Esta demo cubre el **tracking de stock y trazabilidad de remitos** (envío, retorno, conciliación, mermas y stock por sector). No incluye el detalle físico del lavado (temperaturas, químicos), la facturación del lavadero ni RFID; quedan como extensiones posibles.
