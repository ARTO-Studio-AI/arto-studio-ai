import { createAdminClient } from "@/lib/supabase/admin";
import { buildCatalog, MANIFEST_ONLY, type CatalogState, type EffectiveCatalog, type OverrideRow, type UploadedRow } from "./estado";

/* Catalogo efectivo, lado servidor (2026-11-05). Solo se importa desde codigo de servidor:
 * usa service role.
 *
 * Lee catalog_overrides y catalog_items (migracion 0021) y los pone encima del manifiesto del
 * repo (estado.ts). Cache en memoria de 60 s por instancia: un cambio en /admin/skills se ve
 * al instante en la instancia que lo hizo y en menos de un minuto en las demas, sin redeploy.
 *
 * Si la base falla, se sirve el ultimo estado bueno que tenga la instancia; si nunca leyo
 * nada, el manifiesto del repo tal cual. Asi una caida de Supabase no tumba /skills ni las
 * descargas. El costo: si nunca hubo lectura buena, un skill ocultado desde /admin vuelve a su
 * estado del repo mientras la base no responda (queda en los logs como [catalogo]). */

export const CATALOG_TTL_MS = 60_000;
/* Tras un error se reintenta antes, para no quedarse un minuto sin los cambios del admin. */
const RETRY_MS = 10_000;

export const BUCKET = "catalogo-paquetes";

let cached: { state: CatalogState; at: number; ttl: number } | null = null;
let lastGood: CatalogState | null = null;
let inflight: Promise<CatalogState> | null = null;

async function readState(): Promise<CatalogState> {
  const sb = createAdminClient();
  const [o, i] = await Promise.all([
    sb.from("catalog_overrides").select("kind, slug, status, updated_by, updated_at"),
    sb.from("catalog_items").select("kind, slug, ficha, storage_path, bytes, sha256, uploaded_by, updated_at"),
  ]);
  if (o.error) throw new Error(`catalog_overrides: ${o.error.message}`);
  if (i.error) throw new Error(`catalog_items: ${i.error.message}`);
  return { overrides: (o.data ?? []) as OverrideRow[], items: (i.data ?? []) as UploadedRow[], ok: true };
}

/** Estado de la base, con cache corta. Nunca lanza. */
export async function loadCatalogState({ fresh = false }: { fresh?: boolean } = {}): Promise<CatalogState> {
  const now = Date.now();
  if (!fresh && cached && now - cached.at < cached.ttl) return cached.state;
  if (!fresh && inflight) return inflight;
  const run = (async () => {
    try {
      const state = await readState();
      lastGood = state;
      cached = { state, at: Date.now(), ttl: CATALOG_TTL_MS };
      return state;
    } catch (err) {
      console.error("[catalogo] no pude leer el estado de la base, sigo con", lastGood ? "el ultimo bueno" : "el manifiesto", (err as Error).message);
      const state = lastGood ? { ...lastGood, ok: false } : MANIFEST_ONLY;
      cached = { state, at: Date.now(), ttl: RETRY_MS };
      return state;
    } finally {
      inflight = null;
    }
  })();
  if (!fresh) inflight = run;
  return run;
}

/** Catalogo del sitio: manifiesto + lo que se subio y se activo o desactivo en /admin/skills. */
export async function getCatalog(opts: { fresh?: boolean } = {}): Promise<EffectiveCatalog> {
  return buildCatalog(await loadCatalogState(opts));
}

/** Lo llama /admin despues de escribir, para que esta instancia lo vea al instante. */
export function invalidateCatalog(): void {
  cached = null;
}

/** URL firmada de corta vida para un paquete del bucket privado. null si no se pudo. */
export async function signedPackageUrl(path: string, downloadName: string, seconds = 60): Promise<string | null> {
  try {
    const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, seconds, { download: downloadName });
    if (error || !data?.signedUrl) {
      console.error("[skill-downloads] no pude firmar", path, error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error("[skill-downloads] no pude firmar", path, (err as Error).message);
    return null;
  }
}

/** Solo para pruebas. */
export function __resetCatalogCache(): void {
  cached = null;
  lastGood = null;
  inflight = null;
}
