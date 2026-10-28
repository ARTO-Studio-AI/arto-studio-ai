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
| **Qué NO hacer** | No poner `arto-studio-ai.vercel.app` en correos, OG, sitemap ni copys nuevos. Desde el 2026-10-16 el digest usa `SITE_URL` vía la plantilla de marca (`src/lib/email-templates/digest.ts`) |
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

### Lista de espera del Pack ARTO: aviso de apertura aparte de las promociones

| | |
|---|---|
| **Quién** | Campaña de lanzamiento ARTO x TIVC del 2026-10-16: la etapa 1 es juntar correos. Implementó Code; auditoría de Fable en el PR `fix/waitlist-pack-consentimiento`; **pendiente de la firma de Victor** |
| **Qué se decidió** | El formulario de `/skills` (Pack ARTO) y `/agents` guarda siempre la fila en `waitlist`: es el aviso de apertura que la persona pidió. La casilla de promociones va **sin marcar**, con enlace al aviso de privacidad, en ES/EN. Si la marca, `/api/waitlist` llama a `addToMarketingList` con `requireConfirm: true` (fuente `pack_waitlist` o `agents_waitlist`) y manda `sendListConfirmation`, igual que el roast. La fila de `waitlist` guarda idioma, `marketing_opt_in`, `consent_version` (`WAITLIST_CONSENT_VERSION`), `consent_at` (hora del servidor) y el primer toque de `asai_utm`. Un fallo de base responde 500 |
| **Por qué** | La campaña necesita que cada correo llegue a la lista con consentimiento y que se sepa de qué canal vino. Antes la ruta guardaba solo email y fuente, sin consentimiento ni UTM, con mensajes en inglés, y respondía ok aunque fallara la base. Condicionar el aviso de apertura a aceptar promociones no sería un consentimiento libre (RGPD), por eso son dos cosas |
| **Qué NO hacer** | No marcar la casilla por defecto ni hacerla obligatoria para anotarse. No mandar promociones a la tabla `waitlist`: la lista es `newsletter_subscribers` con `status = active`. Un «no» posterior no borra un «sí» anterior en `waitlist` (la baja va por el enlace del correo) y se guarda la fecha del primer «sí». El primer toque de una fila no se pisa. `source` es la primera lista; `sources` acumula todas. Si cambia el texto de la casilla, subir `WAITLIST_CONSENT_VERSION`. No decir en la respuesta si el correo ya estaba en la lista (sería un oráculo sobre terceros). No volver a abrir CORS en el POST: solo lo usan `/skills` y `/agents` |
| **Quien ya estaba en la lista** | Las filas anteriores al 2026-10-16 nunca aceptaron promociones. La invitación única a confirmar es una propuesta aparte (`docs/propuestas/261016-waitlist-invitacion-confirmar.md`) y no se ejecuta sin el go de Victor |
| **Dónde** | `src/components/NewsletterForm.tsx`, `src/app/api/waitlist/route.ts`, `src/lib/waitlist.ts`, `src/lib/marketing-list.ts`, `src/app/admin/canales/page.tsx`, migración `0018_waitlist_consentimiento_utm.sql`, aviso de privacidad |

### Resumen semanal: diseño de marca, martes y nunca repetir un prompt

