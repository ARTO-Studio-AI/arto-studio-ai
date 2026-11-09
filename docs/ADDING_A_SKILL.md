# Cómo se sube todo al sitio

Actualizado el 2026-11-05. Prompts, skills y mods de `creative.artostudio.ai`. Ninguno pide tocar código a mano.

| Qué | Cómo | Dónde queda |
|---|---|---|
| Prompts | Desde el panel, sin PR | Base de datos (`prompts`) |
| Skills | **Desde `/admin/skills`, sin PR** (sección 2.1), o `node scripts/add-skill.mjs <carpeta>` en una rama, con PR | Admin: `catalog_items` y el bucket privado `catalogo-paquetes`. Repo: `src/lib/catalogo/skills.json` y `private/skills/` |
| Mods | **Desde `/admin/skills`, sin PR**, o `node scripts/add-mod.mjs <mod.json>` en una rama, con PR | Admin: `catalog_items`. Repo: `src/lib/catalogo/mods.json` |
| Activar y desactivar | **Desde `/admin/skills`**, el selector de cada fila | `catalog_overrides`, manda sobre el estado del repo |

**`/admin/skills`** es el panel de todo el catálogo: ahí se ve qué hay y en qué estado, se cambia el estado de cualquier skill, bundle o mod, se sube uno nuevo y queda el registro de cada cambio (quién, cuándo, de qué estado a cuál). Necesita la migración `0021_catalog_overrides.sql` aplicada; sin ella el sitio sirve el repo tal cual y el panel avisa.

## 1. Prompts

Todo por el panel, en producción y sin despliegue:

- **Uno nuevo**: `/admin/catalogo/nuevo`.
- **Muchos**: `/admin/catalogo/importar` con un CSV. Lo fácil es exportar desde `/admin/catalogo`, editar en Sheets y volver a subir. Sin `id` es alta y entra **no disponible**; con `id` edita solo las celdas con valor.
- **Publicar**: en `/admin/catalogo`, columna «disponible».
- **Deshacer**: `/admin/catalogo/historial`. Cada cambio o importación es un lote que se revierte entero.

## 2. Skills

### 2.1 Por el admin (sin PR, en producción)

En `/admin/skills`, sección «Subir un skill o un mod», con sesión de admin:

1. Elige **Skill**.
2. Sube la `ficha.json` de la carpeta de Drive (o pega su JSON).
3. Sube el paquete `<slug> - SKILL - V<version>.skill`, hasta 4.4 MB.
4. «Subir skill». Si algo falla, no se guarda nada y la lista dice qué arreglar.

Pasa **las mismas revisiones que el script**, porque las dos vías usan el mismo módulo (`src/lib/catalogo/validacion.mjs`): ficha en es y en, sin em dashes ni palabras prohibidas, paquete con la carpeta `<slug>/` adentro, sin `demo/`, `ficha.json` ni `.DS_Store`, y un `<slug>/SKILL.md` con `name` igual al slug y `description`. Dos diferencias a propósito:

- **La categoría tiene que existir.** Por el admin no se crean categorías (`category_copy` se rechaza): la regla de descarga de una categoría nueva es decisión de Victor y entra por PR.
- **Sin demo.** La tarjeta sale con la frase de «tú le dices»; si el skill necesita video, va por el script.

El skill **entra oculto**, siempre. Se revisa y se publica con el selector de su fila. Volver a subir el mismo slug lo actualiza (ficha y paquete, el paquete viejo se borra del bucket) y lo deja **oculto otra vez**, para que nadie publique una versión sin verla.

Si el slug ya existe en el repo, no se sube: **gana el del repo**. Si alguien agrega después al repo un slug que ya se había subido por el admin, el sitio muestra el del repo y `/admin/skills` lo avisa arriba.

La descarga de un skill subido por el admin pasa por la misma ruta (`/api/skill-downloads/<slug>`) y la misma regla de su categoría; solo después responde con un enlace firmado del bucket que vence en 60 segundos.

### 2.2 Por el repo (con PR)

#### La carpeta (la de Drive)

```
skills/<slug>/
  SKILL.md                         frontmatter con name (= slug) y description
  ficha.json                       textos de la página, en es y en
  <slug> - SKILL - V<version>.skill   zip con la carpeta <slug>/ adentro
  demo/demo.mp4                    opcional, hasta 1.5 MB
  demo/poster.jpg                  opcional, hasta 150 KB
```

`ficha.json` tiene la forma de las del Edit Bundle: `slug`, `order`, `category`, `name`, `tagline`, `what`, `you_say`, `needs`, `time` (todos con `es` y `en`), `version` y, si aplica, `placeholder: true` y `chatgpt_note`. Si el skill estrena categoría, la ficha trae también `category_copy` con `name`, `body` y `kicker` en `es` y `en`.

#### El comando

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

**Lo normal es cambiar el estado en `/admin/skills`**: el selector de la fila, «Guardar», y el sitio lo toma en menos de un minuto, sin redeploy (cache de 60 s por instancia). Sirve para cualquier skill, bundle o mod, venga del repo o del admin. El estado del admin manda sobre el de `skills.json` y `mods.json`; la fila dice «en el repo: …» cuando no coinciden. No se puede publicar un skill o bundle sin paquete.

Desactivar es inmediato para la descarga: la ruta revisa el estado efectivo, así que un skill oculto o en «muy pronto» responde 404 aunque el repo diga `published`.

