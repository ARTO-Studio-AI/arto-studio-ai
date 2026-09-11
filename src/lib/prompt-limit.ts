import { createHash } from "node:crypto";
import postgres from "postgres";

/* Contador free de prompts abiertos al dia.
 *
 * Decision D7 de Victor (11 sep 2026): el plan free abre 3 prompts al dia. Cuenta abrir
 * un prompt (ver el cuerpo en /[locale]/prompts/[id]); busquedas, listado y previews son
 * libres. Reabrir el mismo prompt el mismo dia no cuenta. Pro, enterprise y los grants
 * manuales (ya reflejados en profiles.tier) no tienen tope.
 *
 * Sujeto: "user:<uuid>" para sesiones, "vid:<uuid>" para anonimos (cookie asai_vid que
 * pone src/proxy.ts) y, si el navegador no manda cookies, "ip:<hash>" como ultimo recurso.
 * Dia = dia natural UTC, calculado aqui y pasado explicito al SQL para no depender del
 * timezone de la sesion de Postgres.
 *
 * Persistencia: tabla prompt_opens (migracion 0009), leida y escrita solo por DATABASE_URL.
 * Si DATABASE_URL no existe (build de CI, dev sin secretos) el contador falla abierto:
 * deja pasar y lo escribe en consola. Mejor un dia sin tope que una biblioteca caida. */

export const FREE_DAILY_OPENS = 3;

export type Tier = "free" | "pro" | "enterprise" | (string & {});

export interface OpenResult {
  allowed: boolean;
  used: number;
  limit: number;
  resetsAtUtc: string;
}

let cached: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = postgres(url, { ssl: "require", max: 5, prepare: false });
  return cached;
}

/** Dia natural UTC en formato YYYY-MM-DD. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Proxima medianoche UTC en ISO, para el copy de "se reinicia a las...". */
export function nextResetUtc(now: Date = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.toISOString();
}

/** Los planes pagados y los grants manuales no tienen tope. */
export function isUnlimitedTier(tier: Tier | null | undefined): boolean {
  return !!tier && tier !== "free";
}

interface SubjectInput {
  /** Cookie asai_vid, si existe. */
  vid?: string | null;
  /** Usuario de Supabase autenticado, si hay sesion. */
  userId?: string | null;
  /** Cabecera x-forwarded-for o similar, solo para el fallback sin cookie. */
  ip?: string | null;
}

/** Deriva el sujeto que se cuenta. Prioridad: usuario > cookie > ip. */
export function getSubject({ vid, userId, ip }: SubjectInput): string {
  if (userId) return `user:${userId}`;
  if (vid) return `vid:${vid}`;
  const raw = (ip ?? "").split(",")[0].trim() || "unknown";
  return `ip:${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

/**
 * Intenta registrar la apertura de `promptId` por `subject` en el dia dado.
 * Una sola sentencia: inserta solo si el sujeto lleva menos de FREE_DAILY_OPENS prompts
 * distintos hoy; el conflicto de PK (mismo prompt, mismo dia) no cuenta ni falla.
 * `allowed` es true si se inserto o si la fila de hoy ya existia.
 */
export async function tryOpen(
  subject: string,
  promptId: string,
  opts: { day?: string; limit?: number; now?: Date } = {},
): Promise<OpenResult> {
  const limit = opts.limit ?? FREE_DAILY_OPENS;
  const now = opts.now ?? new Date();
  const day = opts.day ?? utcDay(now);
  const resetsAtUtc = nextResetUtc(now);
  const sql = getDb();
  if (!sql) {
    console.warn("[prompt-limit] DATABASE_URL ausente; contador en modo abierto");
    return { allowed: true, used: 0, limit, resetsAtUtc };
  }
  try {
    const [row] = await sql<{ inserted: number; before_count: number; existed: boolean }[]>`
      with ins as (
        insert into prompt_opens (subject, prompt_id, day)
        select ${subject}, ${promptId}, ${day}::date
        where (
          select count(*) from prompt_opens
          where subject = ${subject} and day = ${day}::date and prompt_id <> ${promptId}
        ) < ${limit}
        on conflict do nothing
        returning 1
      )
      select
        (select count(*)::int from ins) as inserted,
        (select count(*)::int from prompt_opens where subject = ${subject} and day = ${day}::date) as before_count,
        exists (
          select 1 from prompt_opens
          where subject = ${subject} and prompt_id = ${promptId} and day = ${day}::date
        ) as existed
    `;
    const used = row.before_count + row.inserted;
    return { allowed: row.inserted > 0 || row.existed, used, limit, resetsAtUtc };
  } catch (error) {
    console.error("[prompt-limit] tryOpen fallo, se deja pasar:", error);
    return { allowed: true, used: 0, limit, resetsAtUtc };
  }
}

/** Cuantos prompts distintos abrio el sujeto hoy (para el indicador "te quedan N de 3"). */
export async function getUsed(subject: string, day: string = utcDay()): Promise<number> {
  const sql = getDb();
  if (!sql) return 0;
  try {
    const [row] = await sql<{ used: number }[]>`
      select count(*)::int as used from prompt_opens where subject = ${subject} and day = ${day}::date
    `;
    return row?.used ?? 0;
  } catch (error) {
    console.error("[prompt-limit] getUsed fallo:", error);
    return 0;
  }
}

/**
 * Al iniciar sesion, las aperturas del dia hechas como anonimo (vid:) pasan al usuario
 * (user:) para que registrarse no regale 3 mas. Se hace como insert + delete en una
 * transaccion en vez de UPDATE del subject porque, si el usuario ya habia abierto ese
 * mismo prompt con su cuenta, el UPDATE chocaria con la PK.
 */
export async function adoptOpens(fromSubject: string, toSubject: string, day: string = utcDay()): Promise<number> {
  const sql = getDb();
  if (!sql || fromSubject === toSubject) return 0;
  try {
    return await sql.begin(async (tx) => {
      await tx`
        insert into prompt_opens (subject, prompt_id, day, first_at)
        select ${toSubject}, prompt_id, day, first_at
        from prompt_opens where subject = ${fromSubject} and day = ${day}::date
        on conflict do nothing
      `;
      const deleted = await tx`
        delete from prompt_opens where subject = ${fromSubject} and day = ${day}::date
      `;
      return deleted.count;
    });
  } catch (error) {
    console.error("[prompt-limit] adoptOpens fallo:", error);
    return 0;
  }
}

/** Solo para pruebas: borra las filas de un sujeto. */
export async function deleteOpens(subject: string): Promise<number> {
  const sql = getDb();
  if (!sql) return 0;
  const res = await sql`delete from prompt_opens where subject = ${subject}`;
  return res.count;
}

/** Solo para pruebas y scripts: cierra el pool. */
export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.end();
    cached = null;
  }
}

/**
 * Punto de entrada de las paginas: aplica el tope solo a free y anonimos.
 * Pro, enterprise y grants manuales (profiles.tier) pasan sin tocar la base.
 */
export async function openForTier(
  tier: Tier | null | undefined,
  subject: string,
  promptId: string,
  opts: { day?: string; limit?: number; now?: Date } = {},
): Promise<OpenResult & { unlimited: boolean }> {
  if (isUnlimitedTier(tier)) {
    return {
      allowed: true,
      used: 0,
      limit: opts.limit ?? FREE_DAILY_OPENS,
      resetsAtUtc: nextResetUtc(opts.now),
      unlimited: true,
    };
  }
  const res = await tryOpen(subject, promptId, opts);
  return { ...res, unlimited: false };
}
