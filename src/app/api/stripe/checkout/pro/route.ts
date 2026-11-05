import { NextResponse, type NextRequest } from "next/server";
import { config } from "dotenv";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROMO_COOKIE } from "@/lib/promo";
import { couponForCheckout, promoCheckoutExpiresAt, promoCouponId, verifyPromoCookie } from "@/lib/promo-server";

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
 * webhook, mismos metadatos de siempre. Si Stripe rechaza el cupon se reintenta una vez
 * sin el y se deja registro, para que un cupon mal configurado no tumbe la venta.
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

    // Cupon de la promo de 24 h: solo lo decide el servidor, con la cookie firmada.
    const now = Date.now();
    const promoStart = verifyPromoCookie(request.cookies.get(PROMO_COOKIE)?.value, now);
    const coupon = couponForCheckout({
      couponId: promoCouponId(),
      start: promoStart,
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

    // Create Stripe Checkout session
    const buildParams = (withCoupon: string | null) => {
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
      if (withCoupon) {
        params.set("discounts[0][coupon]", withCoupon);
        params.set("metadata[promo_coupon]", withCoupon);
        // La sesion con descuento no sobrevive a las 24 h (Stripe pide al menos 30 min).
        const expiresAt = promoCheckoutExpiresAt(promoStart, now);
        if (expiresAt) params.set("expires_at", String(expiresAt));
      } else {
        params.set("allow_promotion_codes", "true");
      }
      return params;
    };

    const createSession = async (withCoupon: string | null) => {
      const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: buildParams(withCoupon).toString(),
      });
      const data = (await resp.json()) as {
        id?: string;
        url?: string;
        error?: { message?: string; code?: string; param?: string };
      };
      return { resp, data };
    };

    const { resp: sessionResp, data: sessionData } = await createSession(coupon);
    if (coupon && !sessionResp.ok) {
      /* Decision de Victor (5 nov 2026, auditoria de Fable del PR 123): si Stripe rechaza
       * el cupon no se reintenta a precio normal. La persona vio $4.50; mandarla a pagar $9
       * en silencio rompe la confianza y esconde el error de configuracion. Se regresa a
       * /pricing con un aviso y queda el registro para arreglar el cupon. */
      console.error(
        JSON.stringify({
          event: "stripe_pro_promo_coupon_rejected",
          user_id: user.id,
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
      })
    );

    return NextResponse.redirect(sessionData.url, { status: 303 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[stripe/pro] crash:", err);
    return NextResponse.redirect(`${siteUrl}/pricing?error=${encodeURIComponent(msg)}`);
  }
}
