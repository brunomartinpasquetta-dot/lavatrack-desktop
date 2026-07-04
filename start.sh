#!/usr/bin/env bash
# LavaTrack — arranque único de la demo.
# 1) Instala dependencias si faltan  2) buildea el cliente  3) siembra la base si está vacía
# 4) levanta Express sirviendo API + estáticos en http://localhost:3051
set -e

RAIZ="$(cd "$(dirname "$0")" && pwd)"
cd "$RAIZ"

echo "🧺  LavaTrack — preparando la demo..."

# --- Dependencias del servidor ---
if [ ! -d "server/node_modules" ]; then
  echo "📦  Instalando dependencias del servidor..."
  npm --prefix server install
fi

# --- Dependencias del cliente ---
if [ ! -d "client/node_modules" ]; then
  echo "📦  Instalando dependencias del cliente..."
  npm --prefix client install
fi

# --- Build del cliente (siempre, para tomar los últimos cambios) ---
echo "🏗   Compilando el cliente (Vite)..."
npm --prefix client run build

# --- La siembra corre automáticamente dentro del servidor si la base está vacía ---
echo "🚀  Levantando el servidor en http://localhost:3051 ..."
exec node server/src/index.js
