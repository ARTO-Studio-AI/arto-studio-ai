import postgres from "postgres";

/**
 * Rate limiting persistente, respaldado en Postgres (2026-09-11, Fase 1B).
 *
 * Reemplaza los cuatro `Map` en memoria que habia en /api/roast, /api/signup,
 * /api/skills/[slug] y lib/clients/auth.ts. En Vercel cada instancia tenia su
 * propio Map, se vaciaba en cada cold start y nunca se compartia entre regiones:
 * el limite "10 por hora" era en la practica "10 por hora por instancia viva".
 *
 * Reusa la tabla `rate_limits (key, window_start, count)` y la funcion SQL
 * `bump_rate_limit(rl_key text)` que ya usaba /api/search: incrementa el contador
 * de la ventana fija de la hora en curso (date_trunc('hour', now())) y regresa el
 * nuevo valor. La funcion solo soporta ventanas de una hora; como los cuatro
 * sitios reemplazados ya eran de una hora, no hizo falta migracion.
 *
 * Fail-open: si la base no responde se loguea y se deja pasar, igual que hacia
 * /api/search. Un hipo de red no debe tumbar los endpoints publicos.
 *
 * Convencion de keys (evita choques entre endpoints y con /api/search, que usa
 * `ip:<ip>` y `user:<id>`):  `roast:ip:<ip>`, `roast-email:ip:<ip>`,
 * `signup:ip:<ip>`, `skill:<slug>:ip:<ip>`, `client:<client_id>`.
 */

export interface RateLimitResult {
  /** true cuando la llamada actual excede el limite (ya quedo contada). */
  limited: boolean;
  /** Llamadas contadas en la ventana actual, incluida esta. */
  count: number;
  limit: number;
  /** Segundos hasta que abre la siguiente ventana (para Retry-After). */
  retryAfterSec: number;
}

let cached: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = postgres(url, { ssl: "require", max: 2, prepare: false });
  return cached;
}

function secondsToNextHour(now = Date.now()): number {
  const HOUR = 3600;
  return HOUR - (Math.floor(now / 1000) % HOUR);
}

/**
 * Cuenta una llamada para `key` en la ventana de la hora actual y dice si con
 * ella se excede `limit`. Permite exactamente `limit` llamadas por hora; la
 * numero limit+1 sale con limited=true (misma semantica que los Map anteriores).
 */
export async function checkRateLimit(key: string, limit: number): Promise<RateLimitResult> {
  const open: RateLimitResult = { limited: false, count: 0, limit, retryAfterSec: 0 };
  const sql = getDb();
  if (!sql) {
    console.warn("[rate-limit] DATABASE_URL not set; rate limit disabled for", key);
    return open;
  }
  try {
    const [row] = await sql`SELECT public.bump_rate_limit(${key}) AS count`;
    const count = Number(row?.count ?? 0);
    return { limited: count > limit, count, limit, retryAfterSec: secondsToNextHour() };
  } catch (error) {
    console.error("[rate-limit] bump_rate_limit failed (fail-open):", error);
    return open;
  }
}

/** IP del caller detras del proxy de Vercel. "unknown" si no hay cabecera. */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Borra las ventanas de rate_limits mas viejas que `days` dias (H-40, 2026-09-13).
 *
 * bump_rate_limit solo lee la ventana de la hora en curso; las filas viejas no
 * sirven para nada y la tabla crecia sin tope (una fila por key y por hora). La
 * llama el cron diario /api/cron/purge. Regresa cuantas filas borro; si la base
 * falla, lanza para que el cron responda 500 y quede en los logs de Vercel.
 */
export async function purgeOldRateLimits(days = 7): Promise<number> {
  const sql = getDb();
  if (!sql) throw new Error("DATABASE_URL not set; cannot purge rate_limits");
  const result = await sql`
    DELETE FROM rate_limits
    WHERE window_start < now() - make_interval(days => ${days})
  `;
  return result.count ?? 0;
}
