import { NextRequest, NextResponse } from "next/server";
import { verifyOnly } from "@/lib/promos/admin-server";
import { catalogAdmin } from "../../catalogo/_guard";
import { promoError } from "../_respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* POST /api/admin/promociones/verificar { promo } (5 nov 2026)
 * Lee el cupon y el price de Pro en Stripe (solo GET) y dice si coinciden con lo que hay en
 * el formulario. No guarda nada. Candado: sesion de admin, nunca el Bearer. */
export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Cuerpo no valido" }, { status: 400 });
  try {
    return NextResponse.json(await verifyOnly(body.promo));
  } catch (e) {
    return promoError(e);
  }
}
