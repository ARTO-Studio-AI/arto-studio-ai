-- 0011_profile_capture_limits.sql
-- Limites de longitud y search_path fijo en handle_new_user() (H-49, 13 sep 2026).
--
-- raw_user_meta_data lo escribe el cliente en signInWithOtp (options.data), asi que
-- cualquiera puede mandar un utm_source de megas y el trigger lo copiaba entero a
-- profiles. La app ya recorta a 200 en src/lib/attribution.ts (cleanValue), pero la
-- base no puede depender de eso. Y siendo SECURITY DEFINER, la funcion no fijaba
-- search_path.
--
-- La definicion es identica a la que habia en produccion (la de 0010, leida con
-- pg_get_functiondef el 13 sep) salvo dos cambios:
--   1. left(..., 200) en company, role, signup_source, utm_* y referrer, y
--      left(..., 10) en signup_locale.
--   2. SET search_path = public, pg_temp.
-- Sin drop, sin tocar tablas ni tipos. El trigger on_auth_user_created sigue
-- apuntando a la misma funcion. Termina con notify pgrst (regla de CLAUDE.md).
begin;

create or replace function public.handle_new_user() returns trigger
    language plpgsql security definer
    set search_path = public, pg_temp
    as $$
declare
  granted_tier text;
  granted_admin boolean;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  locale_in text := left(nullif(trim(meta->>'signup_locale'), ''), 10);
begin
  select tier, is_admin into granted_tier, granted_admin
  from public.email_tier_grants
  where email = new.email;

  insert into public.profiles (
    id, email, full_name, avatar_url, tier, is_admin,
    company, "role", signup_source,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer, signup_locale, preferred_language
  )
  values (
    new.id,
    new.email,
    coalesce(meta->>'full_name', meta->>'name'),
    meta->>'avatar_url',
    coalesce(granted_tier, 'free'),
    coalesce(granted_admin, false),
    left(nullif(trim(meta->>'company'), ''), 200),
    left(nullif(trim(meta->>'role'), ''), 200),
    left(nullif(trim(meta->>'signup_source'), ''), 200),
    left(nullif(trim(meta->>'utm_source'), ''), 200),
    left(nullif(trim(meta->>'utm_medium'), ''), 200),
    left(nullif(trim(meta->>'utm_campaign'), ''), 200),
    left(nullif(trim(meta->>'utm_content'), ''), 200),
    left(nullif(trim(meta->>'utm_term'), ''), 200),
    left(nullif(trim(meta->>'referrer'), ''), 200),
    case when locale_in in ('en', 'es') then locale_in else null end,
    -- preferred_language tiene check (en | es); cualquier otra cosa cae al default.
    case when locale_in in ('en', 'es') then locale_in else 'en' end
  );
  return new;
end;
$$;

notify pgrst, 'reload schema';
commit;
