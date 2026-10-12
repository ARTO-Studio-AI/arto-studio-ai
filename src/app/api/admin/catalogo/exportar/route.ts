import { NextRequest, NextResponse } from "next/server";
import { applyFilter, CSV_COLUMNS, parseFilter } from "@/lib/catalog";
import { selectAll } from "@/lib/catalog-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";
import { catalogAdmin, fail } from "../_guard";

/* GET /api/admin/catalogo/exportar?<filtro>: el catalogo filtrado en CSV, con las mismas
 * columnas que acepta la importacion. Las etiquetas van separadas por «|». */
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const filter = parseFilter(Object.fromEntries(request.nextUrl.searchParams));
  try {
    const sb = createAdminClient();
    const rows = await selectAll<Record<string, unknown>>(() => applyFilter(sb.from("prompts").select(CSV_COLUMNS.join(", ")), filter).order("id"), 5000);
    const out = rows.map((r) => ({
      ...r,
      tags: Array.isArray(r.tags) ? (r.tags as string[]).join("|") : "",
      is_published: r.is_published ? "sí" : "no",
      is_featured: r.is_featured ? "sí" : "no",
    }));
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(CSV_COLUMNS, out), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="catalogo-prompts-${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
