# ARTO Studio AI · ROADMAP

> **Qué es este archivo.** La foto técnica del repo para agentes que entran a trabajar. No es el
> tablero: el estado vivo y la operación están en Notion, hub **«ASAI Studio»** (Tasks, Hallazgos,
> Releases, Decisiones), y el plan del sprint está en Drive
> (`260910 ASAI plan de trabajo sistema y sprint 1.md`). Si esta foto y Notion no coinciden, manda
> Notion. Las decisiones que el código obedece están en `docs/DECISIONES.md`.
>
> Actualizado: 2026-09-13 10:13 (hora de Madrid), con `origin/main` en `953b8de` (PR #66).

---

## 1 · Qué es el producto hoy

Producción en **`https://creative.artostudio.ai`** (D6). `arto-studio-ai.vercel.app` y
`library.artostudio.ai` redirigen con 301 al dominio canónico (PR #60).

| Superficie | Qué hace hoy | Dónde |
|---|---|---|
| Biblioteca de prompts | **3,001 prompts** en EN y ES («3,000+» en marketing, 3,001 donde se cobra). Búsqueda, colecciones y favoritos | `src/app/[locale]/(marketing)/prompts`, `/api/search` |
| Plan Free | $0. **3 prompts abiertos al día** (día natural UTC). Buscar y listar es libre; reabrir el mismo prompt el mismo día no cuenta. Anónimos por cookie `asai_vid`; al iniciar sesión las aperturas del día pasan al usuario | `src/lib/prompt-limit.ts`, migración 0009 |
| Plan Pro | **$9 USD al mes**: los 3,001 prompts sin tope. Checkout interno en `/api/stripe/checkout/pro` | `pricing/page.tsx`, `ProCheckoutButton.tsx` |
| Plan Studio | **$29 USD, «Próximamente»**. Sin botón de compra ni captura: solo existen `STRIPE_PRICE_ID_PRO` y `STRIPE_PRICE_ID_STARTER` | `pricing/page.tsx` |
| Agentes | Sin precio | `pricing/page.tsx`, `/[locale]/agents` |
| Brand Roast | Público y sin login, 10 llamadas por hora por IP (tabla `rate_limits`) | `src/app/roast`, `/api/roast` |
| Brand Positioning | Skill con **API key de cliente** y **trial**: el consumo del trial es atómico y se devuelve si el skill cae a fallback o falla (H-39, H-43). Dashboard interno en `/studio` | `/api/skills/[slug]`, `src/lib/clients/*`, `src/lib/skills/*` |
| /learn | Guías de prompts por vertical, EN y ES | `src/app/[locale]/(marketing)/learn` |
| /admin | Clients, traces, admins, outreach, **Content Factory** (`/admin/content`) y **engine** (`/admin/engine`: runs, signals, scraping, gaps, social, attribution, config) | `src/app/admin` |

**Fuente de los precios.** El comentario de `pricing/page.tsx` y el PR #62 citan la decisión D7 de
Victor del 11 sep. La fila D7 de `docs/DECISIONES.md` todavía dice «pendiente»: ponerla al día es
trabajo aparte, no se hizo en este PR.

---

## 2 · Qué entró en el Sprint 1 (10 al 13 sep 2026)

Horas de merge tomadas de `gh pr list` y pasadas a hora de Madrid.

| PR | Fase | Qué | Estado |
|---|---|---|---|
| #57 | Fase 0 · candados | CI (`lint`, `typecheck`, `build`), `.env.example` completo, código muerto fuera, modelo `claude-sonnet-5` sin `temperature`, cron del digest fail-closed, migración 0005, `supabase/schema.sql`, `CLAUDE.md`, `AGENTS.md` y `DECISIONES.md` | ✅ mergeado 11 sep 08:05 |
| #58 | Fase 0 · restos | Migración 0006 y default `claude-sonnet-5` en `/api/search` | ✅ mergeado 11 sep 08:24 |
| #60 | Fase 3B · SEO | `<html lang>` dinámico, hreflang, metadata por locale, canonical, OG global, sitemap y robots con `siteUrl()`, 301 al dominio canónico | ✅ mergeado 11 sep 09:22 |
| #61 | Fase 1B · seguridad y trazas | Trazas con `await` (H-34), trial atómico, salt fail-closed, rate limit persistente en `rate_limits`, email del roast a la tabla correcta (H-28), defensa contra prompt injection, vitest en CI. Sin migración | ✅ mergeado 11 sep 09:40 |
| #62 | Fase 2 parcial + Fase 4 | Contador free de 3 prompts al día (0009), precios de D7, copy sin trial ni waitlist, `/upgrade` con 301 a `/pricing`, re-skin base (tokens, `src/components/ui`, zinc, acento `#ff4d00`, imágenes WebP) | ✅ mergeado 11 sep 10:00 |
| #63 | Hallazgo H-42 | `Button` renderiza `<a>` sin prefetch para rutas `/api/`: el prefetch podía crear sesiones de checkout sin clic | ✅ mergeado 11 sep 10:10 |
| #64 | Hallazgos H-38, H-39, H-40 | Dominio en OG de prompts (ya estaba resuelto), devolución de la llamada del trial en fallback, purga diaria de `rate_limits` (`/api/cron/purge`, 04:00 UTC) | ✅ mergeado 13 sep 09:33 |
| #65 | Hallazgo H-43 | Devolución de la llamada del trial también en 503, 404 y 500, una sola vez por petición | ✅ mergeado 13 sep 09:50 |
| #66 | Fase 1C · medición y captación | PostHog, Vercel Analytics y Speed Insights, eventos tipados, cookie `asai_utm` de primer toque, empresa y rol opcionales en el login, audiencia de Resend sin envíos, `docs/METRICS.md`, D9, migración 0010, fuentes del sistema | ✅ mergeado 13 sep 09:58 |

### Migraciones 0005 a 0011

Todas son aditivas y terminan con `notify pgrst, 'reload schema';`.

| Migración | Qué hace | Producción | En `main` |
|---|---|---|---|
| `0005_rls_hotfix_2026-09-10.sql` | Activa RLS sin políticas en las 17 tablas de `public` que no lo tenían (la anon key leía `clients`) | Aplicada 10 sep | ✅ #57 |
| `0006_revoke_anon_2026-09-11.sql` | Quita los grants de `anon` y `authenticated` en esas 17 tablas | Aplicada 11 sep 08:30 | ✅ #58 |
| `0007_stripe_events_2026-09-11.sql` | Tabla `stripe_events` para idempotencia del webhook, RLS sin políticas y revoke | Aplicada 11 sep | ⏳ solo en la rama de #59 |
| `0008` | **No existe.** Estaba reservada para la Fase 1B; #61 no la necesitó porque `bump_rate_limit` ya cubría las ventanas de una hora | · | · |
| `0009_prompt_opens.sql` | Tabla `prompt_opens` del contador free, PK `(subject, prompt_id, day)`, RLS sin políticas y revoke | Aplicada 11 sep | ✅ #62 |
| `0010_profile_capture.sql` | Diez columnas nuevas en `profiles` (empresa, rol, origen, `utm_*`, referrer, locale) y `handle_new_user()` que las copia | Aplicada 13 sep | ✅ #66 |
| `0011_profile_capture_limits.sql` | `handle_new_user()` con `left(..., 200)` en los campos de captación, `left(..., 10)` en el locale y `search_path` fijo (H-49) | Aplicada 13 sep | ⏳ solo en la rama de #67 |

`supabase/schema.sql` es el volcado del 11 sep (#57) y todavía no refleja 0007, 0009, 0010 ni 0011.

---

## 3 · Abierto

| Qué | Estado | Espera a |
|---|---|---|
| **PR #59** · Fase 1A · Stripe: el webhook activa Pro, sincroniza suscripciones (`created`, `updated`, `deleted`, `payment_failed`) y es idempotente | Abierto. 0007 ya está en producción | Firma de Victor (toca dinero) |
| **PR #67** · H-46 redirección abierta en `/auth/callback`, H-47 grabación de sesiones de PostHog apagada, H-49 límites y `search_path` (0011) | Abierto, CI verde. 0011 ya está en producción | Revisión de Fable (auth y DDL) y merge |
| **PR #56** · Module 4b · scraper nocturno de prospectos (`infra/arto-scraper`, migración 0004 ya aplicada, launchd sin cargar) | Abierto desde junio | Decisión. No tocar el PR ni `infra/` |
| Fase 3A · Roast | Pendiente: scorecard con URL pública, `/es/roast`, gate de email por token | Plan del sprint |
| Fase 5 | Pendiente: `/developers` (el footer ya trae la nota «Vuelve cuando exista /developers»), secuencia de nurturing detrás de flag, landings SEO en español | Plan del sprint |
| Resto de Fase 2 | Pendiente: logo en SVG (en `public/brand` solo hay `arto-logo-black.png`) y marquee | Plan del sprint |
| Aviso de cookies | Pendiente. Condiciona encender la grabación de sesiones (H-47, H-48) | Decisión de Victor |
| Variables | `RESEND_AUDIENCE_ID` no existe en ningún ambiente (el helper avisa y sigue). Preview no tiene las variables de PostHog, así que los previews no miden | Victor |
| Eventos sin medir | `checkout_completed` (va con #59) y `skill_called` (ronda de skills). Ver `docs/METRICS.md` §2 | #59 y ronda de skills |

---

## 4 · Arquitectura en corto

| Pieza | Qué |
|---|---|
| App | Next.js 16.2.1 en Vercel. Cada merge a `main` despliega a producción; no hay staging (D2). CI en GitHub Actions: `lint`, `typecheck`, `build`, `test` |
| Base y auth | Supabase Postgres. RLS activo en todas las tablas públicas; el código lee con service role o `DATABASE_URL` y la anon key no lee nada. Login con magic link y Google; `profiles` se llena con el trigger `handle_new_user()` |
| Modelo | Anthropic `claude-sonnet-5` por `ANTHROPIC_MODEL`. No acepta `temperature` |
| Pagos | Stripe: `STRIPE_PRICE_ID_PRO` y `STRIPE_PRICE_ID_STARTER` (legacy de clientes con API key) |
| Email | Resend: transaccional y audiencia de contactos (`src/lib/resend-audience.ts`, sin envíos) |
| Medición | PostHog US Cloud (proyecto 604228), Vercel Analytics y Speed Insights. Eventos en `src/lib/analytics.ts` |
| Crons de Vercel | `/api/cron/digest` y `/api/cron/purge`, ambos con Bearer `CRON_SECRET` |
| Mac Mini | Engine (`ARTO-Studio-AI/asai-engine`) e image-service de Higgsfield (`ARTO-Studio-AI/arto-image-service`) |

---

## 5 · Cómo trabajar

- Las reglas están en **`CLAUDE.md`** (Claude Code) y **`AGENTS.md`** (otros agentes). Léelas antes de
  tocar nada, y `docs/DECISIONES.md` antes de «corregir» un comportamiento.
- **Code, en Opus 5, hace el trabajo**: rama propia o worktree, PR a `main`, CI verde, preview verificado.
- **Fable audita antes del merge** todo lo que toca dinero, auth, DDL o email, aunque el CI esté verde.
- Cada avance deja nota fechada en el task o hallazgo de Notion.

---

## Histórico (abril 2026)

> Foto de abril de 2026, conservada como referencia. **No describe el estado actual**: la base ya no
> es Neon y los planes cambiaron. Los em dashes del original se
> cambiaron por guiones y los encabezados bajaron de nivel; el contenido es el mismo.

### ARTO Studio AI - Roadmap & session handoff

This document is the source of truth for what's done, what's in progress, and what comes next. Any new Claude session (local, Dispatch, Mac Mini) should read this first to get oriented without needing the previous conversation.

Last updated: 2026-04-19

---

#### The strategic frame

ARTO Studio AI is not just an app. It is a software-native brand strategy firm operated by agents. Each skill in the skills library is an "employee." Brand Roast is the public funnel; every other skill is gated behind a client API key and monetized. Every call writes a trace to `skill_traces` - the knowledge base gets smarter over time because traces feed quarterly reviews of `/knowledge/`.

Read these three memory files for full strategic context:
- `memory/project_agentic_company_vision.md` - ARTO as an agentic company (north star)
- `memory/project_agent_skills_strategy.md` - agent skills as distribution strategy
- `memory/project_continual_learning.md` - 3-layer learning architecture

Authoring docs live in-repo:
- `docs/ADDING_A_SKILL.md` - 4-step playbook for adding a new skill
- `docs/KNOWLEDGE_INTAKE.md` - 6-question methodology for building `/knowledge/*.md`

---

#### Current state (2026-04-19)

##### Infrastructure ✅
- Next.js 16.2.1 app deployed to Vercel: https://arto-studio-ai.vercel.app
- Neon Postgres with live tables: `clients`, `skill_traces`, `roast_traces`, `waitlist`
- Env vars in Vercel prod: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ADMIN_API_KEY`, `DATABASE_URL`, `ARTO_API_KEY_SALT`
- Skills engine stable (`src/lib/skills/engine.ts`, `registry.ts`, `types.ts`) - do NOT modify when adding skills
- Client auth + gating (`src/lib/clients/store.ts`, `auth.ts`)
- Routes: `/api/skills`, `/api/skills/[slug]`, `/api/roast`, `/api/admin/clients`, `/api/traces`

##### Registered skills
| Slug | Public | Knowledge keys | Status |
|---|---|---|---|
| `brand-roast` | ✅ yes | strategy, narrative, rubric, trends | Live. Funnel/marketing. |
| `brand-positioning` | ❌ no (gated) | positioning, strategy, rubric, trends | Live. First gated skill. |

##### Knowledge base (`/knowledge/`)
| Slice key | File | Owner |
|---|---|---|
| `strategy` | `knowledge/methodology/strategy.md` | victor |
| `narrative` | `knowledge/methodology/narrative.md` | victor |
| `positioning` | `knowledge/methodology/positioning.md` | victor |
| `rubric` | `knowledge/quality/rubric.md` | victor |
| `trends` | `knowledge/trends/current.md` | victor |

All slices have frontmatter with `last_reviewed` + `owner`. Canonical source of truth for these docs lives outside the repo at `Shared drives/CLAUDE DRIVE/CC Project Folders/CC ARTO ARTO Studio AI Project/knowledge/` - the repo is a consumer. Updates flow canonical → repo (never the reverse).

---

#### Session roadmap (7 sessions)

| # | Session | Status | Scope |
|---|---|---|---|
| 1 | Knowledge intake (Brand Positioning) | ✅ done | `positioning.md` authored and registered in `KNOWLEDGE_MAP`. Commit `25332cf`. |
| 2 | First gated skill (`brand-positioning`) | ✅ done | 3 files, 581 lines, gating tested end-to-end (401/401/403/200), trace confirmed in DB. Commit `914c15d`. |
| - | Bug fix: Brand Roast ErrorBoundary | ✅ done | Prompt + schema hardened, maxTokens 4000→4500, `normalizeRoastResult` helper, defense-in-depth render. Commit `e3c46ca`. |
| 3 | **Admin UI for clients + traces** | ⏳ next | Extend `/admin` with tabs to create/revoke clients and view `skill_traces` without curl. Zero engine changes. |
| 4 | Packaging as Claude Agent Skills | ✅ done | Two Agent Skills (`arto-brand-roast`, `arto-brand-positioning`) shipped in `.claude/skills/`, with `docs/SKILLS.md` install guide and `.claude-plugin/plugin.json` manifest. Methodology stays server-side (paid API); skills are API wrappers. |
| 5 | Internal ARTO interface | ✅ done | `/studio` dashboard: login with API key, dynamic tabs per allowed skill, hardcoded form + structured output per skill, sidebar with recent calls (via new `/api/studio/my-traces` endpoint). Commit `542b704`. |
| 6 | Trial flow + Stripe | ✅ done | Self-service trial signup, Resend welcome email, 5-call trial limit, Stripe checkout, webhook upgrade to `starter` tier. Commits `651e81b`, `33cbc30`, plus raw-fetch fix. |
| 7 | Brand Roast polish | 🟡 partial | Critical crash fixed. Remaining: Story OG, iOS native share, Spanish translation, industry variants, more download options. |

##### Recommended order

~~3 (admin UI)~~ ✅ → ~~6 (Stripe)~~ ✅ → ~~4 (packaging)~~ ✅ → ~~5 (internal UI)~~ ✅ → 7 (roast polish finalization).

Rationale: sessions 3 and 6 are commercial (reduce operational friction, enable monetization). Session 4 is viral distribution. Session 5 is internal productivity. Session 7 is marketing polish - important but not blocking anything.

---

#### Loose quick wins (not full sessions)

| # | Task | Size | Notes |
|---|---|---|---|
| QW1 | Add `"positioning"` to `brand-roast.ts` `knowledgeKeys` | 1 line | Anchors Brand Roast in real ARTO positioning methodology instead of "sounds good in general." Risk: tone may become too technical for casual funnel visitors. A/B test 2 roasts before committing. |
| QW2 | Clean up test clients | 5 min | Two clients created during Session 2 testing live in Neon: Full Access (`9d2a5703...`) and Limited (`7c3660f4...`). Revoke or re-label if they're not going to be reused. |
| QW3 | Commit `.env.local` template | 5 min | Create `.env.example` with the required vars (no secrets) so anyone cloning the repo knows what to fill in. |
| QW4 | Add `vercel.json` `maxDuration` for skills route | 2 min | Current default is 30s, but Brand Roast + Brand Positioning can take 15-25s with web_fetch. A 60s cap is safer. |

---

#### How to add a new skill (cheat sheet)

Read `docs/ADDING_A_SKILL.md` for the full version. The ~50-line summary:

1. Create `src/lib/skills/<slug>-types.ts` - `Request` and `Result` interfaces.
2. Create `src/lib/skills/<slug>-prompt.ts` - `buildSystemPrompt`, `outputTool: Tool`, `generateDeterministicFallback()`.
3. Create `src/lib/skills/<slug>.ts` - `validate<Slug>Input`, the `SkillDefinition` object, `registerSkill(...)` at the bottom.
4. Add `import "./<slug>";` to `src/lib/skills/index.ts`.
5. If it needs a new knowledge slice, add an entry to `KNOWLEDGE_MAP` in `src/lib/knowledge.ts` and drop the .md in `knowledge/methodology/<slug>.md` with the standard frontmatter.

No changes needed to `engine.ts`, `registry.ts`, `types.ts`, `clients/*`, or routes - the engine and routing are generic over any `SkillDefinition`.

---

#### Verification commands

```bash
# Build + type-check
npm run build

# Registry smoke test (confirms skill loaded correctly)
npx tsx -e "import './src/lib/skills'; import { listSkills } from './src/lib/skills/registry'; console.log(listSkills().map(s => s.slug));"

# Create a gated client
curl -X POST http://localhost:3000/api/admin/clients \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"X","email":"x@y.com","tier":"trial","allowed_skills":["brand-positioning"]}'

# Call a gated skill
curl -X POST http://localhost:3000/api/skills/brand-positioning \
  -H "x-arto-api-key: arto_live_..." \
  -H "Content-Type: application/json" \
  -d '{"brandName":"X","industry":"Y","targetAudience":"Z","competitors":["A","B"]}'
```

---

#### Open questions / to revisit

- **Brand Roast language**: UI is English, but ~60% of inbound traffic is Spanish-speaking. Session 7 should decide: detect via browser locale, manual toggle, or skip.
- **Rate limit tuning**: currently 10/hour per IP on public Brand Roast and per-client limits on gated skills. No data yet on whether these are right.
- **Pricing model**: tiers exist in code (`trial`, `agency`, `enterprise`, `internal`) but the economic meaning of each tier hasn't been set. Session 6 pins this down.
- **Knowledge sync**: canonical → repo is manual today. Worth a small script to diff and copy when the canonical updates, to avoid drift.

---

#### Working model (2026-04-19)

The Mac Mini (`rogelio@100.120.200.21`, Tailscale) is the canonical working environment. The MacBook is a thin client for editing and running Claude Code sessions. The MacBook no longer holds a working clone - it was archived to `~/Archive/arto-studio-ai-local-backup-2026-04-19/`.

##### What lives on the Mac Mini
- Repo: `/Users/rogelio/Projects/arto-studio-ai` - canonical source of truth
- `.env.local` (synced once from MacBook)
- `~/.logs/arto-dev.{out,err}.log` - dev server logs
- `~/Library/LaunchAgents/com.arto.studio.dev.plist` - launchd service keeping `npm run dev` up 24/7, auto-restart on crash
- `~/.vscode-server/` - installed server for Remote-SSH (installs itself the first time VS Code connects)
- `~/.claude/projects/-Users-rogelio-Projects-arto-studio-ai/memory/` - MEMORY.md + 3 strategy notes

##### Always-on endpoints (via Tailscale from anywhere)
- Dev server: `http://100.120.200.21:3000`
- Quick smoke test: `curl http://100.120.200.21:3000/api/skills`

##### Starting a new Claude Code session (recommended flow)
```bash
ssh arto-mini           # SSH alias in ~/.ssh/config
cd ~/Projects/arto-studio-ai
claude
# First prompt:
# "Lee docs/ROADMAP.md y dime qué sigue"
```

##### Editing from MacBook via VS Code
```bash
code --remote ssh-remote+arto-mini /Users/rogelio/Projects/arto-studio-ai
```
Files live on Mac Mini. VS Code runs on MacBook. Zero sync. Save in VS Code → change is immediate on Mac Mini → dev server hot-reloads.

##### Managing the always-on dev server
```bash
# On Mac Mini:
launchctl list | grep arto.studio    # is it running?
launchctl unload ~/Library/LaunchAgents/com.arto.studio.dev.plist   # stop
launchctl load ~/Library/LaunchAgents/com.arto.studio.dev.plist     # start
tail -f ~/.logs/arto-dev.out.log                                    # follow logs
```

##### Deploying
Unchanged: `git push origin main` from anywhere → Vercel redeploys production automatically.


---

#### Session 6 notes (2026-04-21)

Shipped: self-service signup with trial-call quota, Resend transactional
email, Stripe test-mode checkout, webhook-driven upgrade to `starter`
tier. Two gotchas worth remembering:

- **Stripe SDK v22 is unreliable on Vercel/Node 24.** The Checkout
  session endpoint uses raw `fetch` to the Stripe REST API. The webhook
  handler still uses the SDK (only for `constructEvent` signature
  verification - no outbound).
- **`vercel env add` eats piped newlines.** Use `printf %s "value" |
  vercel env add VAR production` to avoid saving `value\n`.

Pending for a future session:
- Verify `artogroup.com` at resend.com/domains so email can ship to
  addresses other than the verified account owner.
- Handle `customer.subscription.deleted` and `.updated` events in the
  webhook (currently logged but ignored).
- Flip Stripe to live mode when we want real payments - just swap the
  keys in Vercel prod.


---

#### Session 4 notes (2026-04-21)

Shipped two Claude Agent Skills wrapping the ARTO API:
- `arto-brand-roast` (public, no key) and `arto-brand-positioning` (gated,
  requires `ARTO_API_KEY`).
- Both are pure API wrappers - no ARTO methodology bundled locally. This
  is deliberate: Session 6's commercial model depends on the methodology
  living behind the paid API.

Install paths documented in `docs/SKILLS.md`:
1. **Project-scoped** - already loaded when working inside this repo.
2. **User-scoped** - `cp -r .claude/skills/arto-* ~/.claude/skills/`.
3. **Plugin marketplace** - future, once Anthropic opens one for third
   parties. `.claude-plugin/plugin.json` is ready.

Verified the full activation chain end-to-end on the MacBook: copied
skills to `~/.claude/skills/`, ran `claude -p` from `/tmp`, Claude picked
the right skill from description alone, refused when `ARTO_API_KEY` was
missing, and formatted the API output verbatim when the key was present.

Pending for future sessions:
- `arto-methodology-lite` skill (bundles only `quality/rubric.md`) as the
  viral seed - teaches the ARTO quality frame offline without giving
  away the Positioning methodology.
- Telemetry: tag `skill_traces.source` with `"agent-skill"` when the
  call came via a Claude Code skill (User-Agent sniff).
- Publish to a marketplace once Anthropic ships one.


---

#### Session 5 notes (2026-04-21)

Shipped `/studio` - internal dashboard for the team to run skills without
curl. Key design choices:

- **Auth = client API key** (same one a paying customer would use).
  Team members use a `tier: internal` client created in `/admin → Clients`
  with `allowed_skills: ["*"]` and a high `rate_limit_per_hour`. No new
  auth surface, no SSO complexity.
- **Tabs are dynamic** - fetched from `/api/skills` with the user's key,
  so each user sees only the skills they have access to. A paying Starter
  customer using `/studio` only sees `brand-positioning`; an internal
  key sees everything.
- **Forms + renderers are hardcoded per skill** (not schema-driven).
  When a new skill ships without a custom UI, `UnknownSkillRunner.tsx`
  handles it with a raw JSON-in/JSON-out form.
- **Recent-calls sidebar** uses `/api/studio/my-traces` (new route) which
  auths with the client key and returns only that client's traces plus
  current quota state (trial_calls_used, tier, etc.).

Pending for future:
- More skill-specific renderers as new skills ship.
- Export-to-markdown of results (ARTO team asks for this when they
  want to paste a positioning into Notion or Slack).
- Diff view between two positioning runs on the same brand.
