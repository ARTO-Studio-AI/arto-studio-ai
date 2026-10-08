import { loadEnv } from "./lib/env.mjs";
loadEnv();

import {
  db, closeDb, getConfigNumber, getEnabledSources, markSourceRun,
  startRun, finishRun, emitSignal, insertProspect, loadExisting,
} from "./lib/db.mjs";
import { buildExistingIndex, isDuplicate, domainOf, normalizeCompany } from "./lib/dedup.mjs";
import { makeScorer } from "./lib/score.mjs";
import { fetchRss } from "./adapters/rss.mjs";
import { fetchGoogleNews } from "./adapters/googleNews.mjs";
import { fetchCompetitorHtml } from "./adapters/competitorHtml.mjs";
import { fetchSocial } from "./adapters/social.mjs";

/* ───────── args ───────── */
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = getArg("--limit") ? parseInt(getArg("--limit"), 10) : Infinity;
const ONLY_SOURCE = getArg("--source");
const DRY_RUN = args.includes("--dry-run"); // fetch + score, do NOT insert
const RUN_TYPE = args.includes("--scheduled") ? "scheduled" : DRY_RUN ? "dry_run" : "manual";
const SCORE_THRESHOLD = getArg("--threshold") ? Number(getArg("--threshold")) : 45;

const ADAPTERS = {
  rss: fetchRss,
  google_news: fetchGoogleNews,
  competitor_html: fetchCompetitorHtml,
  social: fetchSocial,
};
// Map adapter type -> an allowed outreach_targets.source value (CHECK constraint).
// Precise origin (rss vs google_news vs competitor) is preserved in metadata.source_type.
// A later migration can introduce dedicated scraped_news/scraped_competitor tags.
const SOURCE_TAG = {
  rss: "scraped_other",
  google_news: "scraped_other",
  competitor_html: "scraped_other",
  social: "scraped_linkedin",
};

function log(...a) { console.log(new Date().toISOString(), ...a); }

