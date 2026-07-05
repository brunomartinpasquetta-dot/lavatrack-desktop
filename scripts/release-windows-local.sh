#!/usr/bin/env bash
# Build LOCAL del instalador de Windows con wine (en la Mac) + subida al release existente.
#
# POR QUÉ existe: el job de Windows del CI se cuelga en makensis (ver docs/DEPLOY.md).
# La Mac + wine compila el NSIS en minutos. electron-builder descarga wine solo (no brew).
#
# Flujo: valida el tag → buildea el .exe x64 con wine → sube .exe + latest.yml + blockmap
# al release vX.Y.Z YA EXISTENTE (sin crear release duplicado) → verifica el feed público.
#
# Config por VARIABLES DE ENTORNO (nunca se hardcodean credenciales):
#   GH_TOKEN            PAT de GitHub con scope 'repo'  (obligatorio salvo --dry-run)
#   LAVATRACK_GH_OWNER  owner del repo  (default: brunomartinpasquetta-dot)
#   LAVATRACK_GH_REPO   repo            (default: lavatrack-desktop)
#
# Uso:
#   scripts/release-windows-local.sh [VERSION]            # buildea y SUBE al release vVERSION
#   scripts/release-windows-local.sh [VERSION] --dry-run  # buildea y verifica, SIN subir
#   (si no se pasa VERSION, se toma de electron/package.json)
set -euo pipefail
# electron-builder no debe correr con Electron en modo Node (fix de sandbox; inocuo en real).
unset ELECTRON_RUN_AS_NODE

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

# --- Argumentos ---
DRY_RUN=false
VERSION=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) VERSION="$arg" ;;
  esac
done
[ -n "$VERSION" ] || VERSION="$(node -p "require('./electron/package.json').version")"

OWNER="${LAVATRACK_GH_OWNER:-brunomartinpasquetta-dot}"
REPO="${LAVATRACK_GH_REPO:-lavatrack-desktop}"
TAG="v${VERSION}"
DIST="electron/dist-desktop"
API="https://api.github.com/repos/${OWNER}/${REPO}"
UPLOADS="https://uploads.github.com/repos/${OWNER}/${REPO}"

echo "──────────────────────────────────────────────────────────"
echo " LavaTrack — build Windows LOCAL (wine) + subida al release"
echo "   Versión: ${VERSION}   Tag: ${TAG}"
echo "   Repo:    ${OWNER}/${REPO}    Dry-run: ${DRY_RUN}"
echo "──────────────────────────────────────────────────────────"

curl_auth() { curl -s --max-time 60 -H "Authorization: Bearer ${GH_TOKEN}" -H "Accept: application/vnd.github+json" "$@"; }

# --- 1) Validaciones ---
if [ "$DRY_RUN" = false ]; then
  [ -n "${GH_TOKEN:-}" ] || { echo "ERROR: falta GH_TOKEN (PAT scope repo). Exportalo o usá --dry-run." >&2; exit 1; }
  # El tag debe existir en el remoto (el release se crea al pushear el tag / correr el CI de mac).
  if ! git ls-remote --tags "https://github.com/${OWNER}/${REPO}.git" "refs/tags/${TAG}" 2>/dev/null | grep -q "${TAG}"; then
    echo "ERROR: el tag ${TAG} no existe en el remoto. Pusheá el tag primero (git push origin ${TAG})." >&2
    exit 1
  fi
fi

# --- 2) Build Windows x64 con wine ---
# Limpiar artefactos Windows previos (si no, un .exe viejo de otra versión puede colarse).
rm -f "$DIST"/*setup*.exe "$DIST"/*setup*.exe.blockmap "$DIST"/latest.yml 2>/dev/null
echo "▶ Buildeando cliente + instalador Windows x64 (wine se descarga solo)…"
npm --prefix client run build >/dev/null
# Compresión normal (default): makensis local con wine NO se cuelga, así que no hace falta
# 'store' (que dejaba el instalador ~3x más pesado). 'store' era mitigación del cuelgue en CI.
( cd electron && npx electron-builder --win --x64 --publish never )

# --- 3) Verificar artefactos (por nombre exacto de versión, no por glob) ---
EXE="$DIST/LavaTrack-${VERSION}-setup.exe"
YML="$DIST/latest.yml"
BLOCKMAP="$(ls "$DIST"/*setup*.exe.blockmap 2>/dev/null | head -1)"
[ -n "$EXE" ] && [ -f "$EXE" ] || { echo "ERROR: no se generó el .exe en $DIST" >&2; exit 1; }
[ -f "$YML" ] || { echo "ERROR: no se generó $YML (metadata del feed Windows)" >&2; exit 1; }
echo "✔ Instalador: $(basename "$EXE") ($(du -h "$EXE" | cut -f1))"
echo "✔ Feed:       $(basename "$YML")  →  $(grep -E '^version:|^path:' "$YML" | tr '\n' '  ')"

if [ "$DRY_RUN" = true ]; then
  echo "✔ Dry-run: artefactos OK, no se sube nada."
  exit 0
fi

# --- 4) Subir al release existente (sin duplicar). gh si está; si no, API con curl ---
RELEASE_ID="$(curl_auth "${API}/releases/tags/${TAG}" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).id || ''")"
[ -n "$RELEASE_ID" ] || { echo "ERROR: no existe el release ${TAG} en GitHub (¿corriste el CI de macOS?)." >&2; exit 1; }
echo "▶ Subiendo assets al release ${TAG} (id ${RELEASE_ID})…"

subir_asset() {
  local file="$1" ctype="$2" name; name="$(basename "$file")"
  if command -v gh >/dev/null 2>&1; then
    gh release upload "${TAG}" "$file" --clobber --repo "${OWNER}/${REPO}"
    return
  fi
  # Sin gh: borrar el asset previo (clobber) y subir por la API.
  local aid
  aid="$(curl_auth "${API}/releases/${RELEASE_ID}/assets" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const a=JSON.parse(d).find(x=>x.name==='${name}');process.stdout.write(a?String(a.id):'')}catch(e){}})")"
  [ -n "$aid" ] && curl_auth -X DELETE "${API}/releases/assets/${aid}" -o /dev/null || true
  curl -s --max-time 900 -X POST -H "Authorization: Bearer ${GH_TOKEN}" -H "Content-Type: ${ctype}" \
    --data-binary @"$file" "${UPLOADS}/releases/${RELEASE_ID}/assets?name=${name}" \
    -o /dev/null -w "   ${name}: http=%{http_code} (%{time_total}s)\n"
}

subir_asset "$EXE" "application/octet-stream"
subir_asset "$YML" "text/yaml"
[ -n "$BLOCKMAP" ] && subir_asset "$BLOCKMAP" "application/octet-stream"

# --- 5) Verificación del feed público (sin token) ---
echo "▶ Verificando el feed Windows público (sin token)…"
FEED="https://github.com/${OWNER}/${REPO}/releases/download/${TAG}/latest.yml"
if curl -fsSL --max-time 40 "$FEED" -o /tmp/lavatrack-win-feed.yml; then
  echo "✔ latest.yml público OK → $(grep -E '^version:' /tmp/lavatrack-win-feed.yml)"
else
  echo "⚠ No se pudo leer $FEED (puede tardar unos segundos en propagar)."
fi
echo "✔ Listo. Release: https://github.com/${OWNER}/${REPO}/releases/tag/${TAG}"
