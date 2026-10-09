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

### D7 · Pricing de lanzamiento: Free con tope de 3 prompts al día

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 (investigar antes de decidir); decidió el 2026-09-11 |
| **Qué se decidió** | Free con 3 prompts abiertos al día y búsquedas libres; Pro $9 USD al mes; Studio $29 USD al mes, próximamente; Agents sin precio y próximamente; precios de lanzamiento |
| **Por qué** | Texto literal de Victor: «la decisión va a ser free y dejar que nomás puedan buscar tres prompts al día, y hay que agregar el contador, obviamente. Dejaré los precios que tenemos: 9 29, y el de agente hay que dejarlo sin precio y dejarlo como coming soon. La idea es que hagamos estos precios de lanzamiento y luego los podemos ir subiendo». Aclaración suya: «solo tres abiertos por día no busquedas» |
| **Qué NO hacer** | No subir precios ni cambiar productos de Stripe sin decisión escrita de Victor. No contar búsquedas en el tope |
| **Dónde** | `src/lib/prompt-limit.ts`, página de pricing, migración `0009_prompt_opens` |

### D8 · Testimonios y secuencia de emails ASAP, sin inventar testimonios

| | |
|---|---|
| **Quién** | Victor, 2026-09-10 |
| **Qué se decidió** | Se prioriza una sección de testimonios y una secuencia de emails de onboarding. Los testimonios se piden a clientes reales |
| **Por qué** | Prueba social y activación son lo que más falta en el funnel |
| **Qué NO hacer** | **No inventar testimonios ni nombres.** Placeholder visible o nada, hasta que haya uno real. Cambios de email pasan por Fable (está fuera del auto-fix) |
| **Dónde** | Notion hub «ARTO Studio AI Web» |

### D9 · Medición y captación (Fase 1C)

| | |
|---|---|
| **Quién** | Victor, plan del Sprint 1 (Fase 1C); ejecutó Fable el 2026-09-13 |
| **Qué se decidió** | PostHog es la analítica de producto (US Cloud, proyecto 604228) y Vercel Analytics + Speed Insights la de tráfico y rendimiento. Eventos tipados en `src/lib/analytics.ts` y documentados en `docs/METRICS.md`; nada se manda fuera de esa lista. `identify` con el id de Supabase, nunca con el email; `person_profiles: identified_only`; se respeta `doNotTrack`; autocapture apagado. Atribución de **primer toque** en la cookie `asai_utm` (30 días): una vez puesta no se sobreescribe. Empresa y rol en el login son opcionales y nunca bloquean. La audiencia de Resend recibe contactos sin mandar ningún correo |
| **Por qué** | Sin medición no se puede decidir precio ni onboarding (D7, D8). Identificar por id y no por email limita lo que sale a un tercero. Primer toque porque lo que se quiere saber es qué canal trae gente nueva, no cuál cierra |
| **Qué NO hacer** | No mandar email, nombre ni empresa a PostHog. No encender autocapture ni session replay sin decisión de Victor; desde el 2026-09-13 (H-47) el init lleva `disable_session_recording: true` y solo se quita con esa decisión y con aviso de cookies (H-48). No cambiar la cookie `asai_utm` a último toque. No convertir Empresa y Rol en obligatorios. No mandar correos desde `resend-audience.ts` (los envíos pasan por Fable, están fuera del auto-fix) |
| **Dónde** | `src/lib/analytics.ts`, `src/lib/analytics-server.ts`, `src/lib/attribution.ts`, `src/lib/resend-audience.ts`, `src/proxy.ts`, `docs/METRICS.md`, migración `0010_profile_capture.sql` |

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

### Brand Roast v2: Opus 5.5 solo para el roast, lectura del sitio en el servidor y nunca un roast de plantilla

| | |
|---|---|
| **Quién** | Victor pidió el 2026-10-06 que el roast «funcione a la perfección» y autorizó cambiar el modelo. Midió y propuso Code; **pendiente de su firma en el PR** |
| **Qué se decidió** | El roast usa `ROAST_MODEL` (default `claude-opus-5-5`) con `ROAST_EFFORT` (default `low`), independiente de `ANTHROPIC_MODEL`. El servidor lee el sitio (`src/lib/site-snapshot.ts`) y hace **una** llamada con `output_config.format` (JSON Schema). Si el modelo falla, `/api/roast` responde **503** y la página ofrece reintentar. El roast sale en español con `lang: "es"`; sin `lang` el API sigue en inglés |
| **Por qué** | Medido en producción el 2026-10-06: con URL daba **504** siempre (web_fetch en varias vueltas pasaba de los 30 s); sin URL un pilar llegó sin score y la página mostró 5. Al fallar, la página inventaba un roast con frases al azar y lo presentaba como análisis. Comparativa con Oatly, Grupo Bimbo y Kavak: Sonnet 5 15 s, Sonnet 5.5 12-15 s, Opus 5.5 low ~16 s, Opus 5.5 medium 18-23 s. Opus 5.5 low da las observaciones más concretas (cita el copy real) por unos 7 centavos de dólar por roast |
| **Qué NO hacer** | No apuntar `ANTHROPIC_MODEL` a Opus 5.5 o Sonnet 5.5 sin migrar los demás skills: usan `tool_choice` forzado y esos modelos lo rechazan con 400. No volver a mostrar `roast-fallback.ts` como si fuera un análisis. No quitar las guardas de SSRF de `site-snapshot.ts` (IP validada al conectar, redirecciones revalidadas) |
| **Dónde** | `src/lib/roast-runner.ts`, `src/lib/roast-prompt.ts`, `src/lib/site-snapshot.ts`, `src/lib/skills/engine.ts` (`customRun`), `src/app/api/roast/route.ts`, `src/app/roast/page.tsx` |

