/* Carga del indice de la busqueda por palabra (D28, 2026-10-23). Solo servidor.
 *
 * Lee una vez las columnas de las tarjetas de los prompts publicados (nunca prompt_en ni
 * prompt_es) y las guarda en memoria de la funcion por 10 minutos. Va con service role, como
 * getPrompt(), porque la anon key no lee prompts desde la migracion 0017; por eso el filtro de
 * publicados va explicito. PostgREST corta en 1,000 filas, asi que se pide por bloques. */
import { createAdminClient } from "@/lib/supabase/admin";
import { buildIndex, searchCatalog, type CatalogFilters, type CatalogIndex, type CatalogRow } from "./catalog-search";

const TTL_MS = 10 * 60 * 1000;
const BLOCK = 1000;
const COLUMNS = "id, title_en, title_es, category, subcategory, ai_model, difficulty, tier, tags, is_featured";

let cached: { index: CatalogIndex; at: number } | null = null;
let inflight: Promise<CatalogIndex> | null = null;

async function loadRows(): Promise<CatalogRow[]> {
  const sb = createAdminClient();
  const rows: CatalogRow[] = [];
  for (let from = 0; ; from += BLOCK) {
    const { data, error } = await sb
      .from("prompts")
      .select(COLUMNS)
      .eq("is_published", true)
      .order("id", { ascending: true })
      .range(from, from + BLOCK - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as CatalogRow[]));
    if (!data || data.length < BLOCK) break;
  }
  return rows;
}

async function getIndex(): Promise<CatalogIndex> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.index;
  if (!inflight) {
    inflight = loadRows()
      .then((rows) => {
        const index = buildIndex(rows);
        cached = { index, at: Date.now() };
        return index;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function searchPrompts(q: string, filters: CatalogFilters, lang: "es" | "en", page: number, perPage = 24) {
  const all = searchCatalog(await getIndex(), q, filters, lang);
  const totalPages = Math.ceil(all.length / perPage);
  const from = (page - 1) * perPage;
  return { prompts: all.slice(from, from + perPage), total: all.length, totalPages };
}
