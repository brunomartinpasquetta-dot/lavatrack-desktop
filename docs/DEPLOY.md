# LavaTrack — Guía de instalación en la clínica

> Cómo dejar funcionando LavaTrack en una clínica: **1 PC servidor + N terminales** por la red local (LAN).
> Arquitectura técnica en [`ARQUITECTURA-DESKTOP.md`](./ARQUITECTURA-DESKTOP.md). Alcance del producto en [`PROYECTO-LAVATRACK.md`](./PROYECTO-LAVATRACK.md).

LavaTrack se instala **una sola vez**, en la PC que hace de **servidor**. Las demás PCs (las **terminales**) no instalan nada: solo abren el navegador contra el servidor.

---

## 1. Requisitos de la PC servidor

- **Windows 10/11** (64 bits) — instalador principal `.exe` (NSIS). También hay build `.dmg` (macOS) y `AppImage` (Linux).
- Idealmente una PC que **quede prendida** durante el horario de operación (es quien tiene la base de datos).
- ~500 MB de disco libres para la app + espacio para la base y los backups (crece lento; la base de una clínica pesa pocas decenas de MB).
- Conexión a la **misma red local** que las terminales (cable de preferencia; el servidor no debería andar por Wi-Fi inestable).
- Internet **opcional** (solo para recibir actualizaciones).

Las terminales solo necesitan un navegador **Chrome o Edge** actualizado y estar en la misma LAN.

---

## 2. IP fija o reserva DHCP para el servidor (importante)

Las terminales acceden por `http://IP-del-servidor:3051`. Si esa IP cambia (porque el router la asigna por DHCP y rota), **todas las terminales dejan de encontrar el servidor**. Por eso el servidor necesita **una IP que no cambie**. Dos formas (podés hacer una u otra; hacer las dos es lo más robusto):

**Opción A — Reserva DHCP por MAC (recomendada, se hace en el router):**
1. Averiguá la MAC del servidor: `Símbolo del sistema` → `ipconfig /all` → buscá la interfaz activa y anotá la **Dirección física** (formato `AA-BB-CC-11-22-33`).
2. Entrá al router (típicamente `http://192.168.0.1` o `192.168.1.1`) → sección **DHCP / Reserva de direcciones / Address Reservation**.
3. Asociá la MAC del servidor a una IP fija dentro del rango de la red (ej. `192.168.1.50`). Guardá y reiniciá el router si lo pide.

**Opción B — IP estática en Windows:**
1. `Configuración` → `Red e Internet` → `Cambiar opciones del adaptador` → clic derecho en la conexión → **Propiedades**.
2. Seleccioná **Protocolo de Internet versión 4 (TCP/IPv4)** → **Propiedades**.
3. Marcá **Usar la siguiente dirección IP** y completá con datos coherentes con la red:
   - Dirección IP: ej. `192.168.1.50` (fuera del rango que reparte el DHCP).
   - Máscara de subred: `255.255.255.0`.
   - Puerta de enlace: la IP del router (ej. `192.168.1.1`).
   - DNS: el del router o `8.8.8.8`.
4. Aceptar. Verificá con `ipconfig` que la IP quedó fija.

> Anotá la IP elegida (ej. `192.168.1.50`): es la que van a usar todas las terminales.

---

## 3. Regla de firewall de Windows (puerto entrante)

Por defecto el Firewall de Windows bloquea las conexiones entrantes al puerto 3051, así que **las terminales no llegan al servidor** hasta abrirlo. Abrí una **Símbolo del sistema como Administrador** y ejecutá:

```
netsh advfirewall firewall add rule name="LavaTrack 3051" dir=in action=allow protocol=TCP localport=3051
```

- Si cambiaste el puerto en Ajustes, reemplazá `3051` en **el nombre y en `localport`** por el puerto real.
- Para revisar la regla: `netsh advfirewall firewall show rule name="LavaTrack 3051"`.
- Para quitarla: `netsh advfirewall firewall delete rule name="LavaTrack 3051"`.

---

## 4. Instalar y arrancar el servidor

1. Copiá el instalador (`LavaTrack-Setup-x.y.z.exe`) a la PC servidor y ejecutalo. Publisher: **BPSG Sistemas**.
2. Abrí LavaTrack. Al primer arranque crea la base en `userData` y (si está vacía) carga datos de ejemplo.
3. En **Ajustes** confirmá o cambiá el **puerto** (default 3051). Si lo cambiás, la app pide reiniciar y hay que ajustar la regla de firewall.
4. La app conoce sus propias IPs de LAN: abrí la página **`/terminal-info`** (`http://localhost:3051/terminal-info`) para ver las URLs exactas de acceso y el comando de modo aplicación listos para pasarle a las terminales.

