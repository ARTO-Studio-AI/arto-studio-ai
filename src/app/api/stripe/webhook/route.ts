import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import path from "path";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getClientById, updateClient } from "@/lib/clients/store";
import { sendUpgradeConfirmationEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  processStripeEvent,
  type ProfilePatch,
  type ProfileRef,
  type WebhookDeps,
} from "@/lib/stripe-webhook";

// Load .env.local explicitly (workaround for Next.js 16 Turbopack env loading)
config({
  path: path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local"),
  override: true,
});

export const runtime = "nodejs";
export const maxDuration = 30;

/* ── POST /api/stripe/webhook ─ handle Stripe events ──
 *
 * Stripe posts events here. We verify the signature against
 * STRIPE_WEBHOOK_SECRET, record the event id in `stripe_events` (idempotency)
 * and hand the event to processStripeEvent (src/lib/stripe-webhook.ts):
 *
 *   checkout.session.completed      metadata.user_id + tier=pro → profiles.tier='pro'
 *                                   metadata.client_id           → clients.tier='starter'
 *   customer.subscription.updated   profiles.subscription_status / subscription_ends_at
 *   customer.subscription.deleted   profiles.tier='free' / clients.tier='trial'
 *   invoice.payment_failed          profiles.subscription_status='past_due'
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET missing, cannot verify");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Raw body required for signature verification.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  console.log(
    JSON.stringify({
      event: "stripe_webhook_received",
      type: event.type,
      id: event.id,
    })
  );

  try {
    const outcome = await processStripeEvent(event, buildDeps());
    if (outcome.status === "already_processed") {
      return NextResponse.json({ received: true, status: "already processed" }, { status: 200 });
    }
    return NextResponse.json({ received: true, status: outcome.status }, { status: 200 });
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err);
    // Return 500 so Stripe retries. Only do this for transient failures.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

const PROFILE_COLUMNS = "id, tier, stripe_subscription_id";

function buildDeps(): WebhookDeps {
  const admin = createAdminClient();

  const findProfile = async (column: string, value: string): Promise<ProfileRef | null> => {
    const { data, error } = await admin
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq(column, value)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`profiles lookup by ${column} failed: ${error.message}`);
    return data ? (data as ProfileRef) : null;
  };

  return {
    async recordEvent(id, type) {
      // INSERT ... ON CONFLICT DO NOTHING RETURNING id, vía PostgREST:
      // ignoreDuplicates + select devuelve fila solo si el insert entró.
      const { data, error } = await admin
        .from("stripe_events")
        .upsert({ id, type }, { onConflict: "id", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(`stripe_events insert failed: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
    async forgetEvent(id) {
      await admin.from("stripe_events").delete().eq("id", id);
    },
    findProfileById: (id) => findProfile("id", id),
    findProfileBySubscription: (subscriptionId) =>
      findProfile("stripe_subscription_id", subscriptionId),
    findProfileByCustomer: (customerId) => findProfile("stripe_customer_id", customerId),
    async updateProfile(id, patch: ProfilePatch) {
      const { error } = await admin
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("[stripe/webhook] profiles update failed:", error.message);
        return false;
      }
      return true;
    },
    getClientById,
    updateClient,
    sendUpgradeConfirmationEmail,
  };
}