| | |
|---|---|
| **Quién** | Victor, 2026-10-16: «rehaz el resumen semanal con el diseño de marca, en español, sin los datos internos» y, al ver la muestra, «haz el cambio [a martes]» y «que los prompts destacados, por lo pronto, vayan cambiando de manera random... pero que nunca repitamos prompts, o podrían ser también los prompts nuevos de la semana. Eso lo puedes definir». La regla la definió Code; auditoría de Fable en el PR #99 |
| **Qué se decidió** | El digest sale los **martes a las 14:00 UTC** con la plantilla de marca (`digest.ts`), en el idioma guardado del suscriptor. Lleva **cinco prompts**: primero los publicados en los últimos 7 días que nunca se mandaron, del más nuevo al más viejo; lo que falte, al azar entre los publicados nunca enviados, sin repetir vertical mientras se pueda. Gratis y Pro mezclados, con su etiqueta. Cada envío queda en `digest_sends` (una fila por día, migración 0019) antes de mandar |
| **Por qué** | Las búsquedas de los usuarios y la brecha del catálogo son datos internos. No repetir mantiene el correo útil semana a semana. El copy ya no dice que los eligieron estrategas ni que están probados, porque no es una selección editorial |
| **Qué NO hacer** | No volver a leer `search_queries` en el digest. No mandar un prompt que ya esté en `digest_sends`. No borrar filas de `digest_sends`: es el registro que impide repetir. «Publicado en los últimos 7 días» usa `created_at` porque `prompts` no tiene fecha de publicación |
| **Pendiente** | Gancho apagado para «los más usados de la semana» (`mostUsed` en `digest-selection.ts`). Lo activa una decisión de Victor |
| **Dónde** | `src/lib/email-templates/digest.ts`, `src/lib/digest-selection.ts`, `src/app/api/cron/digest/route.ts`, `vercel.json`, migración `0019_digest_sends.sql` |

### D10 · Aviso de cookies: solo esenciales por defecto

| | |
|---|---|
| **Quién** | Victor, 2026-10-09 (respuesta «sí» al punto 12, H-48). Implementó Code; auditoría de Fable en el PR |
| **Qué se decidió** | Aviso de cookies en ES/EN con dos opciones del mismo peso: «Solo esenciales» y «Aceptar analítica». Sin respuesta, solo esenciales. La elección vive en la cookie `asai_consent` (`all` o `essential` + versión del texto, 6 meses). Con `all`: PostHog en el navegador, PostHog del servidor en `/auth/callback`, Google Analytics 4 (desde el 2026-10-20, D17) y la cookie `asai_utm`. Sin `all`: nada de eso. El enlace «Cookies» del footer y el del aviso de privacidad reabren el aviso; retirar el consentimiento apaga PostHog y GA4 y borra sus cookies y claves `ph_*`, `_ga`, `_ga_*` y `asai_utm` |
| **Por qué** | El RGPD y la directiva ePrivacy piden consentimiento previo para cookies que no son necesarias; la LFPDPPP pide informar y dejar oponerse. Antes PostHog y `asai_utm` se activaban en la primera visita sin preguntar |
| **Esenciales sin preguntar** | Sesión de Supabase, `asai_vid` (contador free de D7 y anti-abuso), `NEXT_LOCALE`, `asai_next`, `asai_signup` y la propia `asai_consent`. Vercel Web Analytics y Speed Insights no usan cookies y se quedan |
| **Qué NO hacer** | No inicializar PostHog ni escribir `asai_utm` sin `asai_consent = all`. No marcar «Aceptar» por defecto ni hacerlo más visible que «Solo esenciales». No encender grabación de sesiones ni autocapture solo porque ya hay aviso: siguen apagados por D9 hasta decisión de Victor. Si cambia el texto del aviso o se agrega una cookie no esencial, subir `CONSENT_VERSION` y actualizar la tabla del aviso de privacidad en el mismo PR |
| **Responsable y retención (2026-10-09)** | Victor: «ARTO US cobra, no México»; la razón social es **ARTO Inc.** (respuesta 13). El aviso y los Términos nombran a ARTO Inc. como responsable y operador, y dicen que los datos se tratan en EE.UU.; se siguen ofreciendo los derechos ARCO. Victor aprobó borrar las búsquedas a los 12 meses: `src/lib/retention.ts` desde el cron diario `/api/cron/purge`. Desde el 2026-10-09 los Términos (ES/EN) dicen lo mismo. Victor, 2026-10-10: ARTO Inc. está constituida en **Delaware**; domicilio comercial (el de las facturas) 101 Avenue of the Americas, Fl 8, New York, NY 10013; domicilio registrado el de su agente (National Registered Agents, Inc., 1209 Orange Street, Wilmington, DE 19801), que no se publica en el sitio. Ley aplicable: Delaware. **Qué NO hacer:** no volver a poner ley mexicana ni tribunales de Monterrey; no publicar el domicilio del agente registrado como domicilio de contacto |
| **Dónde** | `src/lib/consent.ts`, `src/lib/retention.ts`, `src/components/CookieBanner.tsx`, `src/lib/analytics.ts`, `src/lib/ga.ts`, `src/proxy.ts`, `src/app/auth/callback/route.ts`, `src/app/[locale]/(marketing)/privacy/page.tsx` |

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

