import { SITE_URL } from "@/lib/site-url";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("email")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    return new Response(
      `<html><body style="font-family:system-ui;padding:40px;max-width:480px;margin:auto;color:#525252"><h1>Token not found</h1><p>The unsubscribe link is invalid or expired. <a href="${SITE_URL}">Go to the library</a>.</p></body></html>`,
      { headers: { "Content-Type": "text/html" }, status: 404 },
    );
  }

  return new Response(
    `<html><body style="font-family:system-ui;padding:40px;max-width:480px;margin:auto;color:#0a0a0a"><h1 style="font-size:28px;letter-spacing:-0.5px">Unsubscribed</h1><p style="color:#525252">${data.email} won&rsquo;t receive any more emails from ARTO Studio AI &middot; Prompt Library. If this was a mistake, you can resubscribe anytime from <a href="${SITE_URL}" style="color:#0a0a0a">the site</a>.</p></body></html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}
