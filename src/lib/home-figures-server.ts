/* Cifras de la home leidas de la base (2026-11-05). Solo servidor.
 *
 * Un solo recorrido de los ai_model publicados da el total de prompts y la cinta de
 * herramientas. Va con service role, como catalog-search-server.ts, asi que el filtro de
 * publicados va explicito. El resultado se guarda en el Data Cache de Next una hora: la home
 * no le pega a la base en cada visita y la cifra nunca queda escrita a mano. */
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { toolsFromModels, type HomeTool } from "./home-figures";

export const HOME_FIGURES_REVALIDATE_S = 3600;
// PostgREST corta en 1,000 filas, asi que se pide por bloques.
const BLOCK = 1000;

export interface HomeFigures {
  promptsTotal: number;
  tools: HomeTool[];
}

async function loadHomeFigures(): Promise<HomeFigures> {
  const sb = createAdminClient();
  const models: (string | null)[] = [];
  for (let from = 0; ; from += BLOCK) {
    const { data, error } = await sb
      .from("prompts")
      .select("ai_model")
      .eq("is_published", true)
      .order("id", { ascending: true })
      .range(from, from + BLOCK - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) models.push((row as { ai_model: string | null }).ai_model);
    if (!data || data.length < BLOCK) break;
  }
  return { promptsTotal: models.length, tools: toolsFromModels(models) };
}

/* Si la carga falla no se guarda nada en cache; la home usa su respaldo y reintenta en la
 * siguiente visita. */
export const getHomeFigures = unstable_cache(loadHomeFigures, ["home-figures-v1"], {
  revalidate: HOME_FIGURES_REVALIDATE_S,
  tags: ["home-figures"],
});
