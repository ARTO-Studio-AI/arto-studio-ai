import postgres from "postgres";

/* Single postgres-js connection over DATABASE_URL (Supabase). prepare:false
 * matches the rest of the codebase (pgbouncer-friendly). */
let sql = null;
export function db() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  sql = postgres(url, { prepare: false, max: 4 });
  return sql;
}

export async function closeDb() {
  if (sql) await sql.end();
  sql = null;
}

/* Read a numeric engine_config value, falling back to `fallback`. */
export async function getConfigNumber(key, fallback) {
  const s = db();
  try {
    const [row] = await s`SELECT value FROM engine_config WHERE key = ${key}`;
    if (!row) return fallback;
    const v = typeof row.value === "number" ? row.value : Number(row.value);
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export async function getEnabledSources(onlyId) {
  const s = db();
  if (onlyId) {
    return s`SELECT * FROM scraping_sources WHERE id = ${onlyId}`;
  }
  return s`SELECT * FROM scraping_sources WHERE enabled = true ORDER BY type, name`;
}

export async function markSourceRun(id) {
  const s = db();
  await s`UPDATE scraping_sources SET last_run_at = now() WHERE id = ${id}`;
}

/* engine_runs lifecycle */
export async function startRun({ runType }) {
  const s = db();
  const [row] = await s`
    INSERT INTO engine_runs (module, run_type, status, started_at)
    VALUES ('scraper', ${runType}, 'running', now())
    RETURNING id`;
  return row.id;
}

export async function finishRun(id, fields) {
  const s = db();
  await s`
    UPDATE engine_runs SET
      status = ${fields.status},
      summary = ${s.json(fields.summary ?? {})},
      items_processed = ${fields.items_processed ?? 0},
      items_succeeded = ${fields.items_succeeded ?? 0},
      items_failed = ${fields.items_failed ?? 0},
      cost_usd = ${fields.cost_usd ?? 0},
      tokens_input = ${fields.tokens_input ?? 0},
      tokens_output = ${fields.tokens_output ?? 0},
      duration_ms = ${fields.duration_ms ?? null},
      error_message = ${fields.error_message ?? null},
      completed_at = now()
    WHERE id = ${id}`;
}

export async function emitSignal({ signalType, severity = "warning", module = "scraper", message, payload = {} }) {
  const s = db();
  await s`
    INSERT INTO engine_signals (signal_type, severity, module, message, payload, active)
    VALUES (${signalType}, ${severity}, ${module}, ${message ?? null}, ${s.json(payload)}, true)`;
}

/* Insert a discovered prospect into outreach_targets (status pending). */
export async function insertProspect(p) {
  const s = db();
  const [row] = await s`
    INSERT INTO outreach_targets
      (email, name, company, vertical, country, language, source, profile_url,
       legitimate_interest_score, legitimate_interest_reasoning, status, include_in_send, metadata, created_at)
    VALUES
      (${p.email ?? null}, ${p.name ?? null}, ${p.company}, ${p.vertical ?? null},
       ${p.country ?? null}, ${p.language ?? "en"}, ${p.source}, ${p.profile_url ?? null},
       ${p.score ?? null}, ${p.reasoning ?? null}, 'pending', true, ${s.json(p.metadata ?? {})}, now())
    RETURNING id`;
  return row.id;
}

/* Existing companies/domains/emails for dedup. */
export async function loadExisting() {
  const s = db();
  const rows = await s`
    SELECT company, email, profile_url, metadata FROM outreach_targets`;
  return rows;
}
