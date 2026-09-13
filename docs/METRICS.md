# METRICS.md · qué medimos, cómo y contra qué

> Fase 1C del Sprint 1 (13 sep 2026). Decisión D9 en `docs/DECISIONES.md`.
> PostHog: US Cloud, proyecto 604228. Vercel Analytics y Speed Insights: proyecto `arto-studio-ai`.
> Los eventos se declaran en `src/lib/analytics.ts` (`AnalyticsEvents`); si no está ahí, no existe.

## 1 · Activación

Un usuario **free** está activado si en sus primeros **3 días** desde `signup_completed` hace una de dos:

- abre **3 o más prompts distintos** (`prompt_opened`), o
- **completa 1 roast** (`roast_completed`).

Por qué esas dos: son las únicas acciones que muestran valor sin pagar. Copiar, buscar o marcar favoritos
son señales secundarias; abrir prompts es el contador que el tope diario limita (D7) y el roast es la
puerta de entrada pública.

**Cómo se mide.** PostHog, cohorte «Activados»: personas con `signup_completed` y, dentro de los 3 días
siguientes, `prompt_opened` ≥ 3 (propiedad `prompt_id` distinta) o `roast_completed` ≥ 1. Referencia SQL
para cruzar con la base (usa `profiles.created_at` como fecha de signup):

```sql
-- prompts distintos abiertos en los 3 primeros días (tabla prompt_opens, migración 0009)
select p.id, p.created_at, count(distinct o.prompt_id) as opened_3d
from profiles p
left join prompt_opens o
  on o.subject = 'user:' || p.id::text
 and o.first_at < p.created_at + interval '3 days'
where p.tier = 'free'
group by p.id, p.created_at;
```

Los roasts no llevan `user_id` en `skill_traces` (son anónimos), así que la parte «1 roast» solo se mide en
PostHog, donde `identify()` une la sesión anónima con la persona al iniciar sesión.

## 2 · Los cinco funnels

