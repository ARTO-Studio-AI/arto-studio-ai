# arto-scraper — Module 4b prospect discovery

Nightly job that discovers new B2B prospects for ARTO, scores each by
legitimate-interest with Claude, and writes them into Supabase
`outreach_targets` (status `pending`) so they flow into the existing
`/admin/outreach` review → draft → send pipeline.

**Source of truth:** `arto-studio-ai/infra/arto-scraper/` (this dir in the repo).
**Runs on:** Mac Mini at `~/Projects/arto-scraper/` via launchd cron `com.arto.scraper`.

## How it works
1. Reads enabled rows from `scraping_sources` (Supabase).
2. Per source, an adapter fetches candidate items:
   - `rss` — design/industry RSS feeds
   - `google_news` — Google News RSS search (query in `url`, locale in `config`)
   - `competitor_html` — public competitor work/clients pages (cheerio)
   - `social` — DISABLED; only via an official paid API key in `config.apiKey`
3. Pre-dedups by URL domain vs existing `outreach_targets`.
4. Claude (`claude-haiku-4-5`) scores each candidate's fit + extracts company,
   vertical, country, language, reasoning. Stops before exceeding
   `engine_config.scraper_nightly_usd_cap` (default $0.50) and emits a
   `budget_warning` signal.
5. Inserts prospects scoring >= threshold (default 45) as `status='pending'`.
6. Logs one `engine_runs` row; `scrape_blocked` signal on adapter failure.

## Run
```bash
node scrape.mjs                 # full run (manual)
node scrape.mjs --limit 8       # tiny first run
node scrape.mjs --dry-run       # fetch + score, do NOT insert
node scrape.mjs --source <uuid> # single source
node scrape.mjs --threshold 50  # min score to insert
node scrape.mjs --scheduled     # used by launchd
```

## Env (`.env.local`, not committed)
`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, optional `SCRAPER_MODEL`.

## Cron
`com.arto.scraper.plist` → `~/Library/LaunchAgents/`. Runs daily 03:30.
`launchctl load|unload ~/Library/LaunchAgents/com.arto.scraper.plist`.
Logs: `/tmp/arto-scraper.log`, `/tmp/arto-scraper.err.log`.
