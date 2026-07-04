// Proceso principal de LavaTrack Desktop.
// Envuelve (no reescribe) el servidor Express + el build del cliente en una app Electron
// offline-first. El servidor sigue siendo la fuente de verdad: acá sólo lo levantamos,
// preparamos las rutas/envs, abrimos la ventana y agregamos menús de terminales, backups
// y actualizaciones automáticas.
import { app, BrowserWindow, dialog, Menu, clipboard, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, copyFileSync } from 'node:fs';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Rutas de recursos (server + client) en dev y en producción ---
// En dev viven en el repo (../server, ../client). Empaquetado, electron-builder los copia
// a process.resourcesPath vía extraResources (ver electron-builder.yml).
function baseRecursos() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
}
function rutaServerSrc() {
  return path.join(baseRecursos(), 'server', 'src');
}
function rutaClientDist() {
  return path.join(baseRecursos(), 'client', 'dist');
}

// Puerto por defecto (coincide con el del servidor en modo web).
const PUERTO_DEFAULT = 3051;

// Estado del módulo.
let ventana = null;
let servidor = null; // instancia http.Server devuelta por iniciarServidor()
let puerto = PUERTO_DEFAULT;
let apiServer = null; // funciones importadas del servidor (config, net, backups)
let timerBackup = null;

// Carga perezosa de los módulos del servidor. IMPORTANTE: se llama DESPUÉS de setear las
// envs, porque config.js / connection.js / app.js calculan sus rutas al importarse.
async function cargarModulosServer() {
  const src = rutaServerSrc();
  const imp = (rel) => import(pathToFileURL(path.join(src, rel)).href);
  const [indexMod, configMod, netMod, backupMod] = await Promise.all([
    imp('index.js'),
    imp('config.js'),
    imp('net.js'),
    imp('db/backup.js'),
  ]);
  return {
    iniciarServidor: indexMod.iniciarServidor,
    leerConfig: configMod.leerConfig,
    escribirConfig: configMod.escribirConfig,
    ipsLan: netMod.ipsLan,
    urlAcceso: netMod.urlAcceso,
    crearBackup: backupMod.crearBackup,
    listarBackups: backupMod.listarBackups,
    restaurarBackup: backupMod.restaurarBackup,
  };
}

// Setea las variables de entorno que consume el servidor. DEBE ejecutarse antes de
// cargarModulosServer().
function prepararEntorno() {
  const userData = app.getPath('userData');
  process.env.LAVATRACK_DB_PATH = path.join(userData, 'lavatrack.db');
  process.env.LAVATRACK_CONFIG_PATH = path.join(userData, 'config.json');
  process.env.LAVATRACK_CLIENT_DIST = rutaClientDist();
  process.env.LAVATRACK_HOST = '0.0.0.0';
  return userData;
}

// --- Primera ejecución: preguntar por datos demo vs base vacía ---
function preguntarSeed() {
  const resp = dialog.showMessageBoxSync({
    type: 'question',
    buttons: ['Cargar datos de demostración', 'Empezar con base vacía'],
    defaultId: 0,
    cancelId: 1,
    title: 'LavaTrack — Primera ejecución',
    message: '¿Cómo querés iniciar LavaTrack?',
    detail:
      'Es la primera vez que abrís la aplicación en esta computadora.\n\n' +
      '• Datos de demostración: carga sectores, artículos y movimientos de ejemplo.\n' +
      '• Base vacía: empezás de cero, listo para cargar tus propios datos.',
  });
  return resp === 0; // true = seedSiVacio
}

// --- Backups automáticos ---
const MS_24H = 24 * 60 * 60 * 1000;

function dirBackups() {
  return path.join(app.getPath('userData'), 'backups');
}

async function backupSiCorresponde() {
  try {
    const backups = apiServer.listarBackups(dirBackups());
    const ultimo = backups[0];
    const desactualizado = !ultimo || Date.now() - ultimo.mtime > MS_24H;
    if (desactualizado) {
      const { archivo, bytes } = await apiServer.crearBackup(dirBackups(), 30);
      console.log(`[LavaTrack] Backup automático creado: ${archivo} (${bytes} bytes)`);
    }
  } catch (e) {
    console.error('[LavaTrack] No se pudo crear el backup automático:', e && e.message);
  }
}

function programarBackupsDiarios() {
  if (timerBackup) clearInterval(timerBackup);
  // Un backup cada 24h mientras la app esté abierta.
  timerBackup = setInterval(backupSiCorresponde, MS_24H);
}

