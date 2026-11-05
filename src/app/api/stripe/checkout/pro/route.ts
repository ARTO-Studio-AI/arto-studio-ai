import { NextResponse, type NextRequest } from "next/server";
import { config } from "dotenv";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROMO_COOKIE } from "@/lib/promo";
import { checkoutExpiresAt, promoForCheckout, readPromoCookie } from "@/lib/promo-server";
import { getSitePromos } from "@/lib/promos/estado";
import { LEGACY_PROMO_ID } from "@/lib/promos/tipos";

/* Load .env.local explicitly. Workaround for Next.js 16 Turbopack env loading. */
config({
  path: path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local"),
  override: true,
});

export const runtime = "nodejs";
export const maxDuration = 30;

/* GET /api/stripe/checkout/pro
 *
 * Creates a Stripe Checkout session for the Prompts Pro $9/mo tier and
 * redirects the user to it. Auth-gated: if the user isn't signed in we
 * bounce them through /login first.
 *
 * Why a separate route from /api/stripe/checkout: the existing endpoint
 * handles the Starter $25 skill subscription, which is keyed off the
 * `clients` table (API-key clients). Pro is keyed off the `profiles`
 * table (Supabase Auth users). Same Stripe account, same shared webhook,
 * different data model — cleaner as two routes.
 *
 * Stripe webhook (configured at NEXT_PUBLIC_SITE_URL/api/stripe/webhook, creative.artostudio.ai)
 * receives the checkout.session.completed event and updates
 * profiles.tier = 'pro'. No webhook changes needed here because both
 * domains write to the same Supabase profiles table.
 *
 * Promo de 24 h (5 nov 2026, decision de Victor): si existe STRIPE_PROMO_COUPON_24H, la
 * cookie firmada asai_promo_24h sigue dentro de sus 24 h y la persona nunca tuvo
 * suscripcion, la sesion lleva discounts[0][coupon] (50% el primer pago, cupon creado
 * por Victor en Stripe) y metadata[promo_coupon]. Stripe no acepta discounts junto con
 * allow_promotion_codes, asi que con el cupon ese campo se omite, y la sesion vence
 * cuando vencen las 24 h (expires_at, minimo 30 min de Stripe). Mismo precio, mismo
 * webhook, mismos metadatos de siempre. Si Stripe rechaza el cupon no se reintenta a
 * precio normal: se regresa a /pricing?error=promo_unavailable y se deja registro.
 *
 * Promociones de /admin/promociones (5 nov 2026): la promo sale de la cookie firmada, que
 * lleva el id de la promo (src/lib/promo-server.ts, promoForCheckout). Cupon (porcentaje o
 * monto): discounts[0][coupon] + metadata[promo_coupon]. Prueba gratis:
 * subscription_data[trial_period_days], sin cupon. En las dos: metadata[promo_id], expires_at
 * al fin del reloj y sin allow_promotion_codes (no se suma otro codigo encima). Sin promos en
 * la base, la de STRIPE_PROMO_COUPON_24H funciona igual que arriba. Si la base no responde y
 * la cookie trae el reloj de una promo de la base que no se puede confirmar, tampoco se cobra
 * precio normal en silencio: promo_unavailable.
 */

