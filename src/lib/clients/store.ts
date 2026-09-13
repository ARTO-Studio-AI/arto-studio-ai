import postgres from "postgres";
import crypto from "crypto";

/**
 * Client management + API key persistence for ARTO Studio AI.
 * Clients hold the API keys that unlock gated skills.
 * Brand Roast is public (no client required).
 *
 * Backed by Supabase Postgres (same project as asai-prompt-library + asai-engine).
 * Schema lives in asai-engine/migrations/002_arto_consolidation.sql.
 */

export type ClientTier = "trial" | "starter" | "agency" | "enterprise" | "internal";

export const CLIENT_TIERS: ClientTier[] = [
  "trial",
  "starter",
  "agency",
  "enterprise",
  "internal",
];

export interface Client {
  id: string;
  name: string;
  email: string;
  api_key_prefix: string;
  tier: ClientTier;
  allowed_skills: string[];
  rate_limit_per_hour: number;
  trial_calls_limit: number | null;
  trial_calls_used: number;
  active: boolean;
  notes: string | null;
  created_at?: string;
}

export interface ClientWithSecret extends Client {
  api_key: string;
}

let cached: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = postgres(url, { ssl: "require", max: 5, prepare: false });
  return cached;
}

const DEV_SALT = "arto-dev-salt-v1-change-me";
let warnedDevSalt = false;

/**
 * Salt del HMAC de las API keys. Fail-closed en produccion (2026-09-11, Fase 1B):
 * si ARTO_API_KEY_SALT falta en Vercel, antes se caia al default publico del repo
 * y cualquier key firmada con ese salt validaba. Ahora lanza. En dev se conserva
 * el default con un warning una sola vez. ARTO_API_KEY_SALT existe en prod
 * (verificado el 10 sep 2026).
 */
function getSalt(): string {
  const salt = process.env.ARTO_API_KEY_SALT;
  if (salt) return salt;
  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  if (isProd) {
    throw new Error(
      "ARTO_API_KEY_SALT is not set. Refusing to hash API keys with the dev salt in production."
    );
  }
  if (!warnedDevSalt) {
    warnedDevSalt = true;
    console.warn("[clients/store] ARTO_API_KEY_SALT not set; using the dev salt (dev only).");
  }
  return DEV_SALT;
}

function hashKey(rawKey: string): string {
  return crypto
    .createHmac("sha256", getSalt())
    .update(rawKey)
    .digest("hex");
}

function generateApiKey(): { raw: string; prefix: string } {
  const bytes = crypto.randomBytes(24).toString("base64url");
  const raw = `arto_live_${bytes}`;
  const prefix = raw.slice(0, 14);
  return { raw, prefix };
}

function rowToClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    api_key_prefix: row.api_key_prefix as string,
    tier: row.tier as ClientTier,
    allowed_skills: row.allowed_skills as string[],
    rate_limit_per_hour: row.rate_limit_per_hour as number,
    trial_calls_limit:
      row.trial_calls_limit === null || row.trial_calls_limit === undefined
        ? null
        : (row.trial_calls_limit as number),
    trial_calls_used: (row.trial_calls_used as number) ?? 0,
    active: row.active as boolean,
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at as string | undefined),
  };
}

export async function createClient(params: {
  name: string;
  email: string;
  tier?: ClientTier;
  allowed_skills?: string[];
  rate_limit_per_hour?: number;
  trial_calls_limit?: number | null;
  notes?: string;
}): Promise<ClientWithSecret | null> {
  const sql = getDb();
  if (!sql) return null;

  const { raw, prefix } = generateApiKey();
  const hash = hashKey(raw);

  try {
    const [row] = await sql`
      INSERT INTO clients (
        name, email, api_key_hash, api_key_prefix,
        tier, allowed_skills, rate_limit_per_hour, trial_calls_limit, notes
      ) VALUES (
        ${params.name}, ${params.email}, ${hash}, ${prefix},
        ${params.tier ?? "trial"},
        ${sql.json((params.allowed_skills ?? ["*"]) as never)},
        ${params.rate_limit_per_hour ?? 100},
        ${params.trial_calls_limit ?? null},
        ${params.notes ?? null}
      )
      RETURNING id, name, email, api_key_prefix, tier, allowed_skills,
                rate_limit_per_hour, trial_calls_limit, trial_calls_used,
                active, notes, created_at
    `;

    return {
      ...rowToClient(row),
      api_key: raw,
    };
  } catch (error) {
    console.error("[clients/store] createClient failed:", error);
    return null;
  }
}

export async function verifyApiKey(rawKey: string): Promise<Client | null> {
  if (!rawKey || !rawKey.startsWith("arto_live_")) return null;
  const sql = getDb();
  if (!sql) return null;
  const hash = hashKey(rawKey);
  try {
    const [row] = await sql`
      SELECT id, name, email, api_key_prefix, tier, allowed_skills,
             rate_limit_per_hour, trial_calls_limit, trial_calls_used,
             active, notes, created_at
      FROM clients
      WHERE api_key_hash = ${hash} AND active = TRUE
      LIMIT 1
    `;
    if (!row) return null;
    return rowToClient(row);
  } catch (error) {
    console.error("[clients/store] verifyApiKey failed:", error);
    return null;
  }
}

