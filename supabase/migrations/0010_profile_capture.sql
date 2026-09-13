-- 0010_profile_capture.sql
-- Captacion de signups (Fase 1C del Sprint 1, 13 sep 2026).
--
-- Hasta hoy el registro solo guardaba id, email, full_name y avatar_url. No se sabia
-- de donde venia nadie ni en que idioma se registro (preferred_language quedaba 'en').
-- Esta migracion es solo aditiva:
--   1. Diez columnas nuevas en profiles: empresa y rol (opcionales en LoginForm),
--      origen del registro, los cinco utm_*, referrer y el locale del registro.
--   2. handle_new_user() copia esos campos desde raw_user_meta_data (LoginForm los
--      manda en options.data del magic link; para Google los completa /auth/callback
--      desde la cookie asai_utm) y pone preferred_language desde signup_locale.
--      Todo lo que ya copiaba sigue igual: id, email, full_name, avatar_url, tier e
--      is_admin desde email_tier_grants.
-- Sin drop, sin rename, sin cambiar tipos. Termina con notify pgrst para que
-- PostgREST recargue el esquema (regla de CLAUDE.md).
begin;

alter table public.profiles
  add column if not exists company       text,
  add column if not exists "role"        text,
  add column if not exists signup_source text,
  add column if not exists utm_source    text,
  add column if not exists utm_medium    text,
  add column if not exists utm_campaign  text,
  add column if not exists utm_content   text,
  add column if not exists utm_term      text,
  add column if not exists referrer      text,
  add column if not exists signup_locale text;

comment on column public.profiles.company       is 'Empresa que escribio el usuario al registrarse (opcional).';
comment on column public.profiles."role"        is 'Rol que escribio el usuario al registrarse (opcional).';
comment on column public.profiles.signup_source is 'utm_source de la primera visita, si no el host del referrer, si no direct.';
comment on column public.profiles.referrer      is 'Origen + path del referrer externo de la primera visita, sin query.';
comment on column public.profiles.signup_locale is 'Locale de la pagina de login donde se registro (en | es).';

create or replace function public.handle_new_user() returns trigger
    language plpgsql security definer
    as $$
declare
  granted_tier text;
  granted_admin boolean;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  locale_in text := nullif(trim(meta->>'signup_locale'), '');
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
    nullif(trim(meta->>'company'), ''),
    nullif(trim(meta->>'role'), ''),
    nullif(trim(meta->>'signup_source'), ''),
    nullif(trim(meta->>'utm_source'), ''),
    nullif(trim(meta->>'utm_medium'), ''),
    nullif(trim(meta->>'utm_campaign'), ''),
    nullif(trim(meta->>'utm_content'), ''),
    nullif(trim(meta->>'utm_term'), ''),
    nullif(trim(meta->>'referrer'), ''),
    case when locale_in in ('en', 'es') then locale_in else null end,
    -- preferred_language tiene check (en | es); cualquier otra cosa cae al default.
    case when locale_in in ('en', 'es') then locale_in else 'en' end
  );
  return new;
end;
$$;

notify pgrst, 'reload schema';
commit;
