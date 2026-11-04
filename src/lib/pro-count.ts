import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

/* Conteo real de prompts Pro publicados para la franja «Desbloquea N prompts con Pro»
 * (D28, 2026-11-05). Se lee con la llave publica y sin cookies (id y tier son legibles
 * para anon; el texto del prompt no, migracion 0017) y se guarda en cache una hora para
 * no golpear la base en cada visita al catalogo o a una ficha.
 * Si la consulta falla se lanza dentro de la cache (asi no se guarda el fallo) y afuera
 * se devuelve null: la franja sale sin numero en vez de tirar la pagina. */

export const PRO_COUNT_REVALIDATE_SECONDS = 3600;

async function countProPrompts(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase env ausente");
  const sb = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { count, error } = await sb
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true)
    .eq("tier", "pro");
  if (error) throw new Error(error.message);
  if (!count) throw new Error("conteo Pro vacio");
  return count;
}

const cachedCount = unstable_cache(countProPrompts, ["pro-prompt-count"], {
  revalidate: PRO_COUNT_REVALIDATE_SECONDS,
  tags: ["pro-prompt-count"],
});

/** Prompts Pro publicados, o null si no se pudo leer. */
export async function getProPromptCount(): Promise<number | null> {
  try {
    return await cachedCount();
  } catch (error) {
    console.warn("[pro-count] sin conteo Pro:", String(error));
    return null;
  }
}