export async function getClientById(id: string): Promise<Client | null> {
  const sql = getDb();
  if (!sql) return null;
  try {
    const [row] = await sql`
      SELECT id, name, email, api_key_prefix, tier, allowed_skills,
             rate_limit_per_hour, trial_calls_limit, trial_calls_used,
             active, notes, created_at
      FROM clients
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!row) return null;
    return rowToClient(row);
  } catch (error) {
    console.error("[clients/store] getClientById failed:", error);
    return null;
  }
}

export async function listClients(): Promise<Client[]> {
  const sql = getDb();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, name, email, api_key_prefix, tier, allowed_skills,
             rate_limit_per_hour, trial_calls_limit, trial_calls_used,
             active, notes, created_at
      FROM clients
      ORDER BY created_at DESC
    `;
    return rows.map((r) => rowToClient(r as Record<string, unknown>));
  } catch (error) {
    console.error("[clients/store] listClients failed:", error);
    return [];
  }
}

export async function revokeClient(id: string): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  try {
    await sql`UPDATE clients SET active = FALSE WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.error("[clients/store] revokeClient failed:", error);
    return false;
  }
}

export async function updateClient(
  id: string,
  updates: Partial<
    Pick<
      Client,
      | "name"
      | "email"
      | "tier"
      | "allowed_skills"
      | "rate_limit_per_hour"
      | "trial_calls_limit"
      | "trial_calls_used"
      | "active"
      | "notes"
    >
  >
): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  try {
    if (updates.name !== undefined) await sql`UPDATE clients SET name = ${updates.name} WHERE id = ${id}`;
    if (updates.email !== undefined) await sql`UPDATE clients SET email = ${updates.email} WHERE id = ${id}`;
    if (updates.tier !== undefined) await sql`UPDATE clients SET tier = ${updates.tier} WHERE id = ${id}`;
    if (updates.allowed_skills !== undefined)
      await sql`UPDATE clients SET allowed_skills = ${sql.json(updates.allowed_skills as never)} WHERE id = ${id}`;
    if (updates.rate_limit_per_hour !== undefined)
      await sql`UPDATE clients SET rate_limit_per_hour = ${updates.rate_limit_per_hour} WHERE id = ${id}`;
    if (updates.trial_calls_limit !== undefined)
      await sql`UPDATE clients SET trial_calls_limit = ${updates.trial_calls_limit} WHERE id = ${id}`;
    if (updates.trial_calls_used !== undefined)
      await sql`UPDATE clients SET trial_calls_used = ${updates.trial_calls_used} WHERE id = ${id}`;
    if (updates.active !== undefined) await sql`UPDATE clients SET active = ${updates.active} WHERE id = ${id}`;
    if (updates.notes !== undefined) await sql`UPDATE clients SET notes = ${updates.notes} WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.error("[clients/store] updateClient failed:", error);
    return false;
  }
}

export type TrialConsumeResult =
  | { ok: true; used: number; limit: number | null }
  | { ok: false; reason: "exhausted" | "unavailable" };

/**
 * Consume una llamada del trial en un solo UPDATE condicionado (2026-09-11, Fase 1B).
 *
 * Antes el flujo era check en requireClientAuth + increment en el engine, en dos
 * queries separadas: dos requests concurrentes leian trial_calls_used = 4, ambas
 * pasaban el check y ambas incrementaban (6 llamadas con limite 5). Aqui el WHERE
 * hace el check y el RETURNING confirma el increment en la misma sentencia; si no
 * regresa fila, el limite ya estaba agotado (o el cliente no existe / esta inactivo).
 *
 * Para clientes sin limite (trial_calls_limit IS NULL) el contador sigue subiendo,
 * igual que antes, para tener el total de llamadas por cliente.
 */
export async function consumeTrialCall(id: string): Promise<TrialConsumeResult> {
  const sql = getDb();
  if (!sql) return { ok: false, reason: "unavailable" };
  try {
    const [row] = await sql`
      UPDATE clients
      SET trial_calls_used = trial_calls_used + 1
      WHERE id = ${id}
        AND active = TRUE
        AND (trial_calls_limit IS NULL OR trial_calls_used < trial_calls_limit)
      RETURNING trial_calls_used, trial_calls_limit
    `;
    if (!row) return { ok: false, reason: "exhausted" };
    return {
      ok: true,
      used: row.trial_calls_used as number,
      limit:
        row.trial_calls_limit === null || row.trial_calls_limit === undefined
          ? null
          : (row.trial_calls_limit as number),
    };
  } catch (error) {
    console.error("[clients/store] consumeTrialCall failed:", error);
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Devuelve una llamada del trial (H-39, 2026-09-13).
 *
 * requireClientAuth consume la llamada ANTES de correr el skill. Si Claude falla y
 * el engine responde con source "fallback", el cliente pago una llamada por una
 * respuesta generica. La ruta /api/skills/[slug] llama aqui en ese caso.
 *
 * Solo aplica a clientes con tope (trial_calls_limit IS NOT NULL): en los que no
 * tienen tope el contador es un total historico de llamadas y no se toca.
 * GREATEST(..., 0) garantiza que nunca queda negativo. Regresa el contador que
 * quedo, o null si no habia fila que devolver (sin tope, inexistente) o si la
 * base fallo. Nunca lanza.
 */
export async function refundTrialCall(id: string): Promise<number | null> {
  const sql = getDb();
  if (!sql) return null;
  try {
    const [row] = await sql`
      UPDATE clients
      SET trial_calls_used = GREATEST(trial_calls_used - 1, 0)
      WHERE id = ${id}
        AND trial_calls_limit IS NOT NULL
      RETURNING trial_calls_used
    `;
    if (!row) return null;
    return row.trial_calls_used as number;
  } catch (error) {
    console.error("[clients/store] refundTrialCall failed:", error);
    return null;
  }
}