export async function GET(request: NextRequest) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const proPriceId = process.env.STRIPE_PRICE_ID_PRO;

    if (!secretKey) {
      return NextResponse.redirect(`${siteUrl}/pricing?error=stripe_not_configured`);
    }
    if (!proPriceId) {
      return NextResponse.redirect(`${siteUrl}/pricing?error=pro_price_missing`);
    }

    // Require authenticated user
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${siteUrl}/login?next=/api/stripe/checkout/pro`);
    }

    // Fetch or create the Stripe customer for this user
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("email, stripe_customer_id, tier, stripe_subscription_id, subscription_status")
      .eq("id", user.id)
      .maybeSingle();

    // Already on Pro or higher — go to account
    if (profile?.tier && profile.tier !== "free") {
      return NextResponse.redirect(`${siteUrl}/account?already=${profile.tier}`);
    }

    let customerId = (profile?.stripe_customer_id as string | null) ?? null;
    const userEmail = (profile?.email as string | null) ?? user.email ?? "";

    if (!customerId) {
      // Create a new Stripe customer for this user
      const custParams = new URLSearchParams();
      custParams.set("email", userEmail);
      custParams.set("metadata[user_id]", user.id);

      const custResp = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: custParams.toString(),
      });
      const custData = (await custResp.json()) as { id?: string; error?: { message?: string } };
      if (!custResp.ok || !custData.id) {
        const msg = custData.error?.message || `Stripe customer create failed (${custResp.status})`;
        console.error("[stripe/pro] customer create error:", custData.error);
        return NextResponse.redirect(`${siteUrl}/pricing?error=${encodeURIComponent(msg)}`);
      }
      customerId = custData.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Promo: solo la decide el servidor, con la cookie firmada (lleva el id de la promo).
    const now = Date.now();
    const starts = readPromoCookie(request.cookies.get(PROMO_COOKIE)?.value, now);
    const site = await getSitePromos();
    const promo = promoForCheckout({
      promos: site.promos,
      starts,
      now,
      priceId: proPriceId,
      proMonthlyPriceId: process.env.STRIPE_PRICE_ID_PRO,
      profile: profile
        ? {
            tier: profile.tier as string | null,
            stripe_subscription_id: profile.stripe_subscription_id as string | null,
            subscription_status: profile.subscription_status as string | null,
          }
        : null,
    });
    if (!promo && site.degraded && [...starts.keys()].some((id) => id !== LEGACY_PROMO_ID)) {
      console.error(JSON.stringify({ event: "stripe_pro_promo_unverifiable", user_id: user.id }));
      return NextResponse.redirect(`${siteUrl}/pricing?error=promo_unavailable`);
    }
    const coupon = promo && promo.promo.kind !== "trial" ? promo.promo.couponId : null;
    const trialDays = promo && promo.promo.kind === "trial" ? promo.promo.trialDays : null;

    // Create Stripe Checkout session
    const buildParams = (withPromo: boolean) => {
      const params = new URLSearchParams();
      params.set("mode", "subscription");
      params.set("customer", customerId as string);
      params.set("line_items[0][price]", proPriceId);
      params.set("line_items[0][quantity]", "1");
      params.set("client_reference_id", user.id);
      params.set("metadata[user_id]", user.id);
      params.set("metadata[tier]", "pro");
      params.set("subscription_data[metadata][user_id]", user.id);
      params.set("subscription_data[metadata][tier]", "pro");
      params.set("success_url", `${siteUrl}/account?upgraded=pro`);
      params.set("cancel_url", `${siteUrl}/pricing?canceled=true`);
      if (withPromo && promo) {
        if (coupon) {
          params.set("discounts[0][coupon]", coupon);
          params.set("metadata[promo_coupon]", coupon);
        } else if (trialDays) {
          params.set("subscription_data[trial_period_days]", String(trialDays));
          params.set("metadata[promo_trial_days]", String(trialDays));
        }
        params.set("metadata[promo_id]", promo.promo.id);
        // La sesion con descuento no sobrevive al reloj (Stripe pide al menos 30 min).
        const expiresAt = checkoutExpiresAt(promo.endsAt, now);
        if (expiresAt) params.set("expires_at", String(expiresAt));
      } else {
        params.set("allow_promotion_codes", "true");
      }
      return params;
    };

    const createSession = async (withPromo: boolean) => {
      const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: buildParams(withPromo).toString(),
      });
      const data = (await resp.json()) as {
        id?: string;
        url?: string;
        error?: { message?: string; code?: string; param?: string };
      };
      return { resp, data };
    };

    const withPromo = Boolean(coupon || trialDays);
    const { resp: sessionResp, data: sessionData } = await createSession(withPromo);
    if (withPromo && !sessionResp.ok) {
      /* Decision de Victor (5 nov 2026, auditoria de Fable del PR 123): si Stripe rechaza
       * el cupon no se reintenta a precio normal. La persona vio $4.50; mandarla a pagar $9
       * en silencio rompe la confianza y esconde el error de configuracion. Se regresa a
       * /pricing con un aviso y queda el registro para arreglar el cupon. */
      console.error(
        JSON.stringify({
          event: "stripe_pro_promo_coupon_rejected",
          user_id: user.id,
          promo_id: promo?.promo.id ?? null,
          status: sessionResp.status,
          code: sessionData.error?.code ?? null,
          param: sessionData.error?.param ?? null,
          message: sessionData.error?.message ?? null,
        })
      );
      return NextResponse.redirect(`${siteUrl}/pricing?error=promo_unavailable`);
    }

    if (!sessionResp.ok || !sessionData.url) {
      const msg = sessionData.error?.message || `Stripe session create failed (${sessionResp.status})`;
      console.error("[stripe/pro] session create error:", sessionData.error);
      return NextResponse.redirect(`${siteUrl}/pricing?error=${encodeURIComponent(msg)}`);
    }

    console.log(
      JSON.stringify({
        event: "stripe_pro_session_created",
        session_id: sessionData.id,
        user_id: user.id,
        promo_coupon: coupon ? true : false,
        promo_id: withPromo ? (promo?.promo.id ?? null) : null,
      })
    );

    return NextResponse.redirect(sessionData.url, { status: 303 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[stripe/pro] crash:", err);
    return NextResponse.redirect(`${siteUrl}/pricing?error=${encodeURIComponent(msg)}`);
  }
}
