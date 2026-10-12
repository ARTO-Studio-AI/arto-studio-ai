import { NextRequest, NextResponse } from "next/server";
import { describePatch, parseFilter, parsePatch } from "@/lib/catalog";
import { applyBulk, isPerRow, PER_ROW_MAX, resolveIds } from "@/lib/catalog-server";
import { catalogAdmin, fail } from "../_guard";

/* POST /api/admin/catalogo/lote
 * { ids?: string[], filter?: {...}, patch: {...}, dry_run?: boolean, confirm?: string }
 * dry_run devuelve cuantos cambian sin tocar nada. Con mas de 50 se exige confirm igual
 * al numero de filas, como confirmacion escrita. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Cuerpo no valido" }, { status: 400 });
  const patch = parsePatch(body.patch);
  if (!patch) return NextResponse.json({ error: "No hay ningun cambio valido" }, { status: 400 });
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : undefined;
  const filter = body.filter && typeof body.filter === "object" ? parseFilter(body.filter as Record<string, unknown>) : undefined;
  if (!ids?.length && !filter) return NextResponse.json({ error: "Falta la seleccion o el filtro" }, { status: 400 });

  try {
    const { ids: target, capped } = await resolveIds({ ids, filter });
    if (capped) return NextResponse.json({ error: "El filtro abarca demasiados prompts; acótalo." }, { status: 400 });
    if (isPerRow(patch) && target.length > PER_ROW_MAX) {
      return NextResponse.json({ error: `Etiquetas y destacados van de ${PER_ROW_MAX} en ${PER_ROW_MAX}; este filtro tiene ${target.length}. Acótalo.`, count: target.length }, { status: 400 });
    }
    if (body.dry_run === true) return NextResponse.json({ count: target.length, summary: describePatch(patch) });
    if (target.length > 50 && String(body.confirm ?? "") !== String(target.length)) {
      return NextResponse.json({ error: `Escribe ${target.length} para confirmar.`, count: target.length }, { status: 409 });
    }
    const res = await applyBulk(target, patch, who.email);
    return NextResponse.json(res);
  } catch (e) {
    return fail(e);
  }
}
