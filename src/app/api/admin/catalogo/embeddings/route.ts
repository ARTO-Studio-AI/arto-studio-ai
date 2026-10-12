import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshEmbeddings } from "@/lib/catalog-server";
import { catalogAdmin, fail } from "../_guard";

/* POST /api/admin/catalogo/embeddings: calcula los embeddings que faltan (hasta 300 por
 * llamada), con la misma receta que los 3,000 originales. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  try {
    const { data, error } = await createAdminClient().from("prompts").select("id").is("embedding", null).limit(300);
    if (error) throw new Error(error.message);
    const done = await refreshEmbeddings((data ?? []).map((r) => (r as { id: string }).id));
    return NextResponse.json({ done });
  } catch (e) {
    return fail(e);
  }
}
