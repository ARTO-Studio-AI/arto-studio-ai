import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/* CSV de la lista de promociones (fase 1 de /admin, 2026-10-12). Solo con sesion de
 * admin; nunca incluye el token de baja. */

export const dynamic = "force-dynamic";

const STATUSES = ["active", "pending", "unsubscribed", "bounced"];

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Evita formulas al abrir en Excel o Sheets y escapa comillas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok || auth.via !== "session") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Se valida una sola vez: el valor tambien va al nombre del archivo.
  const raw = request.nextUrl.searchParams.get("estado");
  const estado = raw && STATUSES.includes(raw) ? raw : "";
  let q = createAdminClient()
    .from("newsletter_subscribers")
    .select("email, status, source, subscribed_at, last_sent_at, unsubscribed_at")
    .order("subscribed_at", { ascending: false })
    .limit(50_000);
  if (estado) q = q.eq("status", estado);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const head = ["email", "status", "source", "subscribed_at", "last_sent_at", "unsubscribed_at"];
  const lines = [head.join(","), ...(data ?? []).map((r) => head.map((k) => cell((r as Record<string, unknown>)[k])).join(","))];
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lista-promociones-${estado || "todos"}-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
