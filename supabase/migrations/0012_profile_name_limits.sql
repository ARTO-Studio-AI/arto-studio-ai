-- 0012_profile_name_limits.sql
-- Tope de longitud en full_name y avatar_url de handle_new_user() (H-51, 13 sep 2026).
--
-- La 0011 (H-49) puso left() a los campos de captacion, pero dejo sin tope full_name
-- y avatar_url. Los dos salen de raw_user_meta_data, que escribe el cliente, asi que
-- cualquiera puede mandar un nombre de megas y el trigger lo copia entero a profiles.
-- Fable lo comprobo guardando un full_name de 5,000 caracteres.
--
-- La definicion es identica a la que habia en produccion (la de 0011, leida con
-- pg_get_functiondef el 13 sep) salvo dos cambios:
--   1. left(..., 200) en full_name, incluido el fallback a meta->>'name'.
--   2. left(..., 2048) en avatar_url (largo razonable de una URL).
-- Se conservan SECURITY DEFINER y SET search_path = public, pg_temp. Sin drop, sin
-- tocar tablas ni tipos. El trigger on_auth_user_created sigue apuntando a la misma
-- funcion. Termina con notify pgrst (regla de CLAUDE.md).
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
    left(coalesce(meta->>'full_name', meta->>'name'), 200),
    left(meta->>'avatar_url', 2048),
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