| # | Funnel | Paso A | Paso B | Cómo se mide | Benchmark |
|---|---|---|---|---|---|
| F1 | Visitante → signup | `$pageview` (cualquier persona) | `signup_completed` | PostHog Funnels, ventana 7 días, por persona | **9 a 14 %** |
| F2 | Signup → activación | `signup_completed` | cohorte «Activados» (§1) | PostHog Funnels con paso B = `prompt_opened` ×3 **o** `roast_completed`; ventana 3 días | **~30 %** |
| F3 | Free → tope diario | `signup_completed` (tier free) | `free_limit_reached` | PostHog Funnels, ventana 30 días. SQL: `count(distinct subject) filter (where day_opens >= 3)` sobre `prompt_opens` | sin benchmark externo; se fija la línea base en la primera semana |
| F4 | Tope → checkout iniciado | `free_limit_reached` | `checkout_started` | PostHog Funnels, ventana 7 días. `limit_cta_clicked` (cta = pricing) es el paso intermedio opcional | sin benchmark; se compara contra `pricing_viewed → checkout_started` |
| F5 | Checkout → pago | `checkout_started` | `checkout_completed` (**pendiente**, PR #59) | Hasta que exista el evento: `profiles.tier = 'pro'` con `stripe_subscription_id` no nulo contra `checkout_started` en PostHog | free → pago **3 a 8 %** en productos AI-native (F3×F4×F5 combinados) |

Los benchmarks vienen de la ficha comparativa de pricing de D7 (Drive) y son de productos self-serve
AI-native con plan free; no son metas, son el rango donde deberíamos caer. Si un funnel queda muy por
debajo, primero se revisa la instrumentación y después el producto.

### Lo que todavía no se mide (y de quién depende)

| Evento | Dónde nacería | Va con |
|---|---|---|
| `checkout_completed` | `src/app/api/stripe/webhook/route.ts` al recibir `checkout.session.completed` | PR #59 (Stripe, fuera de esta ronda) |
| `skill_called` | `src/app/api/skills/[slug]/route.ts` por cada llamada con API key | ronda paralela de skills/clients |

Cuando entren, se agregan a `AnalyticsEvents` y a la tabla de §4; F5 pasa a medirse solo en PostHog.

## 3 · Dónde vive cada capa

| Capa | Herramienta | Qué da | Dónde se monta |
|---|---|---|---|
| Producto | PostHog (`posthog-js` en cliente, `posthog-node` en `/auth/callback`) | eventos tipados, funnels, cohortes, retención | `src/components/analytics/PostHogProvider.tsx` desde `src/app/layout.tsx` |
| Tráfico | Vercel Analytics | visitas, páginas, referrers, países | `<Analytics />` en `src/app/layout.tsx` |
| Rendimiento | Vercel Speed Insights | Core Web Vitals reales por ruta | `<SpeedInsights />` en `src/app/layout.tsx` |
| Atribución | cookie `asai_utm` + `profiles` + `attribution_events` | de dónde vino cada signup | `src/proxy.ts`, `src/lib/attribution.ts`, `/auth/callback`, migración 0010 |
| Audiencia | Resend (`RESEND_AUDIENCE_ID`) | lista de contactos para onboarding (D8) | `src/lib/resend-audience.ts` |

Reglas del wrapper (`src/lib/analytics.ts`): sin `NEXT_PUBLIC_POSTHOG_KEY` todo es no-op con un solo aviso;
se respeta `navigator.doNotTrack`; `person_profiles: identified_only`; `identify(user.id)` sin email;
autocapture apagado (solo eventos con nombre); pageviews por `history_change` para el App Router.

**Variables.** Producción ya tiene `NEXT_PUBLIC_POSTHOG_KEY` y `NEXT_PUBLIC_POSTHOG_HOST`. Preview no las
tiene: los previews no miden (a propósito hasta que Victor decida si quiere un proyecto de PostHog aparte
o el mismo con la propiedad `$host` como filtro). `RESEND_AUDIENCE_ID` no existe todavía en ningún
ambiente; el helper avisa una vez y sigue.

## 4 · Eventos

Todos los eventos llevan además lo que PostHog añade solo (`$current_url`, `$referrer`, `$session_id`,
`$device_type`). Los del servidor llevan `source_runtime: "server"`.

| Evento | Cuándo | Propiedades | Dónde se dispara |
|---|---|---|---|
| `roast_started` | al enviar el formulario del roast | `industry`, `company_size`, `has_url`, `has_description` | `src/app/roast/page.tsx` `handleSubmit` |
| `roast_completed` | al mostrar el resultado (API o fallback) | `industry`, `overall`, `source` (`claude` \| `fallback` \| `client_fallback` \| `unknown`) | `src/app/roast/page.tsx` |
| `roast_shared` | clic en X, LinkedIn, WhatsApp, copiar enlace o descargar imagen | `channel` (`x` \| `linkedin` \| `whatsapp` \| `copy_link` \| `download_square` \| `download_story`), `overall` | `src/app/roast/page.tsx` `SocialSharePanel` |
| `roast_email_submitted` | al dejar el correo para ver el reporte completo | `industry`, `overall` | `src/app/roast/page.tsx` (gate de email) |
| `signup_completed` | primer login de un usuario nuevo (ventana 24 h sin fila previa en `attribution_events`) | `provider` (`google` \| `email`), `signup_source`, `utm_source`, `utm_medium`, `utm_campaign`, `locale`, `has_company`, `has_role` | `src/app/auth/callback/route.ts` (servidor) |
| `login_completed` | cualquier otro login | `provider` | `src/app/auth/callback/route.ts` (servidor) |
| `prompt_opened` | al renderizar el cuerpo de un prompt (no cuenta el bloqueado por tier ni el tope) | `prompt_id`, `prompt_tier`, `used`, `limit`, `tier` (`anon` \| `free` \| `pro` \| `enterprise`), `locale` | `src/app/[locale]/(marketing)/prompts/[id]/page.tsx` |
| `free_limit_reached` | al renderizar la pantalla de tope | `prompt_id`, `tier`, `signed_in`, `locale` | misma página, rama `limitHit` |
| `limit_cta_clicked` | clic en un CTA de la pantalla de tope | `cta` (`pricing` \| `library` \| `signup`), `prompt_id`, `locale` | `src/app/[locale]/(marketing)/prompts/[id]/PromptLimitReached.tsx` |
| `prompt_copied` | clic en Copiar | `prompt_id`, `prompt_tier`, `locale` | `src/app/[locale]/(marketing)/prompts/[id]/CopyButton.tsx` |
| `search_performed` | respuesta de `/api/search` (ok o error) | `lang`, `query_length`, `results_count`, `ok` | `src/app/[locale]/(marketing)/prompts/SmartSearch.tsx` |
| `favorite_added` | favorito guardado con éxito (quitar no cuenta) | `prompt_id` | `src/app/[locale]/(marketing)/prompts/[id]/FavoriteButton.tsx` |
| `pricing_viewed` | al montar `/[locale]/pricing` | `locale`, `signed_in` | `src/app/[locale]/(marketing)/pricing/page.tsx` |
| `checkout_started` | clic en el CTA de Pro, antes de crear la sesión de Stripe | `plan` (`pro`), `price_usd`, `locale`, `signed_in` | `src/app/[locale]/(marketing)/pricing/ProCheckoutButton.tsx` |

Lo que **no** se manda a PostHog: email, nombre, empresa, rol, el texto de las búsquedas, el cuerpo de los
prompts, el referrer completo (solo lo que PostHog captura por su cuenta como `$referrer`).

## 5 · Atribución del signup

1. `src/proxy.ts` pone la cookie `asai_utm` en la **primera** petición de un navegador sin ella: `utm_*`,
   `referrer` (origen + path del referrer externo, sin query), `landing_path` y `ts`. 30 días, no httpOnly.
   Primer toque: no se sobreescribe.
2. `LoginForm` la lee y la manda con Empresa, Rol y `signup_locale` en `options.data` del magic link. El
   trigger `handle_new_user` (migración 0010) copia todo a `profiles` y pone `preferred_language`.
3. Google no admite `options.data`: `LoginForm` deja Empresa, Rol y locale en la cookie `asai_signup`
   (15 min) y `/auth/callback` completa `profiles` con esa cookie más `asai_utm`.
4. `/auth/callback` escribe una fila `signup` en `attribution_events` (`source` = proveedor, `source_detail`
   = `signup_source`, `utm_*`, `metadata` con el resto) y dispara `signup_completed`.

`profiles.signup_source` = `utm_source` si hubo campaña, si no el host del referrer, si no `direct`.

Consulta de referencia:

```sql
select coalesce(signup_source, 'sin dato') as origen, signup_locale, count(*)
from profiles
where created_at >= now() - interval '30 days'
group by 1, 2 order by 3 desc;
```

## 6 · Cómo verificar que funciona

- Cookie: `curl -sI 'https://creative.artostudio.ai/en?utm_source=x&utm_campaign=y' | grep -i set-cookie`
  debe traer `asai_utm=` con esos valores.
- PostHog: en el HTML de producción aparece el chunk de `posthog-js` y el navegador hace peticiones a
  `us.i.posthog.com/e/`. En PostHog → Activity, los eventos llegan con nombre y propiedades de la tabla §4.
- Vercel: en el HTML están los scripts `/_vercel/insights/script.js` y `/_vercel/speed-insights/script.js`.
- Base: `select column_name from information_schema.columns where table_name = 'profiles' and column_name in ('company','role','signup_source','utm_source','signup_locale');` devuelve las cinco.
