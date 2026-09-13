<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->

# ARTO Studio AI · cómo trabajamos

> Última actualización: 2026-09-11 (Fase 0 del Sprint 1, PR `fix/fase-0-candados`).
>
> **Producción: `https://creative.artostudio.ai`** (dominio canónico, decisión D6). Cada merge a
> `main` se despliega solo en Vercel. Hay clientes con API key y cobro por Stripe: un error aquí
> es un cliente que paga y no recibe, o un dato que se filtra.

## 0. Cómo trabajamos: léelo antes de tocar nada

**Este producto está en producción y cobra.** La prudencia manda sobre la velocidad.

### Antes de "corregir" cualquier cosa, lee `docs/DECISIONES.md`

Guarda las **decisiones que tomaron personas** (casi todas Victor) y que no se deducen leyendo el
código. Si vas a cambiar un comportamiento que te parece equivocado, **busca su fila primero**. Si
está ahí, ya se analizó. Toda decisión que el código vaya a obedecer se escribe ahí **en el mismo
PR**; una decisión que solo vive en el chat se pierde en la siguiente sesión.

### Dónde está la verdad

| Qué | Dónde |
|---|---|
| Estado vivo del trabajo (tareas, hallazgos, decisiones abiertas) | Hub de Notion **«ARTO Studio AI Web»**. Cowork y Code comparten tablero: releer antes de republicar |
| Plan del sprint | Drive, carpeta del proyecto (`260910 ASAI plan de trabajo sistema y sprint 1.md`) |
| Decisiones cerradas que el código obedece | `docs/DECISIONES.md` en este repo |
| Esquema de la base | `supabase/schema.sql` (volcado de producción) y `supabase/migrations/` |
| Histórico de abril 2026 | `docs/ROADMAP.md` (solo referencia, no es el estado actual) |

### Ramas y PRs

```
rama de trabajo ──PR──▶ main ──▶ producción (creative.artostudio.ai)
```

- **No hay staging.** Decisión D2 de Victor del 2026-09-10: «por ahora puro main». El preview de
  Vercel del PR es el único ambiente intermedio, y **se verifica antes de mergear**: curl a las
  rutas que toca el cambio con la URL del preview, y el flujo real en el navegador si es UI.
- Ramas: `feat/<tema>`, `fix/<tema>`, `chore/<tema>`. Commits `feat:` / `fix:` / `chore:` en
  español, sin em dashes, terminados en `Co-Authored-By`.
- **Desde el 11-sep hay CI** (`.github/workflows/ci.yml`): `lint`, `typecheck` y `build` en cada
  PR y en cada push a `main`. Nada se mergea en rojo. Cinco reglas de lint están en `warn` por
  deuda declarada en `eslint.config.mjs`; no agregues más.
- **Los agentes que no leen este archivo tienen el suyo: `AGENTS.md`.** Si cambias una regla de
  flujo aquí, cámbiala ahí.
- **No toques el PR #56 (`feat/module-4b-scraper`) ni la carpeta `infra/`.** Son de otra sesión.
  Si necesitas trabajar mientras esa rama está en el checkout de `~/Projects/arto-studio-ai`, abre
  tu propio worktree: `git worktree add ~/Projects/<nombre> -b <rama> origin/main`.
- Antes de abrir un PR, mira si ya existe uno igual: `gh pr list`.

### Lo que queda fuera del auto-fix

Un agente **no corrige por su cuenta** nada de esto. Analiza, propone en el PR y espera el go:

| Área | Por qué |
|---|---|
| **Stripe** (checkout, webhook, precios, tiers) | Es dinero de clientes reales |
| **Auth** (`src/lib/auth.ts`, `src/lib/supabase/*`, callbacks) | Un error abre o cierra el producto a todos |
| **DDL** (cualquier `alter`/`create`/`drop` en producción) | Irreversible sin backup |
| **Email** (remitentes, plantillas, listas) | Llega a gente de verdad y no se puede des-mandar |

**Fable revisa obligatoriamente todo lo que toque dinero o seguridad** antes del merge, aunque el
CI esté en verde.

### Base de datos

- **DDL solo aditivo**: agregar tabla, columna o índice. Nunca `drop`, nunca renombrar, nunca
  cambiar tipos sin migración de datos acordada.
- **Cada migración termina con `notify pgrst, 'reload schema';`** Sin eso PostgREST sigue con el
  esquema viejo y devuelve `Could not find the table ... in the schema cache` durante minutos.
- Las migraciones van numeradas en `supabase/migrations/` y **se registran aunque ya se hayan
  aplicado a mano** (así nació `0005_rls_hotfix_2026-09-10.sql`).
- **RLS está activado en las 17 tablas** desde el 2026-09-10. Todo el código que lee esas tablas
  usa el service role o `DATABASE_URL`; la anon key no lee nada y así debe seguir.

