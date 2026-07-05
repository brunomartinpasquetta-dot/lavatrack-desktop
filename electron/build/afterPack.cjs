// Hook afterPack de electron-builder: firma AD-HOC el .app de macOS después de
// empaquetarlo (con todos los extraResources server/ + client/dist ya copiados).
//
// Por qué: sin cuenta Apple Developer, electron-builder "saltea" el firmado y el .app
// queda con la firma original de Electron INVALIDADA por las modificaciones del bundle
// → Gatekeeper reporta "LavaTrack está dañado y no se puede abrir". electron-builder v25
// no hace ad-hoc con identity:'-' (lo toma como nombre de keychain), así que lo forzamos
// acá con codesign --force --deep --sign -, que produce una firma ad-hoc consistente.
// Es ad-hoc, NO notarizado: el cliente abre con click derecho → Abrir la primera vez.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return; // solo macOS

  const appName = context.packager.appInfo.productFilename; // "LavaTrack"
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.log(`[afterPack] firmando ad-hoc el bundle: ${appPath}`);
  // --force: reemplaza cualquier firma previa. --deep: firma frameworks/helpers anidados.
  // --sign -: firma ad-hoc (sin identidad). Firma el .app completo ya modificado.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  // Verificación estricta: si la firma quedó inconsistente, esto falla y aborta el build.
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { stdio: 'inherit' });
  console.log('[afterPack] firma ad-hoc consistente ✅');
};