### Registro obligatorio para la versión free y consentimiento de correos

| | |
|---|---|
| **Quién** | Victor, 2026-10-06: «tenemos que tener un login para que la gente nos deje su correo y puedan hacer login con la versión free… necesitamos tener una base de datos para poderles empezar a mandar nosotros correos electrónicos con promociones». Implementó Code; auditoría de Fable en el PR |
| **Qué se decidió** | Sin sesión se ve el catálogo y las primeras ~280 letras de cada prompt free; el prompt completo pide crear la cuenta gratis (enlace mágico o Google) y después regresa al mismo prompt (cookie `asai_next`, validada con `safeNextPath`). En el registro hay una casilla **sin marcar** para recibir promociones; se guarda en `user_metadata.marketing_opt_in` (`yes`/`no`) con versión del texto y fecha, y en `attribution_events.metadata`. Solo quien dijo que sí entra a la audiencia de Resend. Con sesión free sigue el tope de D7 (3 aperturas al día) |
| **Por qué** | Sin cuenta no hay lista a quién vender. El consentimiento expreso es lo que piden la LFPDPPP (México) y el RGPD (visitantes de la UE) para correos de promoción. Antes del cambio, el callback daba de alta a **todos** los registros en la audiencia sin preguntar |
| **Qué NO hacer** | No marcar la casilla por defecto. No dar de alta en la audiencia a quien no tenga `marketing_opt_in = yes`. No mandar el destino por la query del `emailRedirectTo` (depende de la lista de redirecciones de Supabase, H-50). No quitar el adelanto del prompt sin pensar en SEO: es el texto indexable de cada ficha |
| **Doble opt-in en el roast** | Desde el 2026-10-07 (auditoría de Fable del PR #76): la casilla del roast deja la fila en `pending` y manda un correo de confirmación; solo al confirmar (`/api/newsletter/confirm`, botón POST) pasa a `active`, entra a la audiencia y recibe la bienvenida. El registro no lo necesita: el enlace mágico o Google ya prueban el buzón. El reporte del roast se pide con un token firmado del roast (`report_token`), nunca por nombre de marca, y no sobreescribe un correo ya guardado |
| **La lista** | Desde el 2026-10-07 quien marca la casilla (registro o roast) entra a `newsletter_subscribers` (status `active`, `source` signup/roast), la misma tabla del digest semanal y con token de baja; también a la audiencia de Resend si existe. `src/lib/marketing-list.ts` |
| **Reactivación** | Volver a marcar la casilla reactiva a quien estaba `unsubscribed`: es un nuevo sí expreso. Revisado por Fable el 2026-10-07 |
| **Fuente de verdad del consentimiento** | `attribution_events.metadata.marketing_opt_in` (escrito con service role, con fecha y versión). `user_metadata` lo puede editar el propio usuario y en magic link no lleva fecha: sirve de espejo, no de prueba. El roast tiene su propia casilla; dejar el correo para ver el reporte no es aceptar promociones |
| **H-61 (2026-10-09)** | Hasta la migración 0013 la fila de signup **nunca se escribió**: el callback ponía el usuario en `target_id`, que tiene FK a `outreach_targets`, y el insert fallaba en silencio (0 filas en producción). Desde 0013 el usuario va en `user_id` (FK a `auth.users`). Para quien se registró antes, la única prueba fechada escrita por servidor es `newsletter_subscribers.subscribed_at`. **Qué NO hacer:** no volver a usar `target_id` para usuarios; es de outreach |
| **Dónde** | `src/app/[locale]/(marketing)/prompts/[id]/page.tsx` y `SignupWall.tsx`, `src/app/[locale]/(marketing)/login/`, `src/app/api/roast/email/route.ts`, `src/app/roast/page.tsx`, `src/app/auth/callback/route.ts`, `src/lib/attribution.ts`, aviso de privacidad |

### D10 · Aviso de cookies: solo esenciales por defecto

| | |
|---|---|
| **Quién** | Victor, 2026-10-09 (respuesta «sí» al punto 12, H-48). Implementó Code; auditoría de Fable en el PR |
| **Qué se decidió** | Aviso de cookies en ES/EN con dos opciones del mismo peso: «Solo esenciales» y «Aceptar analítica». Sin respuesta, solo esenciales. La elección vive en la cookie `asai_consent` (`all` o `essential` + versión del texto, 6 meses). Con `all`: PostHog en el navegador, PostHog del servidor en `/auth/callback` y la cookie `asai_utm`. Sin `all`: nada de eso. El enlace «Cookies» del footer y el del aviso de privacidad reabren el aviso; retirar el consentimiento apaga PostHog y borra sus cookies y claves `ph_*` y `asai_utm` |
| **Por qué** | El RGPD y la directiva ePrivacy piden consentimiento previo para cookies que no son necesarias; la LFPDPPP pide informar y dejar oponerse. Antes PostHog y `asai_utm` se activaban en la primera visita sin preguntar |
| **Esenciales sin preguntar** | Sesión de Supabase, `asai_vid` (contador free de D7 y anti-abuso), `NEXT_LOCALE`, `asai_next`, `asai_signup` y la propia `asai_consent`. Vercel Web Analytics y Speed Insights no usan cookies y se quedan |
| **Qué NO hacer** | No inicializar PostHog ni escribir `asai_utm` sin `asai_consent = all`. No marcar «Aceptar» por defecto ni hacerlo más visible que «Solo esenciales». No encender grabación de sesiones ni autocapture solo porque ya hay aviso: siguen apagados por D9 hasta decisión de Victor. Si cambia el texto del aviso o se agrega una cookie no esencial, subir `CONSENT_VERSION` y actualizar la tabla del aviso de privacidad en el mismo PR |
| **Responsable y retención (2026-10-09)** | Victor: «ARTO US cobra, no México»; la razón social es **ARTO Inc.** (respuesta 13). El aviso y los Términos nombran a ARTO Inc. como responsable y operador, y dicen que los datos se tratan en EE.UU.; se siguen ofreciendo los derechos ARCO. Victor aprobó borrar las búsquedas a los 12 meses: `src/lib/retention.ts` desde el cron diario `/api/cron/purge`. Desde el 2026-10-09 los Términos (ES/EN) dicen lo mismo: operador ARTO Inc., leyes de EE.UU. y del estado de constitución. Pendiente: estado de constitución y domicilio de ARTO Inc. |
| **Dónde** | `src/lib/consent.ts`, `src/lib/retention.ts`, `src/components/CookieBanner.tsx`, `src/lib/analytics.ts`, `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/app/[locale]/(marketing)/privacy/page.tsx` |

### D11 · Claims de clientes: solo marcas con trabajo verificado

| | |
|---|---|
| **Quién** | Victor, 2026-10-09 (punto 11: portafolio en Notion y credenciales en Drive). Revisó Code contra «ARTO Portafolio 2026» en Notion y las credenciales `260416 ARTO Group - Credenciales` |
| **Qué se decidió** | El sitio, el SEO y los prompts internos (`/admin/content`, `/admin/outreach`) nombran solo marcas con proyecto propio verificado: **Grupo Modelo, Herdez, Sigma, Kavak, Cemex, Guzman y Gomez**. Se quitan «Fortune 500» y «Google, Nike y Uber». Se mantiene «15+ años», que cuadra con «desde 2009» |
| **Por qué** | Uber no aparece en ningún registro. Google (2019) y Nike (2018-2020) fueron proyectos de arte y medios contratados por agencias intermediarias (Public International y Creatividad de Neta), no trabajo de metodología de marca. «Fortune 500» en plural no tiene base |
| **Qué NO hacer** | No volver a poner Google, Nike, Uber ni «Fortune 500» como clientes de la metodología. Si se quiere mencionar Google o Nike, solo como «proyectos de arte y contenido». Kimberly-Clark, H&M, Jumex, BIC y Pokémon fueron prospectos, **no clientes**. Antes de agregar una marca nueva, que exista en el portafolio de Notion |
| **Dónde** | `src/i18n/dictionaries.ts`, `src/lib/seo.ts`, `src/app/layout.tsx`, `src/app/api/admin/content/generate/route.ts`, `src/app/api/admin/outreach/drafts/route.ts` |

### D12 · El marketing vive en Resend; en casa solo el webhook

| | |
|---|---|
| **Quién** | Victor, 2026-10-09 (punto 8, «yes» a la recomendación) |
| **Qué se decidió** | Campañas como Broadcasts de Resend y secuencias como Automations de Resend, disparadas por eventos de la app. En el repo solo se construye `/api/resend/webhook`, que lleva rebotes permanentes, supresiones, quejas y bajas de Resend a `newsletter_subscribers`. Se vuelve a evaluar al llegar a ~5,000 contactos (siguiente paso natural: Loops) |
| **Por qué** | Construir campañas, secuencias y métricas en `/admin` costaba 9 a 13 días más 1 a 2 al mes de mantenimiento, para una lista que hoy casi no tiene contactos. Resend es gratis hasta 1,000 contactos y ya está integrado. Sin el webhook, Supabase y Resend se desincronizan y el digest podría escribirle a quien se dio de baja en Resend |
| **Qué NO hacer** | No construir un motor de campañas en `/admin` sin decisión nueva de Victor. El webhook **nunca reactiva** a nadie: solo baja de `active`/`pending`. Un rebote temporal no saca a nadie |
| **Dónde** | `src/lib/resend-webhook.ts`, `src/app/api/resend/webhook/route.ts`, `RESEND_WEBHOOK_SECRET` en Vercel |
