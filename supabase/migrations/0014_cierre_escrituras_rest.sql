-- 0014_cierre_escrituras_rest.sql
-- Cierra dos huecos de escritura por REST encontrados en el diagnostico de /admin
-- (2026-10-12, verificados con consultas de solo lectura contra produccion):
--
--   1. profiles: la politica «Users can update own profile» es FOR UPDATE USING
--      (auth.uid() = id) sin WITH CHECK ni limite de columnas, y authenticated tiene
--      UPDATE sobre todas las columnas. Cualquier usuario con sesion podia hacer
--      PATCH /rest/v1/profiles?id=eq.<suyo> con {"tier":"pro","is_admin":true} y darse
--      Pro gratis, saltarse el tope diario (prompts_viewed_today) o leer por RLS lo
--      que esta abierto a is_admin. Nadie lo uso: los 4 perfiles no free salen de
--      email_tier_grants.
--   2. newsletter_subscribers: «anyone can subscribe themselves» (INSERT WITH CHECK
--      true) y «anyone can unsubscribe with valid token» (UPDATE USING true, sin mirar
--      el token). Con la anon key publica, cualquiera podia meter correos ajenos como
--      active o dar de baja a toda la lista.
--
-- La app nunca escribe en estas tablas con la sesion del usuario: todo pasa por el
-- service role (auth/callback, marketing-list, stripe webhook, unsubscribe, digest,
-- resend webhook). handle_new_user es SECURITY DEFINER y no depende de estos grants.
--
-- Ademas, como defensa en profundidad, se quitan los privilegios de escritura que
-- anon y authenticated conservaban en tablas que ya estaban cerradas por RLS (sin
-- politicas de escritura). TRUNCATE no respeta RLS, por eso tambien se revoca.
-- Se conservan: SELECT de prompts (catalogo publico) y de profiles para authenticated
-- (cada quien ve el suyo), y el manejo de favorites y collections por su dueno.
begin;

-- 1. profiles: solo lectura del propio perfil.
drop policy if exists "Users can update own profile" on public.profiles;
revoke all on table public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on table public.profiles from authenticated;

-- 2. newsletter_subscribers: solo el servidor.
drop policy if exists "anyone can subscribe themselves" on public.newsletter_subscribers;
drop policy if exists "anyone can unsubscribe with valid token" on public.newsletter_subscribers;
revoke all on table public.newsletter_subscribers from anon, authenticated;

-- 3. Defensa en profundidad en tablas sin politicas de escritura.
revoke insert, update, delete, truncate, references, trigger on table
  public.email_tier_grants, public.purchases, public.prompts, public.content_items,
  public.outreach_drafts, public.courses, public.search_queries, public.user_sessions
  from anon, authenticated;
revoke all on table public.email_tier_grants, public.purchases from anon;

-- 4. favorites y collections: el dueno las maneja con su sesion; anon no.
revoke all on table public.favorites, public.collections from anon;
revoke truncate, references, trigger on table public.favorites, public.collections from authenticated;

notify pgrst, 'reload schema';
commit;

-- Verificacion despues de aplicar (todas deben dar false):
--   select has_table_privilege('authenticated', 'public.profiles', 'UPDATE');
--   select has_table_privilege('anon', 'public.newsletter_subscribers', 'UPDATE');
--   select has_table_privilege('anon', 'public.newsletter_subscribers', 'INSERT');
--   select has_table_privilege('authenticated', 'public.email_tier_grants', 'INSERT');
-- Y estas true:
--   select has_table_privilege('authenticated', 'public.profiles', 'SELECT');
--   select has_table_privilege('anon', 'public.prompts', 'SELECT');
--   select has_table_privilege('authenticated', 'public.favorites', 'INSERT');
