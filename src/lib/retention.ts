import { getDb } from "@/lib/rate-limit";

/**
 * Retencion de datos personales (9 oct 2026, pregunta 11 de Victor). Lo que promete
 * el aviso de privacidad se cumple aqui; si cambia un plazo, se cambia en los dos.
 *
 *   - search_queries: el texto de cada busqueda se borra a los 12 meses.
 *
 * Lo corre el cron diario /api/cron/purge junto con la purga de rate_limits.
 */

export const SEARCH_RETENTION_DAYS = 365;

/** Borra las busquedas con mas de `days` dias. Devuelve cuantas borro. */
export async function purgeOldSearchQueries(days = SEARCH_RETENTION_DAYS): Promise<number> {
  const sql = getDb();
  if (!sql) throw new Error("DATABASE_URL not set; cannot purge search_queries");
  const result = await sql`
    DELETE FROM search_queries
    WHERE created_at < now() - make_interval(days => ${days})
  `;
  return result.count ?? 0;
}