### Nada se cierra sin prueba

`npm run lint` · `npm run typecheck` · `npm run build` en verde → push → CI verde → curl al preview
→ flujo real. **No reportes «listo» sin haber visto la respuesta correcta.** Si no se puede
observar, se dice explícitamente.

### Pruebas (`npm test`)

- `npm test` corre vitest. En CI y en dev normal **no toca ninguna base**: `tests/setup.ts` carga
  `.env.local` y luego **borra `DATABASE_URL`** del entorno de las pruebas. Las unitarias que usan
  postgres lo mockean y ponen su propia URL falsa.
- Las pruebas de integración (hoy `tests/prompt-limit.test.ts`, que escribe y borra filas en
  `prompt_opens`) **solo corren con `ASAI_INTEGRATION_DB_URL` explícita en la línea de comandos**
  (H-45, 2026-09-13). Antes bastaba un `.env.local` con `DATABASE_URL` de producción para escribir
  filas reales:

  ```bash
  ASAI_INTEGRATION_DB_URL='postgres://usuario:clave@host:5432/base' npm test
  ```

- Ponerla en `.env.local` **no la activa**: se lee antes de cargar ese archivo. Úsala de
  preferencia contra una base desechable; contra producción solo con permiso de Victor y
  sabiendo que la prueba escribe y luego borra sujetos `test:<fecha>:<random>`.
- Una prueba nueva que necesite base real se salta con
  `describe.skipIf(!process.env.ASAI_INTEGRATION_DB_URL)`. Nunca la condiciones a `DATABASE_URL`.

### Nota fechada en el registro

Cada avance deja **nota con fecha en el cuerpo del task o hallazgo de Notion**: qué se descubrió,
qué se decidió y por qué, qué se intentó y no funcionó, y las preguntas abiertas con quién las
planteó. Si al terminar la sesión la única forma de saber qué pasó es leer el chat, faltó
documentar.

### Cómo se reporta el estatus en el chat

Al terminar cada tarea, cerrar con estas cinco tablas (acordado con Victor el 2026-07-30 en Nómina
y calcado aquí por D1):

| Tabla | Columnas |
|---|---|
| 1 · Lo que necesito de ti | Qué · Tiempo · Bloquea · Estado |
| 2 · PRs abiertos | PR · Qué · Autor · CI · Espera a · Estado |
| 3 · Qué se hizo en esta tarea | Qué · Dónde · Estado |
| 4 · Decisiones abiertas (si hay) | Decisión · Opciones · Bloquea · Nota |
| 5 · Producción | Concepto · Estado |

Estados: ✅ / ❌ verificado con el comando que lo comprueba · ⏳ esperando a alguien externo · ⬜
pendiente · 🔴 bloqueado y por qué · 🟠 requiere atención · 🟢 listo para que alguien lo tome.
Tablas, no prosa. Cada fila accionable dice quién y cuánto tiempo. Links clicables siempre.

### Variables de entorno y Vercel

- La lista completa, con una línea por variable, está en **`.env.example`**. Los valores viven en
  Vercel; **nunca en el repo ni en el chat**. Para leerlas: `vercel env pull /tmp/e.env
  --environment=production --yes`, usar, y `rm -f /tmp/e.env`.
- **Sensibles** (no se pueden volver a leer desde el CLI una vez creadas): `SUPABASE_SERVICE_ROLE_KEY`,
  `DATABASE_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `RESEND_API_KEY`, `ADMIN_API_KEY`, `ARTO_API_KEY_SALT`, `CRON_SECRET`, `BUFFER_TOKEN`,
  `ARTO_IMAGE_SHARED_SECRET`.
- **Quirk del Vercel CLI 51:** `vercel env add` en `production` marca la variable como *sensitive*
  por defecto. Usa `--no-sensitive` **solo** para valores que no son secreto (`NEXT_PUBLIC_*`,
  `EMAIL_FROM`, `ADMIN_EMAILS`, `ANTHROPIC_MODEL`). Para cambiar una: `vercel env rm X production
  && vercel env add X production --value "..." --yes && vercel redeploy <url-prod> --target production`.
- `vercel redeploy` no acepta `--yes`; `vercel logs` solo funciona en modo follow.
- Modelo en producción: `ANTHROPIC_MODEL=claude-sonnet-5` desde el 2026-09-10. Sonnet 5 **rechaza
  el parámetro `temperature`** con 400; no lo vuelvas a meter en ninguna llamada.

### Idioma y palabras

Español de México en todo texto (tú/tienes/aquí, nunca vos/che). Palabras prohibidas: leverage,
empower, revolutionize, seamless, robust, holistic, cutting-edge, ecosystem, disruptive, synergy,
scalable, optimize, elevate, delve, foster, paradigm shift, game-changer, actionable insights.
Sin em dashes en commits, PRs ni docs.
