import { NextRequest, NextResponse } from "next/server";
import { parsePromptInput } from "@/lib/catalog";
import { savePrompt } from "@/lib/catalog-server";
import { catalogAdmin, fail } from "../_guard";

/* POST /api/admin/catalogo/prompt { id?: string, prompt: {...} }
 * Sin id da de alta (el ID sale solo por vertical); con id edita. */
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as { id?: unknown; prompt?: unknown } | null;
  const id = typeof body?.id === "string" && /^[A-Z]{2}-\d{4}$/.test(body.id) ? body.id : null;
  const parsed = parsePromptInput(body?.prompt);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    return NextResponse.json(await savePrompt(id, parsed.value, who.email));
  } catch (e) {
    return fail(e);
  }
}
