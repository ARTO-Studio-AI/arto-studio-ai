import { NextRequest, NextResponse } from "next/server";
import { readImport } from "@/lib/catalog";
import { applyImport, planImport } from "@/lib/catalog-server";
import { parseCsv } from "@/lib/csv";
import { catalogAdmin, fail } from "../_guard";

/* POST /api/admin/catalogo/importar { csv: string, apply?: boolean, confirm?: string }
 * Sin apply devuelve el plan fila por fila (alta, edicion, sin cambios, error) sin tocar
 * nada. Con apply aplica, solo si no hay filas con error; con mas de 50 cambios exige
 * confirm igual al numero de cambios. */
export const maxDuration = 60;

const MAX_BYTES = 2_000_000;

export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as { csv?: unknown; apply?: unknown; confirm?: unknown } | null;
  const csv = typeof body?.csv === "string" ? body.csv : "";
  if (!csv.trim()) return NextResponse.json({ error: "El CSV está vacío." }, { status: 400 });
  if (csv.length > MAX_BYTES) return NextResponse.json({ error: "El CSV pasa de 2 MB." }, { status: 413 });

  try {
    const { rows, warnings } = readImport(parseCsv(csv));
    const { plan, changes, creates, notices } = await planImport(rows);
    const errors = plan.filter((p) => p.action === "error").length;
    const total = changes.length + creates.length;
    const summary = { creates: creates.length, updates: changes.length, same: plan.filter((p) => p.action === "same").length, errors };
    if (body?.apply !== true) return NextResponse.json({ plan, warnings: [...warnings, ...notices], summary });
    if (errors) return NextResponse.json({ error: `Hay ${errors} filas con error; corrígelas antes de aplicar.`, plan, summary }, { status: 400 });
    if (!total) return NextResponse.json({ error: "No hay nada que cambiar." }, { status: 400 });
    if (total > 50 && String(body.confirm ?? "") !== String(total)) {
      return NextResponse.json({ error: `Escribe ${total} para confirmar.`, summary }, { status: 409 });
    }
    return NextResponse.json({ ...(await applyImport(changes, creates, who.email)), summary });
  } catch (e) {
    return fail(e, e instanceof Error && /CSV|filas|comillas/.test(e.message) ? 400 : 500);
  }
}