### D13 · Dos remitentes de correo, a propósito

| | |
|---|---|
| **Quién** | Configuración de octubre de 2026; documentado tras la auditoría de Fable de la prueba de registro (2026-10-10) |
| **Qué se decidió** | Los correos de autenticación (confirmar registro, enlace mágico) los manda **Supabase** con su SMTP personalizado, desde `noreply@artostudio.ai`. Las plantillas viven en el panel de Supabase (copias en Drive, `supabase-plantillas/`). Todo lo demás (bienvenida, reporte del roast, doble opt-in, digest) lo manda la app por Resend desde `EMAIL_FROM` = `ARTO Studio AI <hola@creative.artostudio.ai>` |
| **Por qué** | El SMTP de Supabase se configura fuera del repo y no comparte variable con la app. Separar `noreply@` (transaccional de acceso, sin respuesta) de `hola@` (correo de marca al que se puede contestar) es intencional |
| **Qué NO hacer** | No "unificar" el remitente de Supabase con `EMAIL_FROM` por accidente al rotar SMTP o llaves. Si se cambia, se cambia en el panel de Supabase y en esta entrada a la vez |
| **Dónde** | Supabase → Authentication → SMTP Settings y Email Templates; `EMAIL_FROM` en Vercel; `src/lib/email.ts` |

### D14 · Acceso al panel: solo ADMIN_EMAILS

| | |
|---|---|
| **Quién** | Victor, 2026-10-12 (pregunta 55: «quítala») |
| **Qué se decidió** | Quien entra a `/admin` sale únicamente de la variable `ADMIN_EMAILS` en Vercel. Se retiraron la pantalla `/admin/admins`, su API y la consulta a la tabla `admin_users` en `src/lib/auth.ts` |
| **Por qué** | La tabla `admin_users` (migración 0001) nunca se creó en producción, así que la pantalla no funcionaba. Con dos administradores, una segunda vía de acceso solo agrega superficie de riesgo |
| **Qué NO hacer** | No volver a dar acceso por base de datos sin decisión nueva de Victor. No aplicar `supabase/migrations/0001_admin_users.sql`: queda solo como histórica. `profiles.is_admin` y `email_tier_grants.is_admin` no dan acceso al panel; solo alimentan políticas RLS de lectura |
| **Cómo dar o quitar acceso** | `vercel env rm ADMIN_EMAILS production` y luego `vercel env add ADMIN_EMAILS production` con la lista nueva separada por comas, y redesplegar producción |

### D15 · El panel solo administra el sitio

| | |
|---|---|
| **Quién** | Victor, 2026-10-12 (preguntas 47 y 56) |
| **Qué se decidió** | Se retiraron de `/admin` las 7 páginas Engine, Outreach, Content Factory y la pestaña «Roast traces», con sus APIs (`/api/admin/engine/*`, `/api/admin/outreach/*`, `/api/admin/content/*`, `/api/traces`) y las librerías que solo usaban ellas (`engine-store.ts`, `content-image.ts`). El generador de prompts de Content Factory vive ahora en el Catálogo |
| **Por qué** | Las páginas Engine solo mostraban lo que escribe el motor externo del Mac Mini (`com.arto.engine.intelligence`, lunes 11:00, escribe `engine_runs` y `engine_signals` directo en Supabase); ninguna decisión del sitio dependía de ellas. Si el motor sigue o se apaga es decisión aparte de Victor. Las páginas de scraping, social y gaps leían tablas que ya nadie escribe. Outreach redactaba correos en frío a prospectos sin consentimiento, lo que choca con la política del 2026-10-06. El marketing, las redes y el outreach se trabajan en una plataforma aparte, con su propia estrategia |
| **Qué NO hacer** | No volver a meter herramientas de marketing en `/admin` sin decisión nueva. No borrar las tablas (`engine_*`, `outreach_*`, `content_items`, `agent_social_log`, `content_gaps`): `content_items` alimenta artículos de `/learn` y `engine_config` guarda el correo de bienvenida |

