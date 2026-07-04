#!/usr/bin/env bash
# Publicación de releases de LavaTrack Desktop.
# Replica el flujo de StockFlow (github.com/brunomartinpasquetta-dot/stockflow-desktop):
#   build → verificación de artefactos (instalador + latest*.yml) → publicación al feed
#   de GitHub Releases → verificación post-subida con curl al latest*.yml.
#
# Config por VARIABLES DE ENTORNO (nunca se hardcodean credenciales ni rutas):
#   GH_TOKEN            PAT de GitHub con scope 'repo'  (obligatorio salvo --dry-run)
#   LAVATRACK_GH_OWNER  owner del repo  (default: brunomartinpasquetta-dot)
#   LAVATRACK_GH_REPO   repo            (default: lavatrack-desktop)   ← FALTANTE: crearlo
#   PLATAFORMA          mac | win | linux  (default: mac)
#
# Uso:
#   scripts/publicar-release.sh             # buildea y PUBLICA al feed de GitHub
#   scripts/publicar-release.sh --dry-run   # buildea a staging y verifica, SIN subir nada
#
# Nota: el tag vX.Y.Z debe estar pusheado antes de publicar (ver docs/DEPLOY.md).
# El build de Windows se hace en el runner de GitHub Actions; localmente sólo mac/linux.
set -euo pipefail
# electron-builder no debe correr con Electron en modo Node (fix de sandbox; inocuo en real).
unset ELECTRON_RUN_AS_NODE

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

OWNER="${LAVATRACK_GH_OWNER:-brunomartinpasquetta-dot}"
REPO="${LAVATRACK_GH_REPO:-lavatrack-desktop}"
PLAT="${PLATAFORMA:-mac}"
VERSION="$(node -p "require('./electron/package.json').version")"
TAG="v${VERSION}"
DIST="electron/dist-desktop"

echo "──────────────────────────────────────────────────────────"
echo " LavaTrack — publicar release ${TAG}"
echo "   Feed:       github.com/${OWNER}/${REPO} (releases)"
echo "   Plataforma: ${PLAT}    Dry-run: ${DRY_RUN}"
echo "──────────────────────────────────────────────────────────"

# 1) Validaciones
if [ "$DRY_RUN" = false ] && [ -z "${GH_TOKEN:-}" ]; then
  echo "ERROR: falta GH_TOKEN (PAT con scope repo). Exportalo o corré con --dry-run." >&2
  exit 1
fi

# 2) Build (+ publicación si NO es dry-run)
if [ "$DRY_RUN" = true ]; then
  echo "▶ Build local a staging (sin subir)…"
  npm --prefix electron run "build:${PLAT}"
else
  echo "▶ Build + publicación al feed de GitHub…"
  npm --prefix client run build
  ( cd electron && npx electron-builder --"${PLAT}" --publish always \
      -c.publish.owner="${OWNER}" -c.publish.repo="${REPO}" )
fi

# 3) Verificar artefactos locales (instalador + latest*.yml)
case "$PLAT" in
  mac)   INSTALADOR="$(ls "$DIST"/*.dmg 2>/dev/null | head -1)";      YML="$DIST/latest-mac.yml" ;;
  win)   INSTALADOR="$(ls "$DIST"/*.exe 2>/dev/null | head -1)";      YML="$DIST/latest.yml" ;;
  linux) INSTALADOR="$(ls "$DIST"/*.AppImage 2>/dev/null | head -1)"; YML="$DIST/latest-linux.yml" ;;
  *)     echo "ERROR: PLATAFORMA inválida: $PLAT" >&2; exit 1 ;;
esac
if [ -z "$INSTALADOR" ] || [ ! -f "$INSTALADOR" ]; then
  echo "ERROR: no se generó el instalador en $DIST" >&2; exit 1
fi
if [ ! -f "$YML" ]; then
  echo "ERROR: no se generó $YML (metadata del feed de electron-updater)" >&2; exit 1
fi
echo "✔ Instalador:        $(basename "$INSTALADOR")"
echo "✔ Metadata de feed:  $(basename "$YML")"
echo "  $(grep -E '^version:|^path:' "$YML" | tr '\n' '  ')"

# 4) Verificación post-subida (sólo si se publicó de verdad)
if [ "$DRY_RUN" = false ]; then
  URL="https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/$(basename "$YML")"
  echo "▶ Verificando el feed publicado: $URL"
  if curl -fsSL "$URL" -o /tmp/lavatrack-feed-check.yml 2>/dev/null; then
    echo "✔ latest*.yml accesible en el feed. Versión remota: $(grep -E '^version:' /tmp/lavatrack-feed-check.yml)"
  else
    echo "⚠ El release se crea como DRAFT: el latest*.yml NO es público hasta que edites"
    echo "  el release en GitHub y toques 'Publish release'."
    echo "  → https://github.com/${OWNER}/${REPO}/releases"
  fi
fi

echo "✔ Listo."
[ "$DRY_RUN" = false ] && echo "  Recordá PUBLICAR el draft en GitHub para que los clientes reciban el update."
exit 0
