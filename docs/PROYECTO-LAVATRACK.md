# LavaTrack — Alcance del Proyecto (Demo comercial)

**Producto:** LavaTrack — Gestión de Ropa Hospitalaria
**Cliente objetivo:** clínica privada argentina (40–60 camas) con lavandería tercerizada.
**Autor:** BPSG Sistemas. **Estado:** demo de presentación (datos ficticios).

## 1. Problema que resuelve
Las clínicas pierden trazabilidad y dinero en el circuito de ropa: no saben cuánto textil está en la lavandería, cuánto vuelve, qué se pierde y cuánto cuesta esa merma. LavaTrack digitaliza el circuito **clínica ↔ lavandería** con remitos, conciliación automática y control de stock por sector.

## 2. Alcance de la demo
- **Dashboard** con KPIs: prendas en lavandería, kg despachados del mes, mermas del mes (unidades y ARS), alertas de stock bajo y últimos remitos.
- **Remitos** de envío y retorno, con filtros por estado/tipo/sector/fecha y estados de color.
- **Nuevo envío** con peso estimado calculado en vivo desde el peso promedio de cada prenda.
- **Conciliación automática**: al registrar el retorno, cruza cantidades por tipo y detecta faltantes valorizados en ARS (costo de reposición).
- **Stock** en matriz sector × tipo de prenda con semáforo (ok / bajo / crítico).
- **Mermas** por período: faltantes de conciliación + bajas (rotura / fin de vida útil), en unidades y pesos.

**Funcionalidades ya implementadas en el refactor Desktop** (más allá de la demo original):
- **Método de reposición por sector** (`PAR` / `CARRO_INTERCAMBIO` / `PEDIDO`).
- **Dotación par** por sector × tipo de prenda (cantidad par + cantidad mínima).
- **Reposición del día**: sugerencia de entrega por sector según el método, y remito de distribución interna desde Ropería Central.
- **Retorno categorizado por calidad**: cada línea del retorno discrimina apta / relavado / costura / descarte; el descarte da baja automática `FIN_VIDA_UTIL`.
- **Concurrencia multi-terminal** con SQLite en modo WAL + `busy_timeout` + transacciones `BEGIN IMMEDIATE` (correlativo de remito único garantizado).

## 3. Terminología (glosario)
- **Sector**: área de la clínica que consume ropa (Internación A/B, Quirófano, Guardia, Consultorios, Ropería Central).
- **Tipo de prenda**: Sábana, Funda de almohada, Frazada, Toalla, Ambo, Camisolín, Campo quirúrgico. Cada uno con peso promedio, vida útil (ciclos) y costo de reposición.
- **Remito**: comprobante de un lote. `ENVÍO` (clínica→lavandería) o `RETORNO` (lavandería→clínica).
- **Estados**: BORRADOR, ENVIADO, RECIBIDO, CONCILIADO, CON_DIFERENCIA.
- **Cantidad contaminada**: piezas en bolsa roja (biopeligrosas) dentro de una línea.
- **Conciliación**: comparación envío vs retorno por tipo de prenda.
- **Merma**: pérdida de textil, ya sea por faltante en conciliación o por baja.
- **Baja**: retiro definitivo de una prenda (ROTURA, PERDIDA, FIN_VIDA_UTIL).
- **Stock mínimo / de seguridad**: umbral por sector y tipo que dispara alertas.
- **Dotación par**: parametrización por sector × tipo de prenda que define cuánto textil debería tener ese sector. Guarda `cantidad_par` (dotación completa deseada) y `cantidad_minima` (umbral de alerta). Reemplaza al `stock_minimo_json` suelto de la demo original.
- **Cantidad par**: la dotación completa deseada de un tipo de prenda en un sector (el objetivo a reponer). Ej.: par = 160 sábanas en Internación A.
- **Método de reposición**: cómo se abastece un sector. `PAR` (se repone hasta completar la cantidad par: `a_entregar = par − stock_actual`), `CARRO_INTERCAMBIO` (se entrega un carro completo cargado al par, sin descontar el stock actual), `PEDIDO` (carga manual, el sistema no sugiere cantidad).
- **Relavado**: prenda retornada manchada que se vuelve a lavar; sigue en circuito, **no es merma ni baja**.
- **Costura**: prenda retornada con rotura reparable que va a arreglo; sigue en circuito, **no es merma ni baja**.
- **Descarte**: prenda retornada irrecuperable; genera baja automática `FIN_VIDA_UTIL` y sale del inventario.
- **Servidor**: la PC de la clínica donde corre la aplicación de escritorio (Electron + Express + base SQLite). Es la única instalación real.
- **Terminal**: cualquier PC/tablet de la LAN que accede al sistema **desde el navegador** (`http://IP-del-servidor:puerto`), sin instalar nada.

