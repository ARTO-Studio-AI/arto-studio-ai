import { NextResponse, type NextRequest } from "next/server";
import { PROMO_COOKIE, PROMO_COOKIE_MAX_AGE_S, type PromoApiResponse } from "@/lib/promo";
import { neverSubscribed, promoSigningReady, readPromoCookie, writePromoCookie } from "@/lib/promo-server";
import { UTM_COOKIE, parseFirstTouch } from "@/lib/attribution";
import { hasSupabaseSessionCookie } from "@/lib/signup-bar";
import { clockWindow, isLive, needsAccountCheck, needsCampaign, promoForVisitor, runningClock, type Visitor } from "@/lib/promos/eleccion";
import { getSitePromos } from "@/lib/promos/estado";
import { offerOf } from "@/lib/promos/tipos";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* POST /api/promo { locale } (PR 123 del 5 nov 2026; promos de /admin el mismo dia). Dice
 * que promo le toca a quien pregunta, con sus textos y su reloj, y en su primera visita
 * dentro del publico de esa promo arranca el reloj con una cookie firmada que lleva el id
 * de la promo. Es POST para que ningun CDN ni prefetch la guarde ni la dispare.
 *
 *   - Sin promos vivas o sin secreto de firma: { enabled: false } y no se escribe nada.
 *   - Reloj corriendo de una promo viva: se responde con ese; la cookie no se reescribe
 *     (recargar no reinicia). Gana sobre el publico: lo que la persona vio es lo que se cobra.
 *   - Si no, la promo de su publico (eleccion.ts). Si la cookie ya tiene reloj de esa promo
 *     y vencio, se responde vencida y no se reinicia. Si no tiene, el reloj empieza ahora.
 *   - Publico «sin cuenta»: sin cookie de sesion (igual que el PR 123). «Cuenta gratis que
 *     nunca tuvo Pro»: sesion real y perfil sin suscripcion; solo se consulta si hay una promo
 *     viva de ese publico o de campana. «Campana»: utm_campaign de la cookie asai_utm. */

const NO_STORE = { "Cache-Control": "no-store" };

async function accountNeverPro(): Promise<boolean | null> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("tier, stripe_subscription_id, subscription_status")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return false;
    return neverSubscribed((data ?? null) as Parameters<typeof neverSubscribed>[0]);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const off = () => NextResponse.json({ enabled: false } satisfies PromoApiResponse, { headers: NO_STORE });
  if (!promoSigningReady()) return off();

  const now = Date.now();
  const { promos } = await getSitePromos();
  if (!promos.some((p) => isLive(p, now))) return off();

  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const locale = body?.locale === "en" ? "en" : "es";
  const starts = readPromoCookie(request.cookies.get(PROMO_COOKIE)?.value, now);

  const respond = (data: PromoApiResponse, cookie: string | null = null) => {
    const res = NextResponse.json(data, { headers: NO_STORE });
    if (cookie) {
      res.cookies.set(PROMO_COOKIE, cookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: PROMO_COOKIE_MAX_AGE_S,
      });
    }
    return res;
  };

  // 1. Un reloj que sigue corriendo para una promo viva manda.
  const run = runningClock(promos, starts, now);
  if (run) {
    return respond({ enabled: true, active: true, expired: false, endsAt: run.window.endsAt, serverNow: now, promoId: run.promo.id, offer: offerOf(run.promo, locale) });
  }

  // 2. La promo del publico de esta persona.
  const signedIn = hasSupabaseSessionCookie(request.headers.get("cookie"));
  const visitor: Visitor = {
    signedIn,
    neverPro: signedIn && needsAccountCheck(promos, now) ? await accountNeverPro() : null,
    utmCampaign: needsCampaign(promos, now) ? (parseFirstTouch(request.cookies.get(UTM_COOKIE)?.value)?.utm_campaign ?? null) : null,
  };
  const chosen = promoForVisitor(promos, visitor, now);
  if (!chosen) {
    // Sin promo para su publico; si trae un reloj vencido de una promo viva, se dice.
    const past = promos.find((p) => isLive(p, now) && starts.has(p.id));
    const w = past ? clockWindow(past, starts.get(past.id)!, now) : null;
    return respond({ enabled: true, active: false, expired: Boolean(w?.expired), endsAt: w?.expired ? w.endsAt : null, serverNow: now, promoId: w?.expired ? past!.id : null, offer: null });
  }

  const prior = starts.get(chosen.id);
  if (prior !== undefined) {
    const w = clockWindow(chosen, prior, now);
    // Su reloj de esta promo ya vencio: no se reinicia.
    return respond({ enabled: true, active: false, expired: true, endsAt: w.endsAt, serverNow: now, promoId: chosen.id, offer: null });
  }

  const next = new Map(starts);
  next.set(chosen.id, now);
  const cookie = writePromoCookie(next);
  if (!cookie) return off();
  const w = clockWindow(chosen, now, now);
  return respond({ enabled: true, active: w.active, expired: !w.active, endsAt: w.endsAt, serverNow: now, promoId: chosen.id, offer: w.active ? offerOf(chosen, locale) : null }, cookie);
}
