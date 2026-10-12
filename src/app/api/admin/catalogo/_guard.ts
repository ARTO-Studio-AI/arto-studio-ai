import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";

/* El Catalogo escribe en el catalogo publico: solo con sesion de admin, nunca con el
 * Bearer de ADMIN_API_KEY (fase 2 de /admin, 2026-10-12). */
export async function catalogAdmin(request: NextRequest): Promise<{ email: string } | NextResponse> {
  const auth = await requireAdminSession(request);
  if (!auth.ok || auth.via !== "session") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return { email: auth.email };
}

export function fail(err: unknown, status = 500): NextResponse {
  const msg = err instanceof Error ? err.message : "Error inesperado";
  console.error("[admin/catalogo]", msg);
  return NextResponse.json({ error: msg }, { status });
}
