# DECISIONES.md · lo que ya se decidió, quién lo decidió y qué NO hay que "arreglar"

> **Para qué existe.** Guarda **decisiones de negocio y de criterio tomadas por personas** que un
> agente no puede deducir leyendo el código y que, si las desconoce, va a "corregir". La columna
> que más importa es **«qué NO hacer»**.

**Cómo se lee:** busca la fila antes de cambiar un comportamiento que te parezca mal. Si la fila
explica la divergencia, ya se analizó y hay una persona detrás.

**Cómo se mantiene:** cuando Victor o quien corresponda decida algo que el código va a obedecer,
**se agrega la fila en el mismo PR**. Una decisión que solo vive en el chat se pierde en la
siguiente sesión.

---

## 1 · Sistema de trabajo (relaunch del 2026-09-10)

### D1 · Calco completo del sistema de Nómina

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 |
| **Qué se decidió** | ASAI adopta el mismo sistema de trabajo que ARTO Nómina: `CLAUDE.md` con §0, `AGENTS.md`, `docs/DECISIONES.md`, reporte de estatus en 5 tablas, nota fechada en Notion, CI como candado |
| **Por qué** | El sistema ya está probado en Nómina y no tiene sentido inventar otro. Reduce el costo de que una sesión cambie de proyecto |
| **Qué NO hacer** | No inventar formatos nuevos de reporte ni de docs. Si algo falta aquí, mirar cómo lo resolvió Nómina antes de diseñarlo |
| **Dónde** | `CLAUDE.md` §0, `AGENTS.md`, este archivo |

### D2 · «Por ahora puro main», sin staging

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 |
| **Qué se decidió** | No hay rama ni ambiente de staging. El flujo es rama → PR a `main` → producción. El preview de Vercel del PR es el único ambiente intermedio |
| **Por qué** | Un solo operador, un producto chico; staging duplicaría env vars, base y trabajo sin que nadie lo use. Se revisa cuando haya equipo |
| **Qué NO hacer** | No crear rama `staging` ni un segundo proyecto de Vercel. No mergear sin haber verificado el preview del PR |
| **Dónde** | `CLAUDE.md` «Ramas y PRs», `.github/workflows/ci.yml` |

### D3 · La Ronda corre en la MacBook por ssh; todo vive en el Mini

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 |
| **Qué se decidió** | Las sesiones de Claude Code se lanzan desde la MacBook, pero el repo, las deps, el `gh` y el `vercel` linkeado viven en el Mac Mini (`~/Projects/arto-studio-ai`). Se trabaja por `ssh mac-mini` y worktrees |
| **Por qué** | El Mini está encendido 24/7 y tiene los secretos; la MacBook duerme y se cierra |
| **Qué NO hacer** | No clonar el repo en la MacBook. No correr `nohup` ni servicios ahí. No editar el checkout principal si otra sesión lo tiene en una rama |
| **Dónde** | `~/.claude/CLAUDE.md` global de Victor, `CLAUDE.md` «Ramas y PRs» |

### D4 · Acento de marca

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 |
| **Qué se decidió** | Si existe un color de acento oficial de ARTO en Brand Assets de Notion, se usa ese. Si no existe, el acento es `#ff4d00` |
| **Por qué** | Evitar que cada sesión invente un naranja distinto |
| **Qué NO hacer** | No introducir un acento nuevo «porque queda mejor». Si el oficial aparece después, se migra en un solo PR |
| **Dónde** | Brand Assets en Notion (`1e5f185925c481079cadef991cb9ca97`), `src/app/globals.css` |

