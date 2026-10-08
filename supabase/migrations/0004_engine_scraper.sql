-- 0004_engine_scraper.sql
-- Module 4b: engine schema behind /admin/engine/* + the nightly prospect scraper.
-- Column shapes mirror src/lib/engine-store.ts exactly so the dashboards render
-- with no app-code change. outreach_targets already exists (created out-of-band +
-- 0002_outreach_dashboard.sql) so it is NOT recreated here.
-- Idempotent: CREATE TABLE IF NOT EXISTS + ON CONFLICT seeds.

create extension if not exists pgcrypto;

-- ───────────────────────── engine_runs ─────────────────────────
create table if not exists engine_runs (
  id              uuid primary key default gen_random_uuid(),
  module          text not null,            -- 'scraper' | 'outreach' | 'content' | 'social' | 'intelligence'
  run_type        text not null,            -- 'scheduled' | 'manual' | 'triggered' | 'dry_run'
  status          text not null,            -- 'running' | 'success' | 'partial' | 'failed' | 'paused'
  summary         jsonb not null default '{}'::jsonb,
  items_processed integer not null default 0,
  items_succeeded integer not null default 0,
  items_failed    integer not null default 0,
  cost_usd        numeric not null default 0,
  tokens_input    integer not null default 0,
  tokens_output   integer not null default 0,
  duration_ms     integer,
  error_message   text,
  session_id      text,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists engine_runs_started_idx on engine_runs (started_at desc);
create index if not exists engine_runs_module_idx  on engine_runs (module);

-- ───────────────────────── engine_signals ─────────────────────────
create table if not exists engine_signals (
  id            uuid primary key default gen_random_uuid(),
  signal_type   text not null,              -- 'scrape_blocked' | 'budget_warning' | ...
  severity      text not null default 'info', -- 'info' | 'warning' | 'critical'
  module        text,
  payload       jsonb not null default '{}'::jsonb,
  message       text,
  active        boolean not null default true,
  snoozed_until timestamptz,
  escalated_at  timestamptz,
  resolved_at   timestamptz,
  resolved_by   text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz
);
create index if not exists engine_signals_active_idx on engine_signals (active, created_at desc);

-- ───────────────────────── content_gaps ─────────────────────────
create table if not exists content_gaps (
  id                    uuid primary key default gen_random_uuid(),
  query_pattern         text not null,
  frequency             integer not null default 1,
  avg_similarity        numeric,
  suggested_vertical    text,
  status                text not null default 'open', -- 'open' | 'in_progress' | 'resolved' | 'dismissed'
  resolved_by_prompt_id text,
  created_at            timestamptz not null default now(),
  resolved_at           timestamptz
);

-- ───────────────────────── agent_social_log ─────────────────────────
create table if not exists agent_social_log (
  id            uuid primary key default gen_random_uuid(),
  run_date      date not null default current_date,
  prompt_id     text,
  platform      text not null,              -- 'twitter' | 'linkedin' | 'threads'
  language      text not null,              -- 'en' | 'es'
  post_content  text not null,
  buffer_post_id text,
  status        text not null default 'draft', -- 'draft'|'scheduled'|'published'|'failed'|'skipped'
  error_message text,
  created_at    timestamptz not null default now()
);

-- ───────────────────────── attribution_events ─────────────────────────
create table if not exists attribution_events (
  id            uuid primary key default gen_random_uuid(),
  event_type    text not null,              -- 'click' | 'conversion' | 'signup'
  source        text,
  source_detail text,
  target_id     uuid,
  user_email    text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  value_usd     numeric,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ───────────────────────── engine_config ─────────────────────────
create table if not exists engine_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- ───────────────────────── scraping_sources (NEW) ─────────────────────────
-- Config rows the nightly scraper iterates over. One row per feed / query / page.
create table if not exists scraping_sources (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,                -- 'rss' | 'google_news' | 'competitor_html' | 'social'
  name        text not null,
  url         text,                         -- feed URL, news query string, or page URL
  enabled     boolean not null default true,
  config      jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists scraping_sources_enabled_idx on scraping_sources (enabled);

-- ───────────────────────── seeds ─────────────────────────
insert into engine_config (key, value, description)
values
  ('scraper_nightly_usd_cap', '0.50'::jsonb,
   'Max USD the nightly prospect scraper may spend on Claude scoring per run. Auto-cuts + emits budget_warning.')
on conflict (key) do nothing;

-- Starter sources. RSS + google_news enabled; competitor + social disabled until
-- Victor supplies real competitor URLs / an official social API key.
insert into scraping_sources (type, name, url, enabled, config) values
  ('rss', 'It''s Nice That', 'https://www.itsnicethat.com/rss', true,
     '{"lang":"en","note":"design/culture editorial"}'::jsonb),
  ('rss', 'Creative Bloq', 'https://www.creativebloq.com/feeds.xml', true,
     '{"lang":"en","note":"design industry news"}'::jsonb),
  ('rss', 'TechCrunch', 'https://techcrunch.com/feed/', true,
     '{"lang":"en","note":"funding + launches = prospects needing brand work"}'::jsonb),
  ('google_news', 'Rebrands', 'rebrand OR "new brand identity" OR "unveils new logo"', true,
     '{"lang":"en","hl":"en-US","note":"companies that just rebranded"}'::jsonb),
  ('google_news', 'LATAM funding', '("Series A" OR "ronda semilla" OR "levanta capital") startup México', true,
     '{"lang":"es","hl":"es-419","note":"funded LATAM startups, likely need creative"}'::jsonb),
  ('google_news', 'New creative leadership', '"new creative director" OR "chief brand officer" appointed', true,
     '{"lang":"en","hl":"en-US","note":"brand leadership changes"}'::jsonb),
  ('competitor_html', 'Competitor case studies (CONFIGURE)', 'https://example.com/work', false,
     '{"selector":"a","note":"replace url with real competitor work/clients page, then enable"}'::jsonb),
  ('social', 'LinkedIn (needs official API)', null, false,
     '{"provider":"linkedin","note":"disabled — set config.apiKey with an official LinkedIn API key to enable"}'::jsonb),
  ('social', 'X / Twitter (needs official API)', null, false,
     '{"provider":"x","note":"disabled — set config.apiKey with an official X API key to enable"}'::jsonb)
on conflict do nothing;

-- PostgREST schema cache reload (per project memory: required after DDL via DATABASE_URL).
notify pgrst, 'reload schema';
