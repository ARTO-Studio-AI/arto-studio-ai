import { NextRequest, NextResponse } from "next/server";
import { applyFilter, CSV_COLUMNS, parseFilter } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { csvCell } from "@/lib/csv";
import { catalogAdmin } from "../_guard";

/* GET /api/admin/catalogo/exportar?<filtro>: el catalogo filtrado en CSV, con las mismas
 * columnas que acepta la importacion (etiquetas separadas por «|»). Va en streaming, de
 * 1,000 en 1,000 filas: el catalogo completo pesa mas que los 4.5 MB que Vercel deja
 * devolver de una sola vez (auditoria de Fable del PR #89). */
export const maxDuration = 60;

const PAGE = 1000;
const MAX = 10000;

function line(r: Record<string, unknown>): string {
  const row: Record<string, unknown> = {
    ...r,
    tags: Array.isArray(r.tags) ? (r.tags as string[]).join("|") : "",
    is_published: r.is_published ? "sí" : "no",
    is_featured: r.is_featured ? "sí" : "no",
  };
  return CSV_COLUMNS.map((k) => csvCell(row[k])).join(",") + "\n";
}

export async function GET(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const filter = parseFilter(Object.fromEntries(request.nextUrl.searchParams));
  const sb = createAdminClient();
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(enc.encode(CSV_COLUMNS.join(",") + "\n"));
      try {
        for (let from = 0; from < MAX; from += PAGE) {
          const { data, error } = await applyFilter(sb.from("prompts").select(CSV_COLUMNS.join(", ")), filter)
            .order("id")
            .range(from, from + PAGE - 1);
          if (error) throw new Error(error.message);
          const rows = (data ?? []) as unknown as Record<string, unknown>[];
          controller.enqueue(enc.encode(rows.map(line).join("")));
          if (rows.length < PAGE) break;
        }
        controller.close();
      } catch (e) {
        console.error("[admin/catalogo/exportar]", e instanceof Error ? e.message : e);
        controller.error(e);
      }
    },
  });

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="catalogo-prompts-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