// --- Actualizaciones automáticas (electron-updater) ---
// Feed: GitHub Releases (bloque `publish` de electron-builder, baked en app-update.yml),
// mismo patrón que StockFlow. Offline-first: sin internet o sin novedades, falla en silencio.
const INTERVALO_CHEQUEO_MS = 4 * 60 * 60 * 1000; // cada 4 horas, igual que StockFlow
function configurarUpdater() {
  const esMac = process.platform === 'darwin';

  // Nunca dejar que un error del updater tumbe la app (típico sin conexión).
  autoUpdater.on('error', (err) => {
    console.warn('[LavaTrack] Updater sin conexión o sin novedades:', err && err.message);
  });

  // En macOS sin firma Apple el auto-download no puede autoinstalarse: no descargamos
  // solos (se avisa y se instala el .dmg a mano). En Windows/Linux sí baja en background.
  autoUpdater.autoDownload = !esMac;
  autoUpdater.autoInstallOnAppQuit = true; // aplica al reiniciar

  // En dev no hay app empaquetada: checkForUpdates fallaría, lo salteamos.
  if (!app.isPackaged) return;

  const chequear = () => {
    // Sin internet = silencio total, como pide la spec (el .catch evita el crash).
    autoUpdater
      .checkForUpdatesAndNotify()
      .catch((e) => console.warn('[LavaTrack] Chequeo de actualizaciones omitido:', e && e.message));
  };
  chequear(); // al iniciar
  setInterval(chequear, INTERVALO_CHEQUEO_MS); // + cada 4 horas
}

// --- Menú de la aplicación ---
function construirMenu() {
  const ips = apiServer.ipsLan();
  const urlPrincipal = apiServer.urlAcceso(puerto);

  // Submenú con cada IP LAN detectada (para copiar la que corresponda).
  const itemsIps =
    ips.length > 0
      ? ips.map(({ interfaz, ip }) => ({
          label: `${ip}  (${interfaz})`,
          click: () => {
            clipboard.writeText(`http://${ip}:${puerto}`);
            mostrarAviso('URL copiada', `Se copió http://${ip}:${puerto} al portapapeles.`);
          },
        }))
      : [{ label: 'No se detectaron IPs de red (solo localhost)', enabled: false }];

  const plantilla = [
    // Menú de aplicación (macOS lo muestra con el nombre del producto).
    {
      label: 'LavaTrack',
      submenu: [
        { role: 'about', label: 'Acerca de LavaTrack' },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar LavaTrack' },
        { role: 'hideothers', label: 'Ocultar otras' },
        { role: 'unhide', label: 'Mostrar todo' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir de LavaTrack' },
      ],
    },
    {
      label: 'Terminales',
      submenu: [
        {
          label: 'Copiar URL para terminales',
          click: () => {
            clipboard.writeText(urlPrincipal);
            mostrarAviso(
              'URL copiada',
              `Se copió ${urlPrincipal} al portapapeles.\n\n` +
                'Pegala en el navegador de cada terminal de la LAN.'
            );
          },
        },
        {
          label: 'Copiar URL de una interfaz…',
          submenu: itemsIps,
        },
        { type: 'separator' },
        {
          label: 'Ver info de terminales (navegador)',
          click: () => shell.openExternal(`http://localhost:${puerto}/terminal-info`),
        },
        {
          label: 'Ver info de terminales (en la ventana)',
          click: () => {
            if (ventana) ventana.loadURL(`http://localhost:${puerto}/terminal-info`);
          },
        },
        { type: 'separator' },
        {
          label: 'Volver al panel principal',
          click: () => {
            if (ventana) ventana.loadURL(`http://localhost:${puerto}`);
          },
        },
      ],
    },
    {
      label: 'Backups',
      submenu: [
        {
          label: 'Crear backup ahora',
          click: async () => {
            try {
              const { archivo, bytes } = await apiServer.crearBackup(dirBackups(), 30);
              mostrarAviso(
                'Backup creado',
                `Se guardó una copia en:\n${archivo}\n(${bytes} bytes)`
              );
            } catch (e) {
              mostrarError('No se pudo crear el backup', e && e.message);
            }
          },
        },
        {
          label: 'Exportar backup…',
          click: () => exportarBackup(),
        },
        { type: 'separator' },
        {
          label: 'Restaurar backup…',
          click: () => restaurarBackupInteractivo(),
        },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar recarga' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(plantilla));
}

// Exportar backup a una ubicación elegida por el usuario.
async function exportarBackup() {
  const sugerido = `lavatrack-${new Date().toISOString().slice(0, 10)}.db.gz`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Exportar backup de LavaTrack',
    defaultPath: sugerido,
    filters: [{ name: 'Backup LavaTrack', extensions: ['db.gz', 'gz'] }],
  });
  if (canceled || !filePath) return;
  try {
    // Creamos un backup fresco y consistente, y lo copiamos al destino elegido.
    const { archivo } = await apiServer.crearBackup(dirBackups(), 30);
    copyFileSync(archivo, filePath);
    mostrarAviso('Backup exportado', `Se exportó el backup a:\n${filePath}`);
  } catch (e) {
    mostrarError('No se pudo exportar el backup', e && e.message);
  }
}

// Restaurar un backup elegido por el usuario y reiniciar la app.
async function restaurarBackupInteractivo() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Restaurar backup de LavaTrack',
    properties: ['openFile'],
    filters: [{ name: 'Backup LavaTrack', extensions: ['db.gz', 'gz'] }],
  });
  if (canceled || !filePaths || !filePaths[0]) return;

  const confirmar = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['Cancelar', 'Restaurar y reiniciar'],
    defaultId: 0,
    cancelId: 0,
    title: 'Confirmar restauración',
    message: '¿Restaurar este backup?',
    detail:
      'Se reemplazará la base de datos actual por la del backup.\n' +
      'Se guardará una copia de seguridad de la base actual (.pre-restore).\n' +
      'La aplicación se reiniciará al finalizar.',
  });
  if (confirmar !== 1) return;

  try {
    await apiServer.restaurarBackup(filePaths[0]);
    // Reiniciar para que el servidor abra la base restaurada desde cero.
    app.relaunch();
    app.exit(0);
  } catch (e) {
    mostrarError('No se pudo restaurar el backup', e && e.message);
  }
}

