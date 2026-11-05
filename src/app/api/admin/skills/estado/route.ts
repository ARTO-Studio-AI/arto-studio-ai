import { NextRequest, NextResponse } from "next/server";
import { AdminCatalogError, setCatalogStatus } from "@/lib/catalogo/admin-server";
import { catalogAdmin, fail } from "../../catalogo/_guard";

/* POST /api/admin/skills/estado { kind: "skill"|"bundle"|"mod", slug, status }
 * Activa o desactiva un skill, bundle o mod del catalogo (2026-11-05). Mismo candado que el
 * Catalogo de prompts: sesion de admin, nunca el Bearer. Efecto inmediato en esta instancia y
 * en menos de 60 s en las demas (cache de src/lib/catalogo/efectivo.ts). */
export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Cuerpo no valido" }, { status: 400 });
  try {
    const res = await setCatalogStatus({ kind: body.kind, slug: body.slug, status: body.status, actor: who.email });
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof AdminCatalogError) return NextResponse.json({ error: e.message, errors: e.errors }, { status: e.status });
    return fail(e);
  }
}
