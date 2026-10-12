import { NextRequest, NextResponse } from "next/server";
import { undoBatch } from "@/lib/catalog-server";
import { catalogAdmin, fail } from "../_guard";

/* POST /api/admin/catalogo/deshacer { batch_id } */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as { batch_id?: unknown } | null;
  const batchId = typeof body?.batch_id === "string" ? body.batch_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return NextResponse.json({ error: "Lote no valido" }, { status: 400 });
  try {
    return NextResponse.json({ reverted: await undoBatch(batchId, who.email) });
  } catch (e) {
    return fail(e);
  }
}