// Helpers de diálogos.
function mostrarAviso(titulo, mensaje) {
  dialog.showMessageBox(ventana ?? undefined, {
    type: 'info',
    title: titulo,
    message: titulo,
    detail: mensaje,
    buttons: ['Aceptar'],
  });
}
function mostrarError(titulo, mensaje) {
  dialog.showMessageBox(ventana ?? undefined, {
    type: 'error',
    title: titulo,
    message: titulo,
    detail: mensaje || 'Error desconocido.',
    buttons: ['Aceptar'],
  });
}

// --- Ventana principal ---
function crearVentana() {
  const urlPrincipal = apiServer.urlAcceso(puerto);
  ventana = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    // Título con la URL de acceso LAN para que se vea de un vistazo desde dónde entran las terminales.
    title: `LavaTrack — ${urlPrincipal}`,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [`--lavatrack-version=${app.getVersion()}`],
    },
  });

  // El SPA + la API viven en el mismo origen (localhost:puerto) → el router del cliente funciona.
  ventana.loadURL(`http://localhost:${puerto}`);

  // Mantener el título fijo aunque el documento cambie el suyo.
  ventana.on('page-title-updated', (e) => {
    e.preventDefault();
    ventana.setTitle(`LavaTrack — ${apiServer.urlAcceso(puerto)}`);
  });

  ventana.on('closed', () => {
    ventana = null;
  });
}

// --- Arranque ---
async function arrancar() {
  prepararEntorno();
  apiServer = await cargarModulosServer();

  // Puerto desde config.json (o default). Lo dejamos también en la env para /terminal-info.
  const config = apiServer.leerConfig();
  puerto = Number(config.puerto) || PUERTO_DEFAULT;
  process.env.LAVATRACK_PORT = String(puerto);

  // Primera ejecución = todavía no existe el archivo de la base.
  const primeraVez = !existsSync(process.env.LAVATRACK_DB_PATH);
  const seedSiVacio = primeraVez ? preguntarSeed() : true;

  try {
    servidor = await apiServer.iniciarServidor({
      puerto,
      host: '0.0.0.0',
      seedSiVacio,
      silencioso: false,
    });
    console.log(`[LavaTrack] Servidor levantado en http://localhost:${puerto}`);
  } catch (e) {
    mostrarError(
      'No se pudo iniciar LavaTrack',
      `Falló el arranque del servidor en el puerto ${puerto}.\n\n` +
        `Detalle: ${e && e.message}\n\n` +
        'Puede que el puerto esté ocupado por otra aplicación.'
    );
    app.exit(1);
    return;
  }

  construirMenu();
  crearVentana();

  // Backups: uno al arrancar si hace más de 24h que no hay, y luego uno diario.
  await backupSiCorresponde();
  programarBackupsDiarios();

  // Actualizaciones automáticas (silenciosas si no hay internet).
  configurarUpdater();
}

// Instancia única: evitar dos servidores compitiendo por el mismo puerto/DB.
const obtuvoLock = app.requestSingleInstanceLock();
if (!obtuvoLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (ventana) {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    }
  });

  app.whenReady().then(arrancar);

  app.on('activate', () => {
    // En macOS es común reabrir la ventana al clickear el dock si no hay ninguna.
    if (BrowserWindow.getAllWindows().length === 0 && apiServer) crearVentana();
  });

  app.on('window-all-closed', () => {
    // En macOS la app suele seguir viva (y el servidor LAN sigue sirviendo a las terminales).
    // En Windows/Linux, cerrar la ventana cierra la app (y detiene el servidor).
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    if (timerBackup) clearInterval(timerBackup);
    if (servidor) {
      try {
        servidor.close();
      } catch {
        /* ignorar */
      }
    }
  });
}
