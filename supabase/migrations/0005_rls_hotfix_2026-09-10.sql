-- 0005_rls_hotfix_2026-09-10.sql
-- Aplicado en producción el 2026-09-10 (go de Victor, ejecutado por Code, verificado por Fable).
-- 17 tablas del schema public no tenían RLS y tenían grants completos a anon y authenticated:
-- con la anon key pública, GET /rest/v1/clients devolvía las 8 filas con email, tier y hash de API key.
-- Todo el código que lee estas tablas usa el service role o DATABASE_URL (rol postgres, bypassrls),
-- así que activar RLS sin políticas cierra la fuga sin tocar la app.
begin;
alter table public._engine_migrations   enable row level security;
alter table public._migrations_applied  enable row level security;
alter table public.agent_social_log     enable row level security;
alter table public.attribution_events   enable row level security;
alter table public.clients              enable row level security;
alter table public.content_gaps         enable row level security;
alter table public.engine_config        enable row level security;
alter table public.engine_runs          enable row level security;
alter table public.engine_signals       enable row level security;
alter table public.outreach_log         enable row level security;
alter table public.outreach_targets     enable row level security;
alter table public.prompt_queue         enable row level security;
alter table public.rate_limits          enable row level security;
alter table public.roast_traces         enable row level security;
alter table public.scraping_sources     enable row level security;
alter table public.skill_traces         enable row level security;
alter table public.waitlist             enable row level security;
notify pgrst, 'reload schema';
commit;