---

## 5. Conectar cada terminal

En cada PC terminal, dentro de la misma red:

1. Abrí **Chrome o Edge** y entrá a `http://IP-del-servidor:3051` (ej. `http://192.168.1.50:3051`).
2. (Opcional) Modo aplicación, sin barras del navegador, con acceso directo propio:
   ```
   chrome --app=http://192.168.1.50:3051
   ```
   En Edge es `msedge --app=http://192.168.1.50:3051`. Podés crear un acceso directo en el escritorio con ese comando.
3. Si aparece el banner **"Sin conexión"**, la terminal no está llegando al servidor: revisá que el servidor esté abierto, que la IP sea la correcta, que estén en la misma red y que la regla de firewall (paso 3) esté puesta.

> La página **`/terminal-info`** del servidor tiene estas mismas URLs y comandos ya armados con la IP real; es la forma más rápida de dar de alta terminales.

---

## 6. Backups y restauración

- LavaTrack hace **backups diarios automáticos** en `userData/backups/` como archivos `lavatrack-AAAAMMDD-HHmmss.db.gz`, conservando los **30 más recientes**.
- **Exportar**: desde el menú, exportá un backup a una ubicación externa (carpeta de red o pendrive) para tener copia fuera de la PC servidor. Recomendado hacerlo periódicamente.
- **Restaurar**: desde el menú elegí un `.db.gz`; la app reemplaza la base actual (deja una copia `.pre-restore` por seguridad) y **se reinicia**. Hacelo con la operación detenida (nadie escribiendo desde las terminales).

> La ubicación real de `userData` en Windows suele ser `C:\Users\<usuario>\AppData\Roaming\LavaTrack`. La base es `lavatrack.db` (más los auxiliares `-wal` y `-shm`).

---

## 7. Checklist de verificación (desde una segunda PC)

Hacé esto desde **otra PC** de la LAN (no el servidor), para confirmar que la instalación quedó accesible en red:

- [ ] El servidor está prendido y LavaTrack abierto en la PC servidor.
- [ ] La PC servidor tiene **IP fija o reserva DHCP** y anotaste esa IP.
- [ ] La **regla de firewall** del puerto (3051 o el configurado) está creada en el servidor.
- [ ] Ambas PCs están en la **misma red** (mismo rango de IP, ej. `192.168.1.x`).
- [ ] Desde la segunda PC hay conectividad: `ping IP-del-servidor` responde.
- [ ] En el navegador de la segunda PC, `http://IP-del-servidor:3051` **carga la app**.
- [ ] `http://IP-del-servidor:3051/api/health` devuelve un JSON con `"ok": true`.
- [ ] **No** aparece el banner "Sin conexión"; podés navegar y registrar un movimiento de prueba.
- [ ] (Opcional) El acceso directo en modo `--app` abre LavaTrack a pantalla completa.

Si algún punto falla, el orden habitual de revisión es: servidor abierto → IP correcta → misma red (`ping`) → regla de firewall → puerto configurado.

---

## Publicación de releases (updates)

Esta sección explica cómo publicar una nueva versión de LavaTrack para que las instalaciones existentes la reciban por auto-update. El modelo es el mismo que ya usamos en **StockFlow (Stock Fácil)**, con las diferencias que se aclaran al final.

### 1. Modelo

El feed de actualizaciones **no** vive en un VPS ni en un servidor propio: es **GitHub Releases**. `electron-updater` está configurado con `provider: github` en `electron/electron-builder.yml`, apuntando al repo **`brunomartinpasquetta-dot/lavatrack-desktop`** con `private: false`.

Como el repo es **público**, el cliente descarga `latest.yml` / `latest-mac.yml` y el instalador por URL directa **sin necesidad de token**. `electron-updater` resuelve el feed a:

```
https://github.com/brunomartinpasquetta-dot/lavatrack-desktop/releases/download/vX.Y.Z/latest*.yml
```

El updater en `electron/main.js` toma este feed del bloque `publish` (github) que queda *baked* en `app-update.yml` al buildear. Owner y repo son **overridables por variables de entorno** (`LAVATRACK_GH_OWNER`, `LAVATRACK_GH_REPO`).

