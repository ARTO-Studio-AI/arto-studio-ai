#!/usr/bin/env bash
# Sincroniza el ARTO Edit Bundle #1 de Drive (MacBook) al repo de la Mac Mini (Victor, 27 oct 2026).
#
# Desde el 2026-11-05 cada skill pasa por scripts/add-skill.mjs, el mismo comando que sube
# cualquier skill (docs/ADDING_A_SKILL.md): valida SKILL.md y ficha.json, copia paquete y
# demos, lo registra en src/lib/catalogo/skills.json conservando su estado y regenera
# src/lib/catalogo/assets.json. Si el repo y Drive estan en la misma maquina, basta con
# correr add-skill.mjs directo sobre cada carpeta.
#
# Se corre en la MacBook, donde Drive tiene los skills:
#   bash scripts/sync-edit-bundle.sh            # copia y registra
#   bash scripts/sync-edit-bundle.sh --dry-run  # solo valida y dice que haria
#
# Lee de cada <slug>/ en la carpeta del bundle en Drive (contrato:
# «261027 ASAI especificacion ARTO Edit Bundle 1 v1.0.md»): SKILL.md, ficha.json,
# demo/demo.mp4, demo/poster.jpg y «<slug> - SKILL - V<ver>.skill». Y de la raiz:
#   arto-edit-bundle-1 - V<ver>.zip   -> private/skills/arto-edit-bundle-1.zip
#
# Copia con rsync a ~/.cache/asai-catalogo/ en la Mac Mini y ahi corre add-skill.mjs. No hace
# commit ni push: eso va en una rama, nunca en main. Bash 3 de macOS: sin declare -A.

set -euo pipefail

SRC="${EDIT_BUNDLE_SRC:-$HOME/Library/CloudStorage/GoogleDrive-vhcelaya@artogroup.com/Shared drives/CLAUDE DRIVE/CC CW Project Folders/ASAI ARTO Studio AI Project/skills/arto-edit-bundle-1}"
REMOTE="${EDIT_BUNDLE_REMOTE:-mac-mini}"
REPO="${EDIT_BUNDLE_REPO:-Projects/arto-studio-ai}"   # relativo al home remoto
VER="${EDIT_BUNDLE_VERSION:-1.0}"
BUNDLE="arto-edit-bundle-1"
SLUGS="arto-edit-cortes arto-edit-subtitulos arto-edit-letras-detras arto-edit-recuadros arto-edit-titulares arto-edit-color arto-edit-zooms arto-edit-sonido arto-edit-director"
CACHE=".cache/asai-catalogo"   # relativo al home remoto, fuera del repo
MAX_PKG=4613734   # 4.4 MB (la respuesta de una funcion de Vercel no pasa de 4.5 MB)

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

fail() { echo "ERROR: $*" >&2; exit 1; }
bytes() { stat -f%z "$1" 2>/dev/null || stat -c%s "$1"; }

[ -d "$SRC" ] || fail "no existe la carpeta del bundle: $SRC"

branch=$(ssh "$REMOTE" "cd ~/$REPO && git rev-parse --abbrev-ref HEAD")
[ "$branch" = "main" ] && fail "el repo remoto esta en main; cambia a una rama (por ejemplo feat/edit-bundle-1) antes de sincronizar"
echo "Destino: $REMOTE:~/$REPO (rama $branch)"

flag=""
[ "$DRY" -eq 1 ] && flag="--dry-run"

for slug in $SLUGS; do
  dir="$SRC/$slug"
  [ -d "$dir" ] || fail "falta la carpeta $slug en Drive"
  ssh "$REMOTE" "mkdir -p ~/$CACHE/$slug"
  rsync -a --delete --include 'SKILL.md' --include 'ficha.json' --include '*.skill' --include 'demo/' --include 'demo/demo.mp4' --include 'demo/poster.jpg' --exclude '*' \
    "$dir/" "$REMOTE:$CACHE/$slug/"
  ssh "$REMOTE" "cd ~/$REPO && node scripts/add-skill.mjs ~/$CACHE/$slug $flag"
done

echo "$BUNDLE"
zip="$SRC/$BUNDLE - V$VER.zip"
if [ -f "$zip" ]; then
  size=$(bytes "$zip")
  [ "$size" -gt "$MAX_PKG" ] && fail "$BUNDLE.zip pesa $size bytes (maximo $MAX_PKG)"
  if [ "$DRY" -eq 1 ]; then
    echo "  copiaria private/skills/$BUNDLE.zip ($size bytes)"
  else
    scp -q "$zip" "$REMOTE:$REPO/private/skills/$BUNDLE.zip"
    echo "  private/skills/$BUNDLE.zip ($size bytes)"
  fi
else
  echo "aviso: falta $BUNDLE - V$VER.zip" >&2
fi

if [ "$DRY" -eq 1 ]; then
  echo "Simulacion: no se copio nada."
  exit 0
fi

ssh "$REMOTE" "cd ~/$REPO && node scripts/catalogo-assets.mjs && git status --short -- src/lib/catalogo public/skills private/skills"
echo "Listo. Revisa, corre las pruebas y haz commit en la rama $branch."