### D5 · Quién crea cada variable de entorno

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 |
| **Qué se decidió** | Code crea `CRON_SECRET` en Vercel (2026-09-11). Victor crea la cuenta de PostHog (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`) y define `EMAIL_FROM` con el dominio verificado en Resend |
| **Por qué** | Las cuentas las crea Victor (regla dura del stack). Un secreto aleatorio como `CRON_SECRET` lo puede generar Code sin abrir ninguna cuenta |
| **Qué NO hacer** | Code no crea cuentas ni hace OAuth a nombre de Victor. No inventar un `EMAIL_FROM` con un dominio no verificado |
| **Dónde** | `.env.example`, Vercel env de producción |

### D6 · Dominio canónico `creative.artostudio.ai`

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 |
| **Qué se decidió** | El dominio de producción es `https://creative.artostudio.ai`. `arto-studio-ai.vercel.app` es el alias técnico de Vercel, no el que se comunica |
| **Por qué** | Consistencia de marca y SEO: un solo host canónico |
| **Qué NO hacer** | No poner `arto-studio-ai.vercel.app` en correos, OG, sitemap ni copys nuevos. Pendiente: `src/app/api/cron/digest/route.ts` todavía lo usa en el HTML del digest |
| **Dónde** | `NEXT_PUBLIC_SITE_URL`, `src/app/robots.ts` |

### D7 · Pricing: investigar antes de decidir

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 |
| **Qué se decidió** | No se cambia el pricing hasta tener la ficha comparativa. La ficha se entregó; la decisión sigue **pendiente** |
| **Por qué** | Cambiar precios con clientes que ya pagan es una decisión de negocio, no técnica |
| **Qué NO hacer** | No tocar `STRIPE_PRICE_ID_*`, los precios en `/pricing` ni los tiers en código hasta que Victor decida |
| **Dónde** | Ficha en Drive; Notion hub «ARTO Studio AI Web» |

### D8 · Testimonios y secuencia de emails ASAP, sin inventar testimonios

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 |
| **Qué se decidió** | Se prioriza una sección de testimonios y una secuencia de emails de onboarding. Los testimonios se piden a clientes reales |
| **Por qué** | Prueba social y activación son lo que más falta en el funnel |
| **Qué NO hacer** | **No inventar testimonios ni nombres.** Placeholder visible o nada, hasta que haya uno real. Cambios de email pasan por Fable (está fuera del auto-fix) |
| **Dónde** | Notion hub «ARTO Studio AI Web» |

## 2 · Seguridad

### Hotfix RLS aplicado en producción

| | |
|---|---|
| **Quién** | Victor dio el go el 2026-09-10; ejecutó Code; verificó Fable |
| **Qué se decidió** | Activar RLS sin políticas en las 17 tablas del schema `public` que no lo tenían |
| **Por qué** | Con la anon key pública, `GET /rest/v1/clients` devolvía las 8 filas con email, tier y hash de API key. Todo el código usa service role o `DATABASE_URL` (bypassrls), así que cerrar la anon key no rompe nada |
| **Qué NO hacer** | No desactivar RLS «para que funcione algo». Si una ruta necesita leer con la anon key, se escribe una política explícita en una migración. Pendiente aparte: revocar los grants a `anon` (lo hace Code en otro PR) |
| **Dónde** | `supabase/migrations/0005_rls_hotfix_2026-09-10.sql` |

## 3 · Modelo

### Modelo `claude-sonnet-5` (decisión B)

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 (opción B de las que se le presentaron) |
| **Qué se decidió** | `ANTHROPIC_MODEL=claude-sonnet-5` en producción y como default en código. Precio de referencia $2 input / $10 output por millón de tokens |
| **Por qué** | Mejor calidad a menor costo que `claude-sonnet-4-5`; los defaults viejos ya apuntaban a modelos con fecha |
| **Qué NO hacer** | **No pasar `temperature`** en ninguna llamada: Sonnet 5 lo rechaza con 400. No volver a poner defaults con fecha (`claude-sonnet-4-20250514`) |
| **Dónde** | `src/lib/skills/engine.ts`, `src/app/api/admin/content/generate/route.ts`, `src/app/api/admin/outreach/drafts/route.ts` |
