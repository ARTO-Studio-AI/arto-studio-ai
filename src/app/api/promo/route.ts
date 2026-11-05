import { NextResponse, type NextRequest } from "next/server";
import { PROMO_COOKIE, PROMO_COOKIE_MAX_AGE_S, type PromoApiResponse } from "@/lib/promo";
import { promoConfigured, promoWindow, signPromoStart, verifyPromoCookie } from "@/lib/promo-server";
import { hasSupabaseSessionCookie } from "@/lib/signup-bar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* POST /api/promo (5 nov 2026). Dice si la promo de 24 h sigue vigente para quien
 * pregunta y, en su primera visita sin sesion, arranca el reloj con una cookie firmada.
 * Es POST para que ningun CDN ni prefetch la guarde ni la dispare por su cuenta.
 *
 *   - Promo apagada (sin cupon o sin secreto): { enabled: false } y no se escribe nada.
 *   - Cookie valida: se responde con su inicio; nunca se reescribe (recargar no reinicia).
 *   - Sin cookie valida y sin sesion: inicio = ahora.
 *   - Sin cookie valida y con sesion: no se arranca (la promo es para quien llega sin cuenta). */

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  if (!promoConfigured()) {
    return NextResponse.json({ enabled: false } satisfies PromoApiResponse, { headers: NO_STORE });
  }

  const now = Date.now();
  let start = verifyPromoCookie(request.cookies.get(PROMO_COOKIE)?.value, now);
  let fresh: string | null = null;
  if (start === null && !hasSupabaseSessionCookie(request.headers.get("cookie"))) {
    fresh = signPromoStart(now);
    if (fresh) start = now;
  }

  const w = promoWindow(start, now);
  const body: PromoApiResponse = { enabled: true, active: w.active, expired: w.expired, endsAt: w.endsAt, serverNow: now };
  const res = NextResponse.json(body, { headers: NO_STORE });
  if (fresh) {
    res.cookies.set(PROMO_COOKIE, fresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PROMO_COOKIE_MAX_AGE_S,
    });
  }
  return res;
}