async function main() {
  const t0 = Date.now();
  db();
  const cap = await getConfigNumber("scraper_nightly_usd_cap", 0.5);
  log(`scraper start — runType=${RUN_TYPE} limit=${LIMIT} threshold=${SCORE_THRESHOLD} cap=$${cap} dryRun=${DRY_RUN}`);

  const runId = await startRun({ runType: RUN_TYPE });
  const scorer = makeScorer();
  log(`run ${runId} — model ${scorer.model}`);

  const summary = { sources: [], inserted: [], capped: false };
  let processed = 0, succeeded = 0, failed = 0;

  try {
    const sources = await getEnabledSources(ONLY_SOURCE);
    log(`${sources.length} source(s) to scan`);

    // 1. Fetch candidates from every source (adapter failures → signal + skip).
    let candidates = [];
    for (const src of sources) {
      const adapter = ADAPTERS[src.type];
      if (!adapter) { log(`  ! unknown source type ${src.type}`); continue; }
      try {
        const items = await adapter(src);
        candidates.push(...items.map((it) => ({ ...it, source_id: src.id, source_type: src.type, source_db_name: src.name })));
        summary.sources.push({ name: src.name, type: src.type, items: items.length });
        log(`  ✓ ${src.name}: ${items.length} items`);
        await markSourceRun(src.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`  ✗ ${src.name}: ${msg}`);
        summary.sources.push({ name: src.name, type: src.type, error: msg });
        await emitSignal({
          signalType: "scrape_blocked", severity: "warning",
          message: `Source "${src.name}" failed: ${msg}`.slice(0, 300),
          payload: { source_id: src.id, type: src.type },
        });
      }
    }

    // 2. Cheap pre-dedup by exact article URL (NOT domain — many items share a
    //    publication domain like news.google.com / techcrunch.com). Round-robin
    //    across sources so a small --limit samples every source, not just the
    //    first. Real company/domain dedup happens post-extraction (step 3).
    const existing = buildExistingIndex(await loadExisting());
    const bySource = new Map();
    for (const c of candidates) {
      if (!bySource.has(c.source_id)) bySource.set(c.source_id, []);
      bySource.get(c.source_id).push(c);
    }
    const buckets = [...bySource.values()];
    const seenUrls = new Set();
    const queue = [];
    let bi = 0, drained = 0;
    while (queue.length < LIMIT && drained < buckets.length) {
      const bucket = buckets[bi % buckets.length];
      bi += 1;
      if (bucket.length === 0) { drained += 1; continue; }
      drained = 0;
      const c = bucket.shift();
      const url = (c.url || "").trim();
      if (url && seenUrls.has(url)) continue; // same article twice in this batch
      if (url) seenUrls.add(url);
      queue.push({ ...c, articleDomain: domainOf(c.url) });
    }
    log(`${candidates.length} fetched → ${queue.length} queued (round-robin, limit ${LIMIT})`);

    // 3. Score + insert under budget cap.
    for (const item of queue) {
      if (scorer.state.spentUsd + scorer.estNextUsd() > cap) {
        summary.capped = true;
        log(`budget cap $${cap} reached (spent $${scorer.state.spentUsd.toFixed(4)}). stopping.`);
        await emitSignal({
          signalType: "budget_warning", severity: "warning",
          message: `Scraper hit nightly cap $${cap} after ${scorer.state.calls} scores; ${queue.length - processed} candidates left unscored.`,
          payload: { cap, spent_usd: scorer.state.spentUsd, scored: scorer.state.calls },
        });
        break;
      }
      processed += 1;
      let verdict;
      try {
        verdict = await scorer.score(item);
      } catch (e) {
        failed += 1;
        log(`  score error: ${e instanceof Error ? e.message : e}`);
        continue;
      }
      if (!verdict?.is_prospect || !verdict.company || (verdict.score ?? 0) < SCORE_THRESHOLD) {
        log(`  – skip (${verdict?.score ?? 0}) ${verdict?.company || item.title.slice(0, 40)}`);
        continue;
      }
      // Final dedup by normalized company name (post-extraction). We don't know
      // the prospect's real domain from a headline, so name is the key.
      if (isDuplicate(existing, { company: verdict.company, domain: null })) {
        log(`  – dup ${verdict.company}`);
        continue;
      }
      existing.companies.add(normalizeCompany(verdict.company));
      const prospect = {
        company: verdict.company,
        name: verdict.person_name || null,
        vertical: verdict.vertical || null,
        country: verdict.country || null,
        language: verdict.language === "es" ? "es" : "en",
        source: SOURCE_TAG[item.source_type] || "scraped_other",
        profile_url: item.url || null,
        score: Math.round(verdict.score),
        reasoning: verdict.reasoning || null,
        metadata: {
          discovered_at: new Date().toISOString(),
          scraper_run_id: runId,
          source_id: item.source_id,
          source_name: item.source_db_name,
          source_type: item.source_type,
          raw_title: item.title,
          article_domain: item.articleDomain || null,
        },
      };
      if (DRY_RUN) {
        log(`  ✓ [dry] ${verdict.score} ${prospect.company} (${prospect.vertical}, ${prospect.country})`);
      } else {
        const id = await insertProspect(prospect);
        log(`  ✓ ${verdict.score} ${prospect.company} → ${id}`);
        summary.inserted.push({ company: prospect.company, score: prospect.score });
      }
      succeeded += 1;
    }

    await finishRun(runId, {
      status: summary.sources.some((s) => s.error) ? "partial" : "success",
      summary,
      items_processed: processed,
      items_succeeded: succeeded,
      items_failed: failed,
      cost_usd: Number(scorer.state.spentUsd.toFixed(6)),
      tokens_input: scorer.state.tokensIn,
      tokens_output: scorer.state.tokensOut,
      duration_ms: Date.now() - t0,
    });
    log(`done — scored ${scorer.state.calls}, ${DRY_RUN ? "would insert" : "inserted"} ${succeeded}, cost $${scorer.state.spentUsd.toFixed(4)}, ${Date.now() - t0}ms`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("FATAL:", msg);
    await finishRun(runId, {
      status: "failed", summary, items_processed: processed,
      items_succeeded: succeeded, items_failed: failed,
      cost_usd: Number(scorer.state.spentUsd.toFixed(6)),
      tokens_input: scorer.state.tokensIn, tokens_output: scorer.state.tokensOut,
      duration_ms: Date.now() - t0, error_message: msg.slice(0, 500),
    });
    await emitSignal({ signalType: "module_error", severity: "critical", message: `Scraper run failed: ${msg}`.slice(0, 300), payload: { run_id: runId } });
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

main().finally(() => {
  // The Anthropic SDK (undici) keeps keep-alive sockets open, so the event
  // loop never drains and the process would hang after work completes. Force a
  // clean exit so the nightly cron doesn't leave lingering node processes.
  process.exit(process.exitCode ?? 0);
});