Si la base no responde, el sitio sigue con el último estado que leyó y, si nunca leyó, con el del repo. Lo que se desactivó en el admin podría volver a verse mientras la base esté caída; queda en los logs como `[catalogo]`. Decisión de Victor (5 nov 2026, por ficha, auditoría de Fable del PR 124): se acepta así, porque la regla de acceso de la categoría no cambia y nunca se entrega un paquete de pago a quien no paga.

Por el script (cambia el repo, con PR):

```bash
node scripts/add-skill.mjs "$DRIVE/<slug>" --publish       # sube y publica
node scripts/add-skill.mjs "$DRIVE/<slug>" --coming-soon
node scripts/add-skill.mjs --estado <slug> published       # cambia el estado en skills.json
```

Ojo: si el admin ya fijó un estado para ese slug, ese manda sobre el del repo. Para que vuelva a mandar el repo, pon en el admin el mismo estado que tiene el repo.

Volver a correr el comando sobre un skill que ya existe lo actualiza (ficha, paquete y demo) y **conserva su estado** si no pides otro. Así se sube una versión nueva.

### Quién descarga

Lo decide la categoría (`access` en `skills.json`), no el script ni el admin:

- `edit-bundle-1`: la regla del ARTO Edit Bundle #1 (`src/lib/edit-bundle/access.ts`). Gratis con cuenta hasta el 30 nov de 2026, después solo Pro.
- `pro`: solo Pro y Enterprise. Es la que recibe una categoría nueva.

Abrir una categoría gratis o cambiar una regla es decisión de Victor y va en `docs/DECISIONES.md`.

### El Edit Bundle

`bash scripts/sync-edit-bundle.sh` (desde la MacBook) pasa los 9 skills por el mismo `add-skill.mjs` y copia el `.zip` del bundle. En la Mac Mini también se puede correr `add-skill.mjs` sobre cada carpeta.

## 3. Mods

Solo entra un mod con su **FICHA DE VERIFICACION** en `mods/` de Drive (skill `asai-auditoria-de-mods`).

**Por el admin:** en `/admin/skills`, «Subir un skill o un mod», elige **Mod**, sube el `mod.json` (o pega su JSON) y, si tiene, el zip del mod (hasta 4.4 MB, va al bucket privado). Pasa `validateMod`, la misma revisión que `add-mod.mjs`. Entra oculto; el campo `status` del JSON se ignora (el estado vive en el admin). Si el slug o el código ya están en el repo, no se sube. Se publica o se pone en «muy pronto» con el selector de su fila.

**Por el repo:**

1. Escribe `mod.json` en la carpeta del mod, con la forma de una entrada de `src/lib/catalogo/mods.json`: `code` (MOD02, MOD03…), `slug`, `name`, `releaseDate` (AAAA-MM-DD), `version`, `author`, `license` y `copy.es` / `copy.en` con `tagline`, `what` y `checked` (lo que revisamos).
2. En una rama:

```bash
node scripts/add-mod.mjs "<carpeta del mod>/mod.json"                 # oculto
node scripts/add-mod.mjs "<carpeta del mod>/mod.json" --coming-soon   # sale con su fecha
node scripts/add-mod.mjs --estado <slug> published
```

3. Pruebas, build, commit y PR. `/mods` lee el manifiesto con el estado del admin encima. La descarga de mods todavía no existe: el zip subido por el admin se guarda, pero no sale a nadie hasta que Victor decida la regla.

## 4. Qué revisa Fable antes de publicar

Un skill o mod pasa a `published` o `coming_soon` solo con la revisión de Fable: en el PR si va por el repo, y antes de mover el selector si se subió por el admin (la huella SHA-256 del paquete sale en su fila y en el registro).

- **Textos**: español de México, sin em dashes ni palabras prohibidas (el script ya lo revisa), ARTO como «agencia creativa», sin precios de N7 ni promesas que el skill no cumple.
- **Paquete**: que el `.skill` sea el que se probó (huella SHA-256 en `/admin/skills` igual a la de Drive), que traiga solo la carpeta del skill y que el `SKILL.md` no pida nada peligroso (llaves, red, borrar archivos).
- **Acceso**: que la categoría tenga la regla que decidió Victor. Un cambio de regla o de precio no se publica sin su decisión escrita.
- **Página**: el preview del PR responde 200 en `/es/skills/<slug>` y `/en/skills/<slug>`, y la descarga hace lo que dice la regla (sin sesión, cuenta gratis y Pro).

Los skills que esperan el cierre de Victor se suben ocultos o no se suben.

## 5. Dónde vive cada cosa (migración 0021)

| Tabla o bucket | Qué guarda |
|---|---|
| `catalog_overrides` | Estado elegido en el admin por (tipo, slug). Manda sobre el manifiesto |
| `catalog_items` | Skills y mods subidos por el admin: ficha en JSONB, ruta, peso y huella del paquete |
| `catalog_status_log` | Cada cambio de estado y cada subida: quién, cuándo, de qué estado a cuál |
| bucket `catalogo-paquetes` | Paquetes subidos por el admin. Privado, sin políticas, 4.4 MB y solo zip |

Las tres tablas están cerradas a `anon` y `authenticated` (D16); solo el servidor las lee con service role. El sitio las lee con `src/lib/catalogo/efectivo.ts` y arma el catálogo con `src/lib/catalogo/estado.ts`.
