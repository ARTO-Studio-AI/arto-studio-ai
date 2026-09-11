-- 0006_revoke_anon_2026-09-11.sql
-- Aplicado en produccion el 2026-09-11 08:30 Madrid por Code, segunda capa del hotfix 0005.
-- Con RLS activo y sin politicas, anon y authenticated ya no leian nada por REST; este
-- revoke quita ademas los grants (238 filas de privilegios en 17 tablas), para que una
-- politica futura mal escrita no vuelva a abrirlas. Verificado despues: GET /rest/v1/clients
-- con la anon key responde 401 (42501); prompts conserva su SELECT y responde 200.
begin;
revoke all on table public._engine_migrations   from anon, authenticated;
revoke all on table public._migrations_applied  from anon, authenticated;
revoke all on table public.agent_social_log     from anon, authenticated;
revoke all on table public.attribution_events   from anon, authenticated;
revoke all on table public.clients              from anon, authenticated;
revoke all on table public.content_gaps         from anon, authenticated;
revoke all on table public.engine_config        from anon, authenticated;
revoke all on table public.engine_runs          from anon, authenticated;
revoke all on table public.engine_signals       from anon, authenticated;
revoke all on table public.outreach_log         from anon, authenticated;
revoke all on table public.outreach_targets     from anon, authenticated;
revoke all on table public.prompt_queue         from anon, authenticated;
revoke all on table public.rate_limits          from anon, authenticated;
revoke all on table public.roast_traces         from anon, authenticated;
revoke all on table public.scraping_sources     from anon, authenticated;
revoke all on table public.skill_traces         from anon, authenticated;
revoke all on table public.waitlist             from anon, authenticated;
notify pgrst, 'reload schema';
commit;