### D16 · Las tablas nuevas nacen cerradas

| | |
|---|---|
| **Quién** | Victor, 2026-10-12 (pregunta 59) |
| **Qué se decidió** | Migración 0016: los privilegios por defecto del rol `postgres` en `public` ya no dan nada a `anon` ni a `authenticated` en tablas, secuencias y funciones nuevas. Para funciones, además, se quita el EXECUTE a PUBLIC de forma global (todos los esquemas) para el rol `postgres`, porque una entrada por esquema no lo quita. `service_role` conserva todo |
| **Por qué** | Cada tabla nueva nacía abierta a la API pública y había que cerrarla a mano; así nacieron H-63 y H-64 |
| **Alcance** | Solo el rol `postgres`. El esquema `storage` (que maneja Supabase) y los defaults de los roles `supabase_*` quedan fuera a propósito |
| **Qué NO hacer** | No crear una tabla que el navegador deba leer sin su `GRANT` explícito y su política RLS en la misma migración. No revertir 0016 para «arreglar» un 401: el 401 es la protección funcionando |

### D17 · Google Analytics 4, solo analítica y con el mismo consentimiento

| | |
|---|---|
| **Quién** | Victor, 2026-10-20 («quiero que integremos Google Analytics al sitio»). Implementó Code; auditoría de Fable en el PR #100 |
| **Qué se decidió** | GA4 con `gtag.js` detrás del aviso de cookies de D10: solo con `asai_consent = all`, sin DNT y con `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Consent Mode v2 con todo lo de anuncios en `denied`; Google Signals y personalización de anuncios apagados; cookie `_ga` solo en el host. Las vistas de página van a mano (`send_page_view: false`) con la URL sin query salvo los `utm_*`, y en `/roast` con título fijo. Los eventos tipados de `analytics.ts` llegan a GA con el mismo nombre que en PostHog. El aviso subió a la versión `v2-2026-10-20` porque ahora nombra a Google |
| **Por qué** | Victor quiere GA para tráfico y adquisición, que es donde se miden las campañas. El consentimiento de la v1 solo cubría PostHog. La vista compartida del roast lleva la marca y el titular en la query y en el título; eso no debe llegar a Google |
| **Qué NO hacer** | No cargar `gtag.js` sin consentimiento ni desde `next/script` en el layout. No encender Google Signals, remarketing ni vínculos con Google Ads sin decisión de Victor y un aviso nuevo. En el flujo web de GA4, dejar apagado «Cambios de página basados en eventos del historial» de la medición mejorada: si se enciende, salen vistas duplicadas con la URL completa. No mandar a GA email, nombre, empresa ni texto libre |
| **Dónde** | `src/lib/ga.ts`, `src/components/analytics/GaPageViews.tsx`, `src/lib/analytics.ts`, `src/lib/consent.ts`, `src/components/CookieBanner.tsx`, aviso de privacidad, `docs/METRICS.md` |

### D18 · Todo correo sale con la plantilla de marca y el banner del canal

| | |
|---|---|
| **Quién** | Victor, 2026-10-16 («tiene que ser una regla para cada correo») y 2026-10-20 («que tenga más diseño, con los ajustes del branding… incluye este [el banner] porque tiene nuestro tagline»). Implementó Code; auditoría de Fable en el PR #99 |
| **Qué se decidió** | Todo correo de ASAI pasa por `layout()` (`src/lib/email-templates/layout.ts`). La tarjeta abre con el banner del canal (logotipo «arto Studio AI», «Prompts, skills y agentes · para el mundo creativo» y cuatro personajes), en `public/email/header-es.png` y `header-en.png`, y el pie repite el tagline. Los cuerpos usan los bloques comunes: `hero()` (etiqueta, titular con la palabra clave en Cormorant naranja e intro), `checks()` (casilla naranja), `tiles()` (dos tarjetas con personaje), `button()` (redondo) y `signoff()`. Las plantillas de acceso de Supabase se generan con `supabase-auth.ts` y se suben con `scripts/supabase-auth-templates.ts` |
| **Por qué** | El banner le recuerda a quien lo lee qué es el producto. Con los bloques comunes, un correo nuevo sale de marca sin rediseñar cada vez |
| **Qué NO hacer** | No mandar HTML suelto, texto sin plantilla ni correos armados en el editor de Resend. No editar las plantillas de acceso a mano en el panel de Supabase: se cambian en el repo y se suben con el script. Si cambia la marca, se regenera el banner y se cambia aquí |
| **Dónde** | `src/lib/email-templates/`, `src/lib/email.ts`, `public/email/`, `scripts/supabase-auth-templates.ts` |

### D19 · Pixel de Meta propio de ASAI, con la publicidad como opción aparte

| | |
|---|---|
| **Quién** | Victor, 2026-10-22 («Todo sí, y si tenemos que cambiar el aviso de privacidad, cámbialo de una vez para que todo haga sentido»). Creó el pixel en Meta con Code; implementó Code |
| **Qué se decidió** | ASAI tiene su propio conjunto de datos de Meta, «ARTO Studio AI» (`1786082372609082`), en el portafolio artostudio y conectado a la cuenta publicitaria compartida «ARTO Studio» (`1117694250907304`). No se usa el pixel de Nómina. El aviso de cookies pasa a tres opciones del mismo peso: «Solo esenciales», «Solo analítica» (PostHog y GA4) y «Aceptar todo» (suma el pixel de Meta). `asai_consent` admite `essential`, `analytics` y `all`; versión `v3-2026-10-22`, así que el aviso vuelve a salir para todos. Eventos: `PageView`, `RoastCompleted` y `Lead`. El aviso de privacidad (ES/EN) suma a Meta como proveedor, las cookies `_fbp` y `_fbc`, y la finalidad de medir anuncios |
| **Por qué** | Las campañas de ASAI en Meta necesitan medir qué anuncio trae roasts y correos. El aviso anterior prometía «no usamos cookies de publicidad», así que había que pedir permiso aparte y decirlo en el aviso de privacidad |
| **Qué NO hacer** | No cargar el pixel con «Solo analítica» ni sin respuesta. No encender `autoConfig` ni la coincidencia avanzada automática. No mandar a Meta correo, nombre de la marca ni texto libre; en URLs con parámetros que no son `utm_*` no sale nada. No usar el pixel de Nómina en campañas de ASAI. Las campañas de ASAI en la cuenta compartida empiezan con «ASAI ·» |
| **Fase 2 (2026-10-22)** | Victor: «1. ambos, 2. sí, 3. sí». La API de conversiones (`src/lib/meta-capi.ts`) manda desde el servidor `RoastCompleted`, `Lead` y `CompleteRegistration`. Los dos primeros también salen del pixel con el mismo `event_id` (lo genera el navegador) y Meta cuenta uno. Por el servidor sí va el correo con SHA-256, el id de Supabase con SHA-256, IP, navegador, `_fbp` y `_fbc`; esto **reemplaza** el «no mandar correo» de arriba solo para la API de conversiones, y el aviso de privacidad lo dice. Misma puerta: solo con `asai_consent = all` vigente y sin `DNT`/`Sec-GPC`. Token en Vercel (`META_CAPI_ACCESS_TOKEN`), nunca en el repo |
| **Qué NO hacer (fase 2)** | No mandar el correo en claro ni el nombre de la marca. No mandar eventos del servidor sin la cookie de publicidad (la API pública del roast, sin cookie, no cuenta). No esperar a Meta antes de responder el roast ni el login (`after()`). No mandar `RoastCompleted` ni `Lead` por el servidor sin el `event_id` del navegador (se contarían dos veces). La industria solo va si es de la lista del roast. No poner `META_CAPI_TEST_EVENT_CODE` en producción. Graph API en v26.0: revisar la versión en cada auditoría |
| **Dónde** | `src/lib/meta-pixel.ts`, `src/lib/meta-capi.ts`, `src/lib/consent.ts`, `src/lib/analytics.ts`, `src/components/CookieBanner.tsx`, `src/components/analytics/GaPageViews.tsx`, aviso de privacidad, `docs/METRICS.md` |

### ARTO Edit Bundle #1: gratis con cuenta hasta el 7 nov, después solo Pro

| | |
|---|---|
| **Quién** | Victor, 2026-10-27: los 9 skills de edición de video vertical son parte de Pro (el Pro de 9 USD que ya existe en Stripe) y «hay que recordar si ya los quitamos». Implementó Code; auditoría de Fable en el PR `feat/edit-bundle-1` |
| **Qué se decidió** | Del 27 oct al 2 nov de 2026 cualquier cuenta gratis descarga los 9 skills y el bundle. Desde el **3 nov a las 00:00 de Ciudad de México (06:00 UTC)** solo Pro y Enterprise (`profiles.tier`). Sin sesión se ve todo y el botón manda a crear cuenta o entrar, de regreso a la misma página. El corte es **una sola constante**, `EDIT_BUNDLE_FREE_UNTIL` en `src/lib/edit-bundle/access.ts`, con pruebas de los dos lados de la fecha: no depende de que nadie lo quite a mano |
| **Cambio 2026-10-28** | Victor movió el corte al **8 nov 00:00 CDMX (06:00 UTC)**: gratis hasta el 7 nov inclusive. Motivo: el video V03 sale el 28 oct y dice «los próximos 10 días». Texto de la landing con fecha fija; si se amplía otra vez, se cambia la constante y los textos (Terminator le recuerda a Victor decidirlo antes del 7 nov) |
| **Archivos** | Los `.skill` y el `.zip` viven en `private/skills/` (fuera de `public/`), entran a la función con `outputFileTracingIncludes` y solo salen por `GET /api/skill-downloads/[slug]`, que revisa sesión, plan y fecha en el servidor. Las demos sí son públicas (`public/skills/demos/`). Textos, demos y paquetes llegan de Drive con `scripts/sync-edit-bundle.sh`; `src/lib/edit-bundle/assets.json` dice qué existe |
| **Registro** | Cada descarga deja una línea JSON `skill_download` (user_id, slug, tier, promo, hora) en los logs de Vercel y, con consentimiento de analítica (D10), `skill_downloaded` en PostHog. No hay tabla: `attribution_events` tiene un CHECK de tipos cerrados y agregar uno sería DDL |
| **Qué NO hacer** | No mover los paquetes a `public/` ni servirlos con un enlace fijo. No cambiar la fecha sin decisión de Victor. No crear productos ni precios en Stripe para el bundle. Lo que alguien ya descargó es suyo: el corte solo cierra la descarga y las versiones nuevas. Si un paquete pasa de 4.4 MB, el manifiesto falla: la respuesta de una función de Vercel no pasa de 4.5 MB y habría que moverlo a un bucket privado |
| **Dónde** | `src/lib/edit-bundle/`, `src/app/api/skill-downloads/[slug]/route.ts`, `src/components/edit-bundle/`, `src/app/[locale]/(marketing)/skills/`, `src/app/[locale]/(marketing)/edit-bundle-1/`, `scripts/sync-edit-bundle.sh`, `scripts/edit-bundle-manifest.mjs` |
