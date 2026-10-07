import postgres from "postgres";

/**
 * Roast + skill trace persistence.
 * Backed by Supabase Postgres (same project as asai-prompt-library + asai-engine).
 * Schema lives in asai-engine/migrations/002_arto_consolidation.sql.
 */

export interface RoastTrace {
  id?: number;
  brand_name: string;
  industry: string;
  company_size: string | null;
  website_url: string | null;
  description: string | null;
  overall_score: number;
  strategy_score: number;
  creativity_score: number;
  narrative_score: number;
  digital_score: number;
  strategy_roast: string;
  creativity_roast: string;
  narrative_roast: string;
  digital_roast: string;
  verdict: string;
  improvements: string[];
  source: "ai" | "fallback";
  model: string;
  latency_ms: number;
  email: string | null;
  created_at?: string;
}

let cached: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = postgres(url, { ssl: "require", max: 5, prepare: false });
  return cached;
}

export async function saveTrace(trace: RoastTrace): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  try {
    await sql`
      INSERT INTO roast_traces (
        brand_name, industry, company_size, website_url, description,
        overall_score, strategy_score, creativity_score, narrative_score, digital_score,
        strategy_roast, creativity_roast, narrative_roast, digital_roast,
        verdict, improvements, source, model, latency_ms, email
      ) VALUES (
        ${trace.brand_name}, ${trace.industry}, ${trace.company_size},
        ${trace.website_url}, ${trace.description},
        ${trace.overall_score}, ${trace.strategy_score}, ${trace.creativity_score},
        ${trace.narrative_score}, ${trace.digital_score},
        ${trace.strategy_roast}, ${trace.creativity_roast},
        ${trace.narrative_roast}, ${trace.digital_roast},
        ${trace.verdict}, ${sql.json(trace.improvements as never)},
        ${trace.source}, ${trace.model}, ${trace.latency_ms}, ${trace.email}
      )
    `;
    return true;
  } catch (error) {
    console.error("[trace-store] Failed to save trace:", error);
    return false;
  }
}

export async function getTraces(options?: {
  limit?: number;
  offset?: number;
  industry?: string;
}): Promise<RoastTrace[]> {
  const sql = getDb();
  if (!sql) return [];
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  try {
    if (options?.industry) {
      const rows = await sql`
        SELECT * FROM roast_traces
        WHERE industry = ${options.industry}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows as unknown as RoastTrace[];
    }

    const rows = await sql`
      SELECT * FROM roast_traces
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows as unknown as RoastTrace[];
  } catch (error) {
    console.error("[trace-store] Failed to query traces:", error);
    return [];
  }
}

/* ─────────────────────────────────────────────────────────
 * Generic skill traces
 * ───────────────────────────────────────────────────────── */

export interface SkillTrace {
  id?: number;
  skill_slug: string;
  client_id: string | null;
  input: unknown;
  output: unknown;
  source: "ai" | "fallback";
  model: string;
  latency_ms: number;
  email: string | null;
  created_at?: string;
}

/** Devuelve el id de la traza (o null si no se pudo guardar). Desde 2026-10-07 el id se
 *  usa para el token del correo del roast; los demas llamadores ignoran el valor. */
export async function saveSkillTrace(trace: SkillTrace): Promise<number | null> {
  const sql = getDb();
  if (!sql) return null;
  try {
    const [row] = await sql`
      INSERT INTO skill_traces (
        skill_slug, client_id, input, output, source, model, latency_ms, email
      ) VALUES (
        ${trace.skill_slug}, ${trace.client_id},
        ${sql.json(trace.input as never)}, ${sql.json(trace.output as never)},
        ${trace.source}, ${trace.model}, ${trace.latency_ms}, ${trace.email}
      )
      RETURNING id
    `;
    return typeof row?.id === "number" ? row.id : null;
  } catch (error) {
    console.error("[trace-store] Failed to save skill trace:", error);
    return null;
  }
}

export async function getSkillTraces(options?: {
  skillSlug?: string;
  clientId?: string;
  limit?: number;
  offset?: number;
}): Promise<SkillTrace[]> {
  const sql = getDb();
  if (!sql) return [];
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  try {
    if (options?.skillSlug && options?.clientId) {
      const rows = await sql`
        SELECT * FROM skill_traces
        WHERE skill_slug = ${options.skillSlug} AND client_id = ${options.clientId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows as unknown as SkillTrace[];
    }
    if (options?.skillSlug) {
      const rows = await sql`
        SELECT * FROM skill_traces
        WHERE skill_slug = ${options.skillSlug}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows as unknown as SkillTrace[];
    }
    if (options?.clientId) {
      const rows = await sql`
        SELECT * FROM skill_traces
        WHERE client_id = ${options.clientId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return rows as unknown as SkillTrace[];
    }
    const rows = await sql`
      SELECT * FROM skill_traces
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows as unknown as SkillTrace[];
  } catch (error) {
    console.error("[trace-store] Failed to query skill traces:", error);
    return [];
  }
}

export async function getSkillStats(): Promise<{
  total: number;
  bySkill: { skill_slug: string; count: number; avgLatency: number }[];
  bySource: { ai: number; fallback: number };
} | null> {
  const sql = getDb();
  if (!sql) return null;

  try {
    const [totals] = await sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE source = 'ai')::int as ai_count,
        COUNT(*) FILTER (WHERE source = 'fallback')::int as fallback_count
      FROM skill_traces
    `;
    const bySkill = await sql`
      SELECT
        skill_slug,
        COUNT(*)::int as count,
        ROUND(AVG(latency_ms)::numeric, 0)::int as avg_latency
      FROM skill_traces
      GROUP BY skill_slug
      ORDER BY count DESC
    `;
    return {
      total: totals.total,
      bySource: { ai: totals.ai_count, fallback: totals.fallback_count },
      bySkill: bySkill as unknown as { skill_slug: string; count: number; avgLatency: number }[],
    };
  } catch (error) {
    console.error("[trace-store] Failed to get skill stats:", error);
    return null;
  }
}

export async function getTraceStats(): Promise<{
  total: number;
  avgOverall: number;
  bySource: { ai: number; fallback: number };
  byIndustry: { industry: string; count: number; avgScore: number }[];
} | null> {
  const sql = getDb();
  if (!sql) return null;

  try {
    const [totals] = await sql`
      SELECT
        COUNT(*)::int as total,
        COALESCE(AVG(overall_score), 0) as avg_overall,
        COUNT(*) FILTER (WHERE source = 'ai')::int as ai_count,
        COUNT(*) FILTER (WHERE source = 'fallback')::int as fallback_count
      FROM roast_traces
    `;

    const byIndustry = await sql`
      SELECT
        industry,
        COUNT(*)::int as count,
        ROUND(AVG(overall_score)::numeric, 1) as avg_score
      FROM roast_traces
      GROUP BY industry
      ORDER BY count DESC
      LIMIT 20
    `;

    return {
      total: totals.total,
      avgOverall: Math.round(totals.avg_overall * 10) / 10,
      bySource: { ai: totals.ai_count, fallback: totals.fallback_count },
      byIndustry: byIndustry as unknown as { industry: string; count: number; avgScore: number }[],
    };
  } catch (error) {
    console.error("[trace-store] Failed to get stats:", error);
    return null;
  }
}
