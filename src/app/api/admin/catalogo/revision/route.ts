import { NextRequest, NextResponse } from "next/server";
import { needsConfirm, parseReviewAction } from "@/lib/review";
import { approvePrompts, unpublishPrompts } from "@/lib/review-server";
import { catalogAdmin, fail } from "../_guard";

/* POST /api/admin/catalogo/revision { action: "approve" | "unpublish", ids, note?, confirm? }
 * (2026-11-05). Mismo candado que el resto del Catalogo: sesion de admin, nunca el Bearer.
 * Despublicar mas de un prompt exige confirm igual al numero de prompts. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const parsed = parseReviewAction(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const a = parsed.value;
  if (needsConfirm(a)) return NextResponse.json({ error: `Escribe ${a.ids.length} para confirmar.`, count: a.ids.length }, { status: 409 });
  try {
    const res = a.action === "approve" ? await approvePrompts(a.ids, who.email, a.note) : await unpublishPrompts(a.ids, who.email, a.note);
    return NextResponse.json(res);
  } catch (e) {
    return fail(e);
  }
}
