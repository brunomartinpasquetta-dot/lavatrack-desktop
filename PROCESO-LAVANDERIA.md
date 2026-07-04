# Proceso normado de gestión de ropa hospitalaria — LavaTrack

> Documento de referencia funcional. Ubicación sugerida: `docs/PROCESO-LAVANDERIA.md`
> Última revisión: julio 2026 · BPSG Sistemas

---

## A. Marco normativo

| Norma / Fuente | Jurisdicción | Aporte al proceso |
|---|---|---|
| Manual de Procesos de Lavandería y Manejo de Ropa Hospitalaria — Ministerio de Salud de Neuquén (2024) | Provincial (referencia técnica más completa) | Define el circuito completo, exige sector sucio y sector limpio delimitados con accesos independientes, formaliza reparación de ropa y bajas |
| Ley 2.203 (CABA) + Decreto reglamentario 262/012 | CABA (referencia de mejores prácticas sector privado) | Bolsas diferenciadas por color con rótulo de área asistencial y establecimiento; carros lavables de cierre hermético y uso exclusivo; vehículo de transporte con división transversal limpio/sucio; obleas habilitantes para lavanderías y transportistas |
| Manual del Personal de Salud del Área de Lavandería — Decreto 522/13 | Provincia de Santa Fe (**marco aplicable al cliente**) | Roles y responsabilidades del personal de lavandería |
| Recomendaciones SADI — Comisión IACS y Seguridad del Paciente | Nacional (sociedad científica) | Manejo de ropa blanca, uniformes y telas en servicios de salud |
| Norma 28 — Hospital Italiano de Buenos Aires | Estándar de facto sector privado | Administración de ropa limpia y sucia, manejo de carros y bolsas |

### Principios rectores

1. **Marcha hacia adelante**: la ropa avanza siempre de zonas más sucias a zonas más limpias, nunca retrocede. Una prenda terminada no puede volver a una zona sucia.
2. **Barrera sanitaria**: separación física entre zona sucia y zona limpia. Lavadoras de doble boca: carga de ropa sucia por un lado, descarga de ropa limpia por el otro, sin contacto entre zonas.
3. **Toda ropa en contacto con pacientes se considera contaminada**: el embolsado en origen diferencia la ropa común de la de alto riesgo (infectocontagioso / quirúrgico → bolsa roja).
4. **Doble punto de control documental**: remito de envío (clínica → lavandería) y remito de retorno (lavandería → clínica), ambos firmados. La conciliación entre ambos es la fuente de detección de mermas.

---

## B. Diagrama de flujo completo del circuito

```mermaid
flowchart TD

subgraph CLINICA_SUCIO["Clínica — circuito de ropa sucia"]
    A1["Retiro en sector asistencial<br/>Embolsado diferenciado por riesgo<br/>Bolsa roja: infectocontagioso / quirúrgico"]
    A2["Depósito transitorio<br/>Carro cerrado de uso exclusivo"]
    A3["Pesaje y conteo por tipo de prenda"]
    A4["Remito de ENVIO firmado<br/>Rótulo: área asistencial + establecimiento"]
    A5["Transporte<br/>Compartimento sucio aislado"]
    A1 --> A2 --> A3 --> A4 --> A5
end

subgraph LAVANDERIA["Lavandería — propia o tercerizada"]
    B1["Recepción y pesaje<br/>Zona sucia"]
    B2["Clasificación<br/>por tipo, suciedad y color"]
    B3["Prelavado<br/>remoción de materia orgánica"]
    B4["Lavado y desinfección<br/>BARRERA SANITARIA<br/>lavadora de doble boca"]
    B5["Secado y centrifugado"]
    B6["Planchado<br/>desinfección final mayor a 140 C"]
    B7{"Repaso<br/>control de calidad"}
    B8["Costura y reparación"]
    B9["BAJA por fin de vida útil"]
    B10["Empaque y rotulado<br/>Zona limpia"]
    B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> B7
    B7 -- "manchada" --> B4
    B7 -- "rota recuperable" --> B8 --> B10
    B7 -- "irrecuperable" --> B9
    B7 -- "apta" --> B10
end

subgraph CLINICA_LIMPIO["Clínica — retorno y conciliación"]
    C1["Transporte<br/>Compartimento limpio aislado"]
    C2["Recepción en ropería central<br/>Conteo físico"]
    C3["Remito de RETORNO firmado"]
    C4{"Conciliación<br/>envío vs retorno<br/>por tipo de prenda"}
    C5["CONCILIADO<br/>Distribución a sectores<br/>Reposición de stock"]
    C6["CON_DIFERENCIA<br/>Merma valorizada en ARS<br/>Reclamo a lavandería"]
    C1 --> C2 --> C3 --> C4
    C4 -- "coincide" --> C5
    C4 -- "faltantes" --> C6
end

A5 -->|"PUNTO DE CONTROL 1<br/>remito de envío"| B1
B10 -->|"PUNTO DE CONTROL 2<br/>remito de retorno"| C1
C5 -.->|"el ciclo reinicia"| A1
```

