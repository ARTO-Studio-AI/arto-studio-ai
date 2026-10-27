#!/usr/bin/env bash
# Sincroniza el ARTO Edit Bundle #1 de Drive (MacBook) al repo de la Mac Mini (Victor, 27 oct 2026).
#
# Se corre en la MacBook, donde Drive tiene los skills:
#   bash scripts/sync-edit-bundle.sh            # copia y regenera el manifiesto
#   bash scripts/sync-edit-bundle.sh --dry-run  # solo dice que copiaria
#
# Lee de cada <slug>/ en la carpeta del bundle en Drive (contrato:
# «261027 ASAI especificacion ARTO Edit Bundle 1 v1.0.md»):
#   ficha.json                        -> src/lib/edit-bundle/fichas/<slug>.json
#   demo/demo.mp4, demo/poster.jpg    -> public/skills/demos/<slug>.mp4 y .jpg
#   <slug> - SKILL - V<ver>.skill     -> private/skills/<slug>.skill
# y de la raiz:
#   arto-edit-bundle-1 - V<ver>.zip   -> private/skills/arto-edit-bundle-1.zip
#
# Copia con scp a la Mac Mini y ahi corre scripts/edit-bundle-manifest.mjs, que revisa
# pesos y escribe src/lib/edit-bundle/assets.json. No hace commit ni push: eso va a mano
# en una rama, nunca en main. Bash 3 de macOS: sin declare -A.

set -euo pipefail

SRC="${EDIT_BUNDLE_SRC:-$HOME/Library/CloudStorage/GoogleDrive-vhcelaya@artogroup.com/Shared drives/CLAUDE DRIVE/CC CW Project Folders/ASAI ARTO Studio AI Project/skills/arto-edit-bundle-1}"
REMOTE="${EDIT_BUNDLE_REMOTE:-mac-mini}"
REPO="${EDIT_BUNDLE_REPO:-Projects/arto-studio-ai}"   # relativo al home remoto
VER="${EDIT_BUNDLE_VERSION:-1.0}"
BUNDLE="arto-edit-bundle-1"
SLUGS="arto-edit-cortes arto-edit-subtitulos arto-edit-letras-detras arto-edit-recuadros arto-edit-titulares arto-edit-color arto-edit-zooms arto-edit-sonido arto-edit-director"
MAX_MP4=1572864   # 1.5 MB
MAX_JPG=153600    # 150 KB
MAX_PKG=4613734   # 4.4 MB (la respuesta de una funcion de Vercel no pasa de 4.5 MB)

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

fail() { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "aviso: $*" >&2; }
bytes() { stat -f%z "$1" 2>/dev/null || stat -c%s "$1"; }

[ -d "$SRC" ] || fail "no existe la carpeta del bundle: $SRC"

branch=$(ssh "$REMOTE" "cd ~/$REPO && git rev-parse --abbrev-ref HEAD")
[ "$branch" = "main" ] && fail "el repo remoto esta en main; cambia a una rama (por ejemplo feat/edit-bundle-1) antes de sincronizar"
echo "Destino: $REMOTE:~/$REPO (rama $branch)"

copied=0
missing=0

# put <archivo local> <ruta relativa en el repo> <limite en bytes o 0>
put() {
  local src="$1" rel="$2" max="$3" size
  if [ ! -f "$src" ]; then
    warn "falta $(basename "$(dirname "$src")")/$(basename "$src")"
    missing=$((missing + 1))
    return 0
  fi
  size=$(bytes "$src")
  if [ "$max" -gt 0 ] && [ "$size" -gt "$max" ]; then
    fail "$rel pesa $size bytes (maximo $max)"
  fi
  if [ "$DRY" -eq 1 ]; then
    echo "  copiaria $rel ($size bytes)"
  else
    scp -q "$src" "$REMOTE:$REPO/$rel"
    echo "  $rel ($size bytes)"
  fi
  copied=$((copied + 1))
}

# check_pkg <zip>: el paquete no lleva demo/, ficha.json ni .DS_Store (contrato)
check_pkg() {
  [ -f "$1" ] || return 0
  if unzip -l "$1" | grep -E '(\.DS_Store|/demo/|ficha\.json)' >/dev/null; then
    fail "$(basename "$1") trae .DS_Store, demo/ o ficha.json; reempaquetalo"
  fi
}

for slug in $SLUGS; do
  dir="$SRC/$slug"
  echo "$slug"
  if [ -f "$dir/ficha.json" ]; then
    python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1], encoding="utf-8")); assert d.get("slug")==sys.argv[2], "slug distinto en ficha.json"' "$dir/ficha.json" "$slug" \
      || fail "$slug/ficha.json no es JSON valido o su slug no coincide"
    if grep -q "$(printf '\xe2\x80\x94')" "$dir/ficha.json"; then fail "$slug/ficha.json trae em dashes"; fi
  fi
  put "$dir/ficha.json" "src/lib/edit-bundle/fichas/$slug.json" 0
  put "$dir/demo/demo.mp4" "public/skills/demos/$slug.mp4" "$MAX_MP4"
  put "$dir/demo/poster.jpg" "public/skills/demos/$slug.jpg" "$MAX_JPG"
  check_pkg "$dir/$slug - SKILL - V$VER.skill"
  put "$dir/$slug - SKILL - V$VER.skill" "private/skills/$slug.skill" "$MAX_PKG"
done

echo "$BUNDLE"
put "$SRC/$BUNDLE - V$VER.zip" "private/skills/$BUNDLE.zip" "$MAX_PKG"

if [ "$DRY" -eq 1 ]; then
  echo "Simulacion: $copied archivos listos, $missing faltan. No se copio nada."
  exit 0
fi

ssh "$REMOTE" "cd ~/$REPO && node scripts/edit-bundle-manifest.mjs && git status --short -- src/lib/edit-bundle public/skills private/skills"
echo "Listo: $copied archivos copiados, $missing faltan. Revisa, corre las pruebas y haz commit en la rama $branch."
