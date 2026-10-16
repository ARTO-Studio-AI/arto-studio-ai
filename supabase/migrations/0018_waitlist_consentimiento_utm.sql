-- 0018_waitlist_consentimiento_utm.sql
-- Lista de espera del Pack ARTO con consentimiento y primer toque (16 oct 2026).
--
-- /api/waitlist guardaba solo email y source: sin prueba de la casilla de promociones,
-- sin idioma y sin UTM, asi que la campana de lanzamiento ARTO x TIVC no podia medir
-- de que canal llega cada correo. Desde el PR fix/waitlist-pack-consentimiento la ruta
-- escribe estas columnas en cada alta.
--
-- ORDEN: aplicar ANTES de mergear el PR. La ruta nueva inserta estas columnas; sin ellas
-- el insert falla y la ruta responde 500 (ya no responde ok cuando falla la base).
--
-- Solo agrega columnas nullable o con default constante (sin reescritura de la tabla en
-- Postgres 11+). Las filas existentes quedan con marketing_opt_in = false: nunca
-- aceptaron promociones. RLS ya esta activo en la tabla (0005) y sin grants a anon (0006).
-- Termina con notify pgrst (regla de CLAUDE.md).
begin;

set local lock_timeout = '5s';

alter table public.waitlist
  add column if not exists locale text,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists consent_version text,
  add column if not exists consent_at timestamptz,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists referrer text,
  add column if not exists landing_path text,
  add column if not exists first_touch_at timestamptz;

comment on column public.waitlist.marketing_opt_in is
  'Marco la casilla de promociones en NewsletterForm. Es la peticion; el alta real en la lista es newsletter_subscribers tras el doble opt-in.';
comment on column public.waitlist.consent_version is
  'WAITLIST_CONSENT_VERSION (src/lib/waitlist.ts) del texto que vio, solo si marco la casilla.';
comment on column public.waitlist.consent_at is
  'Hora del servidor en que marco la casilla.';
comment on column public.waitlist.first_touch_at is
  'ts de la cookie asai_utm (primer toque). Null si no acepto la analitica o entro directo sin cookie.';

commit;

notify pgrst, 'reload schema';
