import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { cleanEmail, GRANT_TIERS, grantTier, revokeGrant, type GrantTier } from "@/lib/grants";

/* POST /api/admin/concesiones
 *   { action: "grant", email, tier: "pro" | "enterprise", note? }
 *   { action: "revoke", email }
 * Solo con sesion de admin (el Bearer de ADMIN_API_KEY no da planes). */

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok || auth.via !== "session") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = cleanEmail(body?.email);
  if (!email) return NextResponse.json({ error: "Correo no válido." }, { status: 400 });
  try {
    if (body?.action === "grant") {
      const tier = String(body.tier ?? "");
      if (!(GRANT_TIERS as readonly string[]).includes(tier)) return NextResponse.json({ error: "Plan no válido." }, { status: 400 });
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";
      const result = await grantTier(email, tier as GrantTier, note, { email: auth.email, userId: auth.userId });
      return NextResponse.json({ result });
    }
    if (body?.action === "revoke") return NextResponse.json(await revokeGrant(email, { email: auth.email }));
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return NextResponse.json({ error: msg }, { status: /SQL|no tiene/.test(msg) ? 409 : 500 });
  }
}
