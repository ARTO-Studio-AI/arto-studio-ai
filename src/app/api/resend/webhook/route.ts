import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOWNGRADABLE, listChangeFor } from "@/lib/resend-webhook";

export const runtime = "nodejs";

/* POST /api/resend/webhook (9 oct 2026). Resend firma con Svix: se verifica contra
 * RESEND_WEBHOOK_SECRET (el whsec_ del webhook en el panel de Resend) antes de leer
 * nada. Sin secreto responde 503 y no toca la base. Los cambios son idempotentes
 * (solo bajan de active/pending), asi que un reintento de Resend no hace dano.
 * Logica de que evento cambia que: src/lib/resend-webhook.ts. */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend/webhook] RESEND_WEBHOOK_SECRET missing, cannot verify");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const payload = await request.text();
  let event: unknown;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const change = listChangeFor(event as Parameters<typeof listChangeFor>[0]);
  if (!change) return NextResponse.json({ ok: true, ignored: true });

  const patch: Record<string, string> = { status: change.status };
  if (change.status === "unsubscribed") patch.unsubscribed_at = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("newsletter_subscribers")
    .update(patch)
    .in("email", change.emails)
    .in("status", [...DOWNGRADABLE])
    .select("email");
  if (error) {
    console.error("[resend/webhook] update failed:", error.message);
    // 500 para que Resend reintente.
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  console.log(JSON.stringify({ event: "resend_list_change", status: change.status, reason: change.reason, updated: data?.length ?? 0 }));
  return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
}