> **Estado:** el repo `brunomartinpasquetta-dot/lavatrack-desktop` **ya está creado** (público) y la **v1.0.0 ya está publicada** (2026-07-05) con el `.dmg`, el `.exe` y ambos feeds. Si algún día hay que recrearlo: `gh repo create brunomartinpasquetta-dot/lavatrack-desktop --public` (o por API si no hay `gh`).

### 2. Requisitos

- **`GH_TOKEN`**: un Personal Access Token (PAT) con scope **`repo`**, exportado en el entorno desde donde se publica.
- **`git`** configurado con acceso al repo (para pushear tags). **`gh` CLI es opcional**: en la Mac de Bruno **no está instalado**, así que la subida de assets se hace por la **API de GitHub con `curl`** (lo hace el script). Si tenés `gh`, también sirve `gh release upload`.
- **Node 20+** (LavaTrack usa `node:sqlite` nativo, que necesita Node moderno).
- **⚠️ El build de Windows NO sale confiable del CI.** En este proyecto el job `windows-latest` **se cuelga en `makensis`** (probado 6 veces, con `differentialPackage:false` + `compression:store` + exclusiones de antivirus; hasta el fallback `zip` se colgó en la subida). **El Windows se buildea LOCAL en la Mac con wine**, que electron-builder **descarga solo** (no hace falta instalar wine por brew). Ver la sección "Windows local con wine" más abajo.

### 3. Publicar una versión (manual, desde una Mac)

Este es el camino para publicar a mano desde una Mac. Antes de empezar, exportá las variables de entorno (nunca las hardcodees en scripts ni en el repo):

```
export GH_TOKEN=ghp_tu_pat_con_scope_repo
export LAVATRACK_GH_OWNER=brunomartinpasquetta-dot   # opcional, es el default
export LAVATRACK_GH_REPO=lavatrack-desktop            # opcional, es el default
```

Pasos:

1. **Bump de versión** en `electron/package.json` (ej. de `1.2.3` a `1.2.4`). Es la versión que verá el updater; tiene que subir siguiendo semver.
2. **Commit** del cambio:
   ```
   git commit -am "Release v1.2.4"
   ```
3. **Tag** con la misma versión, prefijado con `v`:
   ```
   git tag v1.2.4
   ```
4. **Push** de la rama y del tag:
   ```
   git push origin main --tags
   ```
5. **Buildear y publicar** al feed de GitHub. Dos opciones equivalentes:
   ```
   scripts/publicar-release.sh
   ```
   El script valida `GH_TOKEN`, buildea, verifica que estén los artefactos (instalador + `latest*.yml`), publica al feed de GitHub y verifica con `curl` contra el `latest*.yml`. Soporta `--dry-run` (buildea a staging **sin subir**) para ensayar sin publicar.

   O directamente el script de electron-builder:
   ```
   npm --prefix electron run publish:mac
   ```
   (electron-builder con `--publish always` sube el artefacto a un release **draft** en GitHub.)
6. **Editar y publicar el draft en GitHub.** electron-builder deja el release como **draft**. Entrá al release en GitHub, agregá las notas de la versión y hacé **"Publish release"**. **Hasta que no lo publiques, los clientes NO reciben el update.**

### 4. Flujo de release DEFINITIVO (el que funciona)

Por el cuelgue de `makensis` en el CI de Windows, el release se arma en **dos mitades**:

**(a) macOS + el release + los feeds → por CI (push del tag).** El workflow `.github/workflows/release.yml` se dispara con `push` de tags `v*`, corre en matrix `macos-latest` + `windows-latest` y **publica el `.dmg` + `latest-mac.yml`** (mac funciona perfecto). El job de Windows queda como **fallback `zip` no confiable** (ver nota abajo).

```
# bump versión en electron/package.json → commit → tag → push
git tag v1.2.4
git push origin main --tags     # dispara el CI: publica macOS
```

**(b) Windows `.exe` → build LOCAL en la Mac con wine + subida al mismo release.** Una vez que el release existe (lo crea el CI de macOS), buildeás Windows local y subís los assets al release ya existente. Todo esto lo automatiza el script:

```
export GH_TOKEN=ghp_tu_pat_con_scope_repo
scripts/release-windows-local.sh 1.2.4        # buildea con wine y sube .exe + latest.yml + blockmap
scripts/release-windows-local.sh 1.2.4 --dry-run   # sólo buildea y verifica, sin subir
```