## 4. Arquitectura (definitiva — LavaTrack Desktop)

LavaTrack dejó de ser una "web en `localhost:3051`" y pasó a ser una **aplicación de escritorio (Electron)** con topología **1 PC servidor + N terminales por navegador en la LAN**. Detalle técnico completo con diagramas en [`ARQUITECTURA-DESKTOP.md`](./ARQUITECTURA-DESKTOP.md); guía de instalación en [`DEPLOY.md`](./DEPLOY.md).

- **Shell Electron**: el proceso *main* levanta el servidor Express existente (`iniciarServidor()` de `server/src/index.js`) y abre un `BrowserWindow` apuntando a `http://localhost:<puerto>`. Se **envuelve** el backend, no se reescribe. Seguridad del renderer: `contextIsolation: true`, `nodeIntegration: false`, `preload` acotado.
- **Backend**: Node + Express, arquitectura por capas `schema → repositorios → servicios → controladores → rutas`, errores centralizados (`{ error }` + HTTP correcto). API bajo `/api`. Express hace *bind* a `0.0.0.0` para ser accesible desde las terminales de la LAN.
- **Base de datos — SQLite local (definitivo)**: `node:sqlite` (módulo nativo de Node ≥ 22.5, **sin drivers que compilar**). El archivo vive en `app.getPath('userData')/lavatrack.db`. **PostgreSQL quedó eliminado del roadmap**: para el tamaño de una clínica, SQLite embebido con WAL cubre la concurrencia multi-terminal y simplifica el despliegue a "instalar y abrir".
- **Concurrencia multi-terminal**: `PRAGMA journal_mode = WAL` + `busy_timeout = 5000`; toda escritura multi-tabla corre en transacción `BEGIN IMMEDIATE`; el correlativo `LT-AAAA-NNNN` se genera **dentro** de la transacción (probado con 2 procesos concurrentes: 0 números duplicados).
- **Frontend**: React + Vite + Tailwind, servido por el mismo Express. Tema claro sanitario (slate + teal-600, acentos amber/rose). Las terminales lo abren en un navegador puro (Chrome/Edge), **cero instalación**.
- **Red y terminales**: puerto configurable (default **3051**) en `userData/config.json`, editable desde la pantalla de Ajustes. Detección de IPs de la LAN (`server/src/net.js`), página `/terminal-info` con las URLs de acceso y el comando `chrome --app=...`, y health-check `/api/health` (las terminales muestran un banner "Sin conexión" que bloquea escrituras si el servidor no responde).
- **Backups**: diarios con `VACUUM INTO` (copia consistente aun con WAL activo) + gzip en `userData/backups`, retención 30, con export/restore desde el menú (la restauración reinicia la app).
- **Empaquetado y updates**: electron-builder (prioridad **Windows NSIS `.exe`**, además `.dmg` macOS y `AppImage` Linux; publisher **BPSG Sistemas**). Auto-actualización con electron-updater sobre feed HTTP genérico: descarga en segundo plano y aplica al reiniciar; **sin internet no pasa nada** (offline-first).
- **Sin autenticación** en esta etapa (aclarado en el código). En producción: login, roles (operario/supervisor) y auditoría por usuario.

## 5. Licenciamiento

- **Licencia por instalación de servidor**: se licencia **la PC servidor** de la clínica (una instalación de la app de escritorio).
- **Terminales LAN ilimitadas**: como las terminales son solo un navegador contra el servidor, no se cobran ni se limitan por puesto.

## 6. Roadmap / fuera de alcance (extensiones futuras)

**Cerrado / decidido:**
- Base de datos **SQLite local es definitiva**; PostgreSQL **descartado**.
- Distribución como app de escritorio con updates automáticos (electron-updater).

**Ya implementado en el refactor Desktop:** método de reposición por sector, dotación par, reposición del día, retorno categorizado (relavado/costura/descarte), concurrencia WAL multi-terminal.

**Extensiones futuras posibles:** facturación del lavadero por kg, RFID por prenda, firma digital de remitos, app móvil para enfermería, integración con el ERP de la clínica, y firma de código en macOS (Apple Developer) para habilitar el auto-update del `.dmg` — hoy, sin firma, la actualización en macOS se hace instalando el `.dmg` a mano (patrón heredado de StockFlow de BPSG).
