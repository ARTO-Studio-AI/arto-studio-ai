import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import path from "path";
import { STRIPE_PRICE_ID_STARTER } from "@/lib/stripe";
import { getClientById } from "@/lib/clients/store";

// Load .env.local explicitly (workaround for Next.js 16 Turbopack env loading)
config({
  path: path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local"),
  override: true,
});

export const runtime = "nodejs";
export const maxDuration = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/* ── POST /api/stripe/checkout ─ create Checkout session ──
 *
 * NOTE: We call the Stripe REST API directly with `fetch` instead of
 * using the `stripe` SDK. The SDK's StripeConnectionError fails inside
 * Vercel's serverless runtime (cause: null, no extra info) even though
 * raw fetch to api.stripe.com works fine from the same function.
 * Rather than fight the SDK on Node 24 / Next 16, we just speak HTTP.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Payments are not configured yet. Contact hello@artogroup.com." },
      { status: 503, headers: corsHeaders }
    );
  }
  if (!STRIPE_PRICE_ID_STARTER) {
    return NextResponse.json(
      { error: "Starter price ID is missing from server config." },
      { status: 503, headers: corsHeaders }
    );
  }

  let body: { client_id?: unknown };
  try {
    body = (await request.json()) as { client_id?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
  if (!clientId) {
    return NextResponse.json(
      { error: "client_id is required." },
      { status: 400, headers: corsHeaders }
    );
  }

  const client = await getClientById(clientId);
  if (!client) {
    return NextResponse.json(
      { error: "Unknown client_id. Sign up first at /." },
      { status: 404, headers: corsHeaders }
    );
  }
  if (!client.active) {
    return NextResponse.json(
      { error: "This account has been revoked. Contact hello@artogroup.com." },
      { status: 403, headers: corsHeaders }
    );
  }
  if (client.tier === "starter" || client.tier === "agency" || client.tier === "enterprise") {
    return NextResponse.json(
      { error: `You're already on the ${client.tier} tier.`, already_paid: true },
      { status: 409, headers: corsHeaders }
    );
  }

  // D6: los redirects vuelven al dominio canónico; el host de la petición solo
  // sirve de respaldo cuando NEXT_PUBLIC_SITE_URL no está (dev local).
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || absoluteOrigin(request);

  // Stripe form-encoded payload (their API expects x-www-form-urlencoded)
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", STRIPE_PRICE_ID_STARTER);
  params.set("line_items[0][quantity]", "1");
  params.set("customer_email", client.email);
  params.set("client_reference_id", client.id);
  params.set("metadata[client_id]", client.id);
  params.set("metadata[client_email]", client.email);
  params.set("subscription_data[metadata][client_id]", client.id);
  params.set("subscription_data[metadata][client_email]", client.email);
  params.set("success_url", `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/upgrade?client_id=${client.id}&canceled=true`);
  params.set("allow_promotion_codes", "true");

  try {
    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = (await resp.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string; type?: string; code?: string };
    };

    if (!resp.ok) {
      const msg = data.error?.message || `Stripe returned ${resp.status}`;
      console.error("[stripe/checkout] API error:", data.error);
      return NextResponse.json(
        { error: `Stripe error: ${msg}`, stripe_error: data.error },
        { status: 502, headers: corsHeaders }
      );
    }

    if (!data.url || !data.id) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502, headers: corsHeaders }
      );
    }

    console.log(
      JSON.stringify({
        event: "stripe_checkout_session_created",
        session_id: data.id,
        client_id: client.id,
        email: client.email,
      })
    );

    return NextResponse.json(
      { url: data.url, session_id: data.id },
      { headers: corsHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown fetch error";
    console.error("[stripe/checkout] fetch error:", err);
    return NextResponse.json(
      { error: `Stripe call failed: ${message}` },
      { status: 502, headers: corsHeaders }
    );
  }
}

function absoluteOrigin(request: NextRequest): string {
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (request.nextUrl.protocol ? request.nextUrl.protocol.replace(":", "") : "https");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  return `${proto}://${host}`;
}