---

## C. Diagrama de estados del remito

Estados idénticos a los implementados en el sistema (`remitos.estado`).

```mermaid
stateDiagram-v2
    [*] --> BORRADOR: operador clínica crea remito
    BORRADOR --> ENVIADO: operador clínica confirma<br/>pesaje + firma de entrega
    ENVIADO --> RECIBIDO: operador ropería registra<br/>retorno con conteo físico
    RECIBIDO --> CONCILIADO: conciliación automática<br/>cantidades coinciden
    RECIBIDO --> CON_DIFERENCIA: conciliación automática<br/>faltantes detectados
    CON_DIFERENCIA --> CONCILIADO: resolución manual<br/>reclamo cerrado / merma asumida
    CONCILIADO --> [*]
```

Reglas asociadas:

- Un `ENVIO` solo puede vincularse a un único `RETORNO` (campo `remito_envio_id`).
- No se permite conciliar dos veces el mismo envío.
- Un `RETORNO` con cantidades mayores a las enviadas requiere flag de confirmación explícita.
- Toda transición genera movimientos en `movimientos_stock` (motivo `ENVIO` / `RETORNO`).
- Los faltantes de una conciliación `CON_DIFERENCIA` se valorizan con `tipos_prenda.costo_reposicion_ars`.

---

## D. Trazabilidad normativa → sistema

| Exigencia normativa | Fuente | Cobertura en LavaTrack | Estado |
|---|---|---|---|
| Embolsado diferenciado por riesgo (bolsa roja) | Ley 2.203 art. 4 / Manual Neuquén | `remito_items.cantidad_contaminada` | ✅ Implementado |
| Registro de peso por envío | Práctica estándar / facturación por kg | `remitos.peso_total_kg` | ✅ Implementado |
| Firma de recepción en cada entrega | Manual Neuquén / Norma 28 HIBA | `remitos.firmante` | ✅ Implementado (firma simple) |
| Conteo y conciliación envío vs retorno | Práctica estándar de control | `POST /api/remitos/:id/conciliar` + estados | ✅ Implementado |
| Registro de bajas por rotura / fin de vida útil | Manual Neuquén (reparación y baja) | Tabla `bajas` + `movimientos_stock` | ✅ Implementado |
| Rótulo normativo en remito impreso (área asistencial + establecimiento) | Ley 2.203 art. 4 inc. b | Impresión de remito | ⏳ PENDIENTE |
| Firma doble (quien entrega y quien recibe) | Ley 2.203 / Manual Neuquén | Requiere campo adicional `firmante_recepcion` | ⏳ PENDIENTE |
| Identificación del transportista con habilitación (oblea) | Ley 2.203 / Decreto 262/012 | Requiere entidad `transportistas` con nro. de habilitación | ⏳ PENDIENTE |
| Vida útil en ciclos de lavado por prenda | Práctica estándar (reposición programada) | `tipos_prenda.vida_util_ciclos` (dato cargado, sin contador de ciclos por lote) | 🔶 PARCIAL |

---

## E. Glosario operativo

| Término | Definición |
|---|---|
| Ropa contaminada | Toda ropa en contacto con pacientes; la de riesgo infectocontagioso o quirúrgico va en bolsa roja |
| Remito de envío | Documento firmado que acompaña la ropa sucia de la clínica a la lavandería, con detalle por tipo de prenda, cantidad y peso |
| Remito de retorno | Documento firmado que acompaña la ropa limpia de la lavandería a la ropería, base de la conciliación |
| Ropería central | Depósito de ropa limpia de la clínica desde donde se distribuye a los sectores según dotación |
| Dotación | Stock mínimo/máximo de cada tipo de prenda asignado a cada sector |
| Merma | Diferencia entre lo enviado y lo retornado, valorizada al costo de reposición |
| Baja | Salida definitiva de una prenda del circuito (rotura irrecuperable, fin de vida útil, pérdida) |
| Marcha hacia adelante | Principio por el cual la ropa avanza de zona sucia a limpia sin retroceder |
| Barrera sanitaria | Separación física entre zona sucia y limpia; lavadoras de doble boca |
