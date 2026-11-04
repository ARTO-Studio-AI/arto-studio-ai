import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Category } from "@/types/prompt";

/* Numeros reales para vender la cuenta gratis (2026-11-05, 0 registros en 7 dias):
 * cuantos prompts publicados hay, cuantos abre la cuenta free y tres titulos free de
 * ejemplo. Los leen /login y la barra de registro de visitantes (SignupBar).
 *
 * Cache de una hora: el catalogo cambia poco y la barra va en todas las paginas de
 * marketing. Va con service role porque unstable_cache no admite cookies(); solo lee
 * conteos y titulos de prompts publicados, nunca el cuerpo. Si falla (build sin
 * secretos, Supabase caido) devuelve null y la UI se muestra sin numeros. Un error no
 * se cachea: unstable_cache solo guarda lo que resuelve. */

export interface SignupExample {
  id: string;
  title_es: string;
  title_en: string;
  category: Category;
}

export interface SignupStats {
  total: number;
  free: number;
  examples: SignupExample[];
}

async function load(): Promise<SignupStats> {
  const sb = createAdminClient();
  const [total, free, examples] = await Promise.all([
    sb.from("prompts").select("id", { count: "exact", head: true }).eq("is_published", true),
    sb.from("prompts").select("id", { count: "exact", head: true }).eq("is_published", true).eq("tier", "free"),
    // Destacados primero, luego los mas copiados: los que mejor venden la cuenta.
    sb
      .from("prompts")
      .select("id, title_es, title_en, category")
      .eq("is_published", true)
      .eq("tier", "free")
      .order("is_featured", { ascending: false, nullsFirst: false })
      .order("copy_count", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(3),
  ]);
  const error = total.error ?? free.error ?? examples.error;
  if (error) throw new Error(error.message);
  return {
    total: total.count ?? 0,
    free: free.count ?? 0,
    examples: (examples.data ?? []) as SignupExample[],
  };
}

const cachedLoad = unstable_cache(load, ["signup-stats-v1"], { revalidate: 3600, tags: ["signup-stats"] });
let warned = false; // un aviso por proceso: en el build sin secretos sale en cada pagina

/** Numeros del catalogo para el registro, o null si no se pudieron leer. Nunca lanza. */
export async function getSignupStats(): Promise<SignupStats | null> {
  try {
    const stats = await cachedLoad();
    return stats.total > 0 && stats.free > 0 ? stats : null;
  } catch (error) {
    if (!warned) console.warn("[signup-stats] sin numeros:", error instanceof Error ? error.message : String(error));
    warned = true;
    return null;
  }
}