#### Windows local con wine — qué hace por dentro

Estos son los comandos exactos que corre el script (y que se usaron para la v1.0.0):

```
# 1) buildear el cliente y el instalador Windows x64 con wine
npm --prefix client run build
cd electron
npx electron-builder --win --x64 --publish never --config.compression=store
#   → electron-builder descarga wine-4.0.1-mac.7z SOLO (no hace falta brew).
#   → genera dist-desktop/LavaTrack-1.2.4-setup.exe + latest.yml + .blockmap
#   → makensis local (bajo wine, en la Mac) compila en minutos, NO se cuelga.

# 2) subir los 3 assets al release existente (electron-builder NO los sube: si el
#    release tiene +2h aplica su "regla de 2 horas"; por eso se sube aparte).
#    Como en la Mac no hay gh, se usa la API de GitHub con curl (lo hace el script).
#    Si tenés gh:  gh release upload v1.2.4 dist-desktop/LavaTrack-1.2.4-setup.exe dist-desktop/latest.yml dist-desktop/*.blockmap --clobber
```

> **Nota `--config.compression=store`:** deja el instalador más pesado pero compila rápido y sin riesgo. Para un instalador más chico se puede probar sin ese flag (compresión normal); si tarda mucho o se cuelga, volvé a `store`.

> **Nota sandbox:** si corrés en un entorno donde `ELECTRON_RUN_AS_NODE=1` está seteado globalmente, antepené `env -u ELECTRON_RUN_AS_NODE` a electron-builder. En una Mac normal no hace falta.

#### Troubleshooting Windows local

- **wine no descarga / falla:** electron-builder baja `wine-4.0.1-mac.7z` a su cache (`~/Library/Caches/electron-builder`). Si la descarga falla, reintentá; como último recurso `brew install --cask wine-stable` y volvé a correr el build.
- **makensis se cuelga también en local:** no debería (en la Mac arm64 compila en minutos). Si pasa, agregá `--config.compression=store` (ya está en el script) o revisá que no haya un antivirus escaneando `dist-desktop`.
- **El CI de Windows:** su job quedó con `--win zip` como **fallback no confiable** (también se colgó en la subida del zip la última vez). **No dependas de él**: para Windows, usá siempre el build local con wine. El diagnóstico del cuelgue de `makensis` en el runner queda pendiente.

### 5. Qué recibe el cliente

- El cliente **chequea al iniciar y después cada 4 horas**.
- Si hay una versión nueva publicada, la **descarga en background** y la aplica.
- **Sin internet = silencio**: si no hay conexión, el updater no molesta ni muestra errores; simplemente no actualiza.
- **En macOS, sin firma de Apple, el auto-update no se aplica solo.** Hay que **instalar el `.dmg` a mano**. Es una lección heredada de StockFlow: sin firma, macOS no deja que el update se instale automáticamente. En Windows el `.exe` (NSIS x64) tampoco está firmado, así que SmartScreen va a pedir **"Más información → Ejecutar de todas formas"** la primera vez.

### 6. Diferencias con StockFlow

Todo el modelo es igual al de StockFlow (GitHub Releases como feed, repo público, tags semver, canal único estable `latest*.yml`, chequeo al iniciar + cada 4h, sin firma). Las únicas diferencias:

- **Build de Windows (la diferencia importante):** en **StockFlow el job `windows-latest` del CI buildea el NSIS sin problema**. En **LavaTrack ese mismo job se cuelga en `makensis`** (6 intentos, todas las mitigaciones) → **el `.exe` de LavaTrack se buildea LOCAL en la Mac con wine** y se sube al release aparte. Es el único paso manual extra respecto de StockFlow.
- **`npm`** en vez de `pnpm` (LavaTrack no usa pnpm).
- **Sin `electron-rebuild`**: LavaTrack usa `node:sqlite` nativo, no hay módulos nativos que compilar.
- **Repo propio**: `lavatrack-desktop` (StockFlow usa `stockflow-desktop`).

### 7. Rollback

Si una versión salió mal:

1. **Borrá el release en GitHub** (el release, **no** el tag). Al desaparecer del feed, los clientes dejan de ofrecerlo.
2. **Publicá un patch** (subí la versión, ej. `1.2.5`, y repetí el flujo de publicación). Los clientes saltan a la versión buena.

> No borres el tag: el tag es el registro histórico. Alcanza con quitar el release del feed y publicar el arreglo por encima.
