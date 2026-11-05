import { NextRequest, NextResponse } from "next/server";
import { savePromo } from "@/lib/promos/admin-server";
import { catalogAdmin } from "../../catalogo/_guard";
import { promoError } from "../_respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* POST /api/admin/promociones/guardar { promo, enable, isNew } (5 nov 2026)
 * Crea o edita una promo. enable = como queda (prendida o apagada); prendida exige que el
 * cupon coincida en Stripe en ese momento (lo verifica el servidor, no el navegador).
 * Candado: sesion de admin, nunca el Bearer (catalogAdmin). Efecto inmediato en esta
 * instancia y en menos de 60 s en las demas. */
export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Cuerpo no valido" }, { status: 400 });
  try {
    const res = await savePromo({ raw: body.promo, enable: body.enable === true, isNew: body.isNew === true, actor: who.email });
    return NextResponse.json(res);
  } catch (e) {
    return promoError(e);
  }
}
