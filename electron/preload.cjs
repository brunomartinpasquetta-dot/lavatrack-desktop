// Preload MINIMAL. Expone una marca de "estoy corriendo en la app de escritorio" al cliente.
// El cliente NO debe depender de esto: sólo lo consulta si existe (feature-detection).
// CJS + sandbox: el preload corre en un contexto aislado con contextIsolation.
const { contextBridge } = require('electron');

// La versión de la app llega por additionalArguments desde el proceso principal.
const argVersion = process.argv.find((a) => a.startsWith('--lavatrack-version='));
const version = argVersion ? argVersion.split('=')[1] : '';

contextBridge.exposeInMainWorld('lavatrackDesktop', {
  esDesktop: true,
  version,
  plataforma: process.platform,
});
