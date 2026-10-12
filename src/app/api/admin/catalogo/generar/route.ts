import { NextRequest, NextResponse } from "next/server";
import { generateDrafts, parseGenerateInput } from "@/lib/catalog-generate";
import { distinctValues } from "@/lib/catalog-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { catalogAdmin, fail } from "../_guard";

/* POST /api/admin/catalogo/generar { category, idea, tier, count?, subcategory? }
 * Devuelve hasta 3 borradores; no guarda nada. Tope de 30 generaciones por hora por admin. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const rl = await checkRateLimit(`catalogo:generar:${who.email}`, 30);
  if (rl.limited) return NextResponse.json({ error: "Llegaste a 30 generaciones en una hora. Intenta más tarde." }, { status: 429 });
  try {
    const aiModels = await distinctValues("ai_model");
    const input = parseGenerateInput(await request.json().catch(() => null), aiModels);
    if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
    return NextResponse.json(await generateDrafts(input));
  } catch (e) {
    return fail(e);
  }
}
