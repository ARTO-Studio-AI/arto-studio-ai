import { SITE_URL, SITE_HOST } from "@/lib/site-url";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export const runtime = "nodejs";
export const maxDuration = 60;

// Lazy-init inside handler to avoid build-time eval

// Reuse the same digest HTML structure. For brevity here, inline a minimal version.
function buildHtml(unsubscribeUrl: string, data: { featured: any[]; topQueries: any[]; gap: any | null }) {
  const f = data.featured.map((p) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e5e5"><a href="${SITE_URL}/prompts/${p.id}" style="color:#0a0a0a;text-decoration:none;font-weight:600">${p.title_en}</a><br><span style="font-size:12px;color:#737373">${p.id} · ${p.category}</span></td></tr>`).join("");
  const q = data.topQueries.length === 0 ? "" : data.topQueries.map((q: any) => `<li>${q.query} <span style="color:#a3a3a3">· ${q.n}×</span></li>`).join("");
  const gapHtml = data.gap ? `<p><strong>"${data.gap.query}"</strong> — similarity ${Number(data.gap.top_similarity).toFixed(2)}.</p>` : `<p>Catalog is matching most queries well this week.</p>`;
  return `<html><body style="margin:0;padding:0;background:#fafafa;font-family:'Manrope',sans-serif;color:#0a0a0a"><center><table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto"><tr><td style="height:48px">&nbsp;</td></tr><tr><td style="padding:0 24px"><img src="${SITE_URL}/brand/arto-logo-black.png" alt="ARTO Studio AI" width="80" height="24" style="display:block"></td></tr><tr><td style="height:32px">&nbsp;</td></tr><tr><td style="padding:0 24px"><h1 style="margin:0;font-size:32px;font-weight:600;letter-spacing:-0.5px">This week in the library.</h1></td></tr><tr><td style="height:24px">&nbsp;</td></tr><tr><td style="padding:0 24px"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff;border:1px solid #e5e5e5;border-radius:12px"><tr><td style="padding:24px"><h2 style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#737373">✨ Featured</h2><table width="100%">${f}</table></td></tr></table></td></tr><tr><td style="height:16px">&nbsp;</td></tr><tr><td style="padding:0 24px"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff;border:1px solid #e5e5e5;border-radius:12px"><tr><td style="padding:24px"><h2 style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#737373">🔍 Top searches</h2><ul style="margin:0;padding-left:20px;color:#525252">${q}</ul></td></tr></table></td></tr><tr><td style="height:16px">&nbsp;</td></tr><tr><td style="padding:0 24px"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fff;border:1px solid #e5e5e5;border-radius:12px"><tr><td style="padding:24px"><h2 style="margin:0 0 12px 0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#737373">📡 Gap</h2>${gapHtml}</td></tr></table></td></tr><tr><td style="height:32px">&nbsp;</td></tr><tr><td align="center" style="padding:0 24px"><a href="${SITE_URL}/prompts" style="display:inline-block;background:#0a0a0a;color:#fff;padding:14px 28px;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px">Browse the catalog →</a></td></tr><tr><td style="height:48px">&nbsp;</td></tr><tr><td style="padding:0 24px;font-size:11px;color:#a3a3a3;text-align:center"><a href="${unsubscribeUrl}" style="color:#a3a3a3;text-decoration:underline">Unsubscribe</a> · <a href="${SITE_URL}" style="color:#a3a3a3">${SITE_HOST}</a></td></tr></table></center></body></html>`;
}

export async function GET(request: NextRequest) {
  // Auth del cron: Vercel manda `Authorization: Bearer <CRON_SECRET>`. Falla cerrado:
  // sin CRON_SECRET configurado la ruta responde 401 y no manda nada, en vez de quedar
  // abierta a cualquiera que la llame. CRON_SECRET se crea en Vercel el 2026-09-11 (D5).
  const auth = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 500 });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const admin = createAdminClient();

  // Featured
  const { data: featured } = await admin.from("prompts").select("id, title_en, category").eq("is_featured", true).eq("is_published", true).order("featured_at", { ascending: false }).limit(5);

  // Top queries last 7 days (raw SQL via admin)
  const { data: rawQueries } = await admin.from("search_queries").select("query").gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()).limit(2000);
  const freq = new Map<string, number>();
  for (const r of rawQueries ?? []) {
    const k = (r.query || "").trim().toLowerCase();
    if (k) freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const topQueries = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([query, n]) => ({ query, n }));

  // Gap
  const { data: gapRows } = await admin.from("search_queries").select("query, top_similarity").gte("created_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()).lt("top_similarity", 0.45).order("top_similarity").limit(1);
  const gap = gapRows?.[0] ?? null;

  // Subscribers
  const { data: subscribers } = await admin.from("newsletter_subscribers").select("email, unsubscribe_token").eq("status", "active");

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "no active subscribers" });
  }

  let sent = 0, failed = 0;
  for (const sub of subscribers) {
    const unsubscribeUrl = `${SITE_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(sub.unsubscribe_token)}`;
    try {
      await resend.emails.send({
        from: "ARTO Studio AI <noreply@artostudio.ai>",
        to: sub.email,
        subject: "Weekly digest — ARTO Studio AI · Prompt Library",
        html: buildHtml(unsubscribeUrl, { featured: featured ?? [], topQueries, gap }),
      });
      await admin.from("newsletter_subscribers").update({ last_sent_at: new Date().toISOString() }).eq("email", sub.email);
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
