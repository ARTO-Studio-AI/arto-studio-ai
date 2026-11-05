# Cómo se sube todo al sitio

Actualizado el 2026-11-05. Prompts, skills y mods de `creative.artostudio.ai`. Ninguno pide tocar código a mano.

| Qué | Cómo | Dónde queda |
|---|---|---|
| Prompts | Desde el panel, sin PR | Base de datos (`prompts`) |
| Skills | `node scripts/add-skill.mjs <carpeta>` en una rama, con PR | `src/lib/catalogo/skills.json` y `private/skills/` |
| Mods | `node scripts/add-mod.mjs <mod.json>` en una rama, con PR | `src/lib/catalogo/mods.json` |

Para ver qué hay y en qué estado: **`/admin/skills`** (solo lectura).

## 1. Prompts

Todo por el panel, en producción y sin despliegue:

- **Uno nuevo**: `/admin/catalogo/nuevo`.
- **Muchos**: `/admin/catalogo/importar` con un CSV. Lo fácil es exportar desde `/admin/catalogo`, editar en Sheets y volver a subir. Sin `id` es alta y entra **no disponible**; con `id` edita solo las celdas con valor.
- **Publicar**: en `/admin/catalogo`, columna «disponible».
- **Deshacer**: `/admin/catalogo/historial`. Cada cambio o importación es un lote que se revierte entero.

## 2. Skills

### La carpeta (la de Drive)

```
skills/<slug>/
  SKILL.md                         frontmatter con name (= slug) y description
  ficha.json                       textos de la página, en es y en
  <slug> - SKILL - V<version>.skill   zip con la carpeta <slug>/ adentro
  demo/demo.mp4                    opcional, hasta 1.5 MB
  demo/poster.jpg                  opcional, hasta 150 KB
```

`ficha.json` tiene la forma de las del Edit Bundle: `slug`, `order`, `category`, `name`, `tagline`, `what`, `you_say`, `needs`, `time` (todos con `es` y `en`), `version` y, si aplica, `placeholder: true` y `chatgpt_note`. Si el skill estrena categoría, la ficha trae también `category_copy` con `name`, `body` y `kicker` en `es` y `en`.

### El comando

En la Mac Mini, que tiene el repo y Drive:

```bash
cd ~/Projects/arto-studio-ai && git switch -c feat/skill-<slug> origin/main
DRIVE="$HOME/Library/CloudStorage/GoogleDrive-vhcelaya@artogroup.com/Shared drives/CLAUDE DRIVE/CC CW Project Folders/ASAI ARTO Studio AI Project/skills"

node scripts/add-skill.mjs "$DRIVE/<slug>" --dry-run   # solo revisa
node scripts/add-skill.mjs "$DRIVE/<slug>"             # lo sube oculto
```

El script valida la carpeta (frontmatter, ficha en los dos idiomas, sin em dashes ni palabras prohibidas, paquete limpio y dentro del peso), copia el paquete a `private/skills/` y la demo a `public/skills/demos/`, registra el skill en `skills.json` y regenera `assets.json`. Si algo falla, no escribe nada y dice qué arreglar.

Luego `npx vitest run && npm run build`, commit y PR. Al mergear, el skill queda en el sitio con el estado que tenga.

### Estados

| Estado | En /skills | Página | Descarga |
|---|---|---|---|
| `hidden` (lo nuevo entra así) | no | 404 | no |
| `coming_soon` | sí, con «Muy pronto» | sí | no |
| `published` | sí | sí | según la regla de su categoría |

```bash
node scripts/add-skill.mjs "$DRIVE/<slug>" --publish       # sube y publica
node scripts/add-skill.mjs "$DRIVE/<slug>" --coming-soon
node scripts/add-skill.mjs --estado <slug> published       # cambia el estado sin volver a copiar
```

Volver a correr el comando sobre un skill que ya existe lo actualiza (ficha, paquete y demo) y **conserva su estado** si no pides otro. Así se sube una versión nueva.

### Quién descarga

Lo decide la categoría (`access` en `skills.json`), no el script:

- `edit-bundle-1`: la regla del ARTO Edit Bundle #1 (`src/lib/edit-bundle/access.ts`). Gratis con cuenta hasta el 7 nov de 2026, después solo Pro.
- `pro`: solo Pro y Enterprise. Es la que recibe una categoría nueva.

Abrir una categoría gratis o cambiar una regla es decisión de Victor y va en `docs/DECISIONES.md`.

### El Edit Bundle

`bash scripts/sync-edit-bundle.sh` (desde la MacBook) pasa los 9 skills por el mismo `add-skill.mjs` y copia el `.zip` del bundle. En la Mac Mini también se puede correr `add-skill.mjs` sobre cada carpeta.

## 3. Mods

Solo entra un mod con su **FICHA DE VERIFICACION** en `mods/` de Drive (skill `asai-auditoria-de-mods`).

1. Escribe `mod.json` en la carpeta del mod, con la forma de una entrada de `src/lib/catalogo/mods.json`: `code` (MOD02, MOD03…), `slug`, `name`, `releaseDate` (AAAA-MM-DD), `version`, `author`, `license` y `copy.es` / `copy.en` con `tagline`, `what` y `checked` (lo que revisamos).
2. En una rama:

```bash
node scripts/add-mod.mjs "<carpeta del mod>/mod.json"                 # oculto
node scripts/add-mod.mjs "<carpeta del mod>/mod.json" --coming-soon   # sale con su fecha
node scripts/add-mod.mjs --estado <slug> published
```

3. Pruebas, build, commit y PR. `/mods` lee el manifiesto. La descarga de mods todavía no existe.

## 4. Qué revisa Fable antes de publicar

Un skill o mod pasa a `published` o `coming_soon` solo con la revisión de Fable en el PR:

- **Textos**: español de México, sin em dashes ni palabras prohibidas (el script ya lo revisa), ARTO como «agencia creativa», sin precios de N7 ni promesas que el skill no cumple.
- **Paquete**: que el `.skill` sea el que se probó (huella SHA-256 en `/admin/skills` igual a la de Drive), que traiga solo la carpeta del skill y que el `SKILL.md` no pida nada peligroso (llaves, red, borrar archivos).
- **Acceso**: que la categoría tenga la regla que decidió Victor. Un cambio de regla o de precio no se publica sin su decisión escrita.
- **Página**: el preview del PR responde 200 en `/es/skills/<slug>` y `/en/skills/<slug>`, y la descarga hace lo que dice la regla (sin sesión, cuenta gratis y Pro).

Los skills que esperan el cierre de Victor se suben ocultos o no se suben.
