import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshEmbeddings } from "@/lib/catalog-server";
import { catalogAdmin, fail } from "../_guard";

/* POST /api/admin/catalogo/embeddings: calcula los embeddings que faltan (hasta 200 por
 * llamada, para caber en 60 s), con la misma receta que los 3,000 originales. Devuelve
 * cuantos hizo y cuantos quedan; la pantalla repite mientras queden. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  try {
    const { data, error } = await createAdminClient().from("prompts").select("id").is("embedding", null).order("id").limit(200);
    if (error) throw new Error(error.message);
    const done = await refreshEmbeddings((data ?? []).map((r) => (r as { id: string }).id));
    const { count } = await createAdminClient().from("prompts").select("id", { count: "exact", head: true }).is("embedding", null);
    return NextResponse.json({ done, remaining: count ?? 0 });
  } catch (e) {
    return fail(e);
  }
}
