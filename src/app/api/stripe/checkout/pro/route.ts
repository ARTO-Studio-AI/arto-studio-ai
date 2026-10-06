import { NextResponse, type NextRequest } from "next/server";
import { config } from "dotenv";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
      .select("email, stripe_customer_id, tier")
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

    // Create Stripe Checkout session
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("customer", customerId);
    params.set("line_items[0][price]", proPriceId);
    params.set("line_items[0][quantity]", "1");
    params.set("client_reference_id", user.id);
    params.set("metadata[user_id]", user.id);
    params.set("metadata[tier]", "pro");
    params.set("subscription_data[metadata][user_id]", user.id);
    params.set("subscription_data[metadata][tier]", "pro");
    params.set("success_url", `${siteUrl}/account?upgraded=pro`);
    params.set("cancel_url", `${siteUrl}/pricing?canceled=true`);
    params.set("allow_promotion_codes", "true");

    const sessionResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const sessionData = (await sessionResp.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

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
      })
    );

    return NextResponse.redirect(sessionData.url, { status: 303 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[stripe/pro] crash:", err);
    return NextResponse.redirect(`${siteUrl}/pricing?error=${encodeURIComponent(msg)}`);
  }
}
