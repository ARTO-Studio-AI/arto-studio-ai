-- 0017_texto_de_prompts_solo_servidor.sql
-- Cierra la lectura del texto de los prompts y la ejecucion de funciones por la API publica
-- (2026-10-12). Verificado en produccion, solo lectura: con la anon key publica,
-- GET /rest/v1/prompts?select=prompt_en&tier=eq.pro devolvia el texto completo de los
-- prompts Pro (FT-0051, 1,069 caracteres), igual que POST /rest/v1/rpc/search_prompts
-- (SECURITY DEFINER, SETOF prompts). Cualquiera se saltaba el plan Pro sin pagar.
--
-- APLICAR SOLO DESPUES de desplegar el codigo de este PR: getPrompt() ya lee el texto con
-- service role. Si se aplica antes, la ficha de cada prompt da error.
begin;

-- 1. prompts: anon y authenticated leen todo menos el texto, el embedding y los tsvector.
revoke select on table public.prompts from anon, authenticated;
grant select (
  id, title_en, title_es, category, subcategory, ai_model, difficulty, tags, tier, version,
  author, use_case, expected_output, view_count, copy_count, favorite_count, is_published,
  created_at, updated_at, is_featured, featured_at, featured_reason
) on table public.prompts to anon, authenticated;

-- 2. Funciones de public: nadie las ejecuta por /rest/v1/rpc salvo el servidor. Las de
--    trigger (handle_new_user, apply_grant_retro) siguen disparandose: el EXECUTE solo se
--    revisa al crear el trigger, no al dispararlo.
revoke execute on function public.search_prompts(text, text, text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.bump_rate_limit(text) from public, anon, authenticated;
revoke execute on function public.increment_prompt_copy(text) from public, anon, authenticated;
revoke execute on function public.increment_prompt_view(text) from public, anon, authenticated;
revoke execute on function public.user_can_access_pro(uuid) from public, anon, authenticated;
revoke execute on function public.match_prompts(vector, integer) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.apply_grant_retro() from public, anon, authenticated;
grant execute on function public.search_prompts(text, text, text, text, text, integer, integer), public.bump_rate_limit(text),
  public.increment_prompt_copy(text), public.increment_prompt_view(text), public.user_can_access_pro(uuid),
  public.match_prompts(vector, integer) to service_role;

notify pgrst, 'reload schema';
commit;

-- Verificacion con la anon key (despues de aplicar):
--   GET  /rest/v1/prompts?select=prompt_en&limit=1          -> 403 (42501, permission denied for column)
--   GET  /rest/v1/prompts?select=id,title_es,tier&limit=1    -> 200
--   POST /rest/v1/rpc/search_prompts {"search_query":"x"}    -> 401 o 403
-- Y el sitio: /es/prompts, una ficha /es/prompts/BR-0001, la busqueda y /es/favorites.
