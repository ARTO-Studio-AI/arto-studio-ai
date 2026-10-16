import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM } from "@/lib/email";
import { unsubscribeUrl } from "@/lib/mailer";
import { digestEmail, type DigestPrompt } from "@/lib/email-templates/digest";
import { Resend } from "resend";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Resumen semanal (cron de los lunes, vercel.json). Desde el 2026-10-16 usa la plantilla de
 * marca de src/lib/email-templates/digest.ts: solo prompts destacados, linea editorial y
 * biblioteca, en el idioma del suscriptor. Ya no lee search_queries: las busquedas de los
 * usuarios y la brecha del catalogo son datos internos y no van a la lista. */

const FEATURED = 5;
/** Tamano de cada `in(...)`: PostgREST lo manda en la URL y una lista larga la rompe. */
const CHUNK = 150;

function chunks<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK));
  return out;
}

/** Idioma guardado del suscriptor: el del registro (profiles.signup_locale) o el de la
 *  lista de espera (waitlist.locale). Sin dato, espanol. */
async function languages(
  admin: ReturnType<typeof createAdminClient>,
  subs: { email: string; user_id: string | null }[],
): Promise<Map<string, "es" | "en">> {
  const out = new Map<string, "es" | "en">();
  const userIds = subs.map((s) => s.user_id).filter((v): v is string => !!v);
  const byUser = new Map<string, string>();
  for (const ids of chunks(userIds)) {
    const { data } = await admin.from("profiles").select("id, signup_locale").in("id", ids);
    for (const p of (data ?? []) as { id: string; signup_locale: string | null }[]) {
      if (p.signup_locale) byUser.set(p.id, p.signup_locale);
    }
  }
  const byEmail = new Map<string, string>();
  for (const emails of chunks(subs.map((s) => s.email))) {
    const { data } = await admin.from("waitlist").select("email, locale").in("email", emails);
    for (const w of (data ?? []) as { email: string; locale: string | null }[]) {
      if (w.locale) byEmail.set(w.email, w.locale);
    }
  }
  for (const s of subs) {
    const raw = (s.user_id && byUser.get(s.user_id)) || byEmail.get(s.email);
    out.set(s.email, raw === "en" ? "en" : "es");
  }
  return out;
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

  const { data: featured } = await admin
    .from("prompts")
    .select("id, title_en, title_es, category")
    .eq("is_featured", true)
    .eq("is_published", true)
    .order("featured_at", { ascending: false })
    .limit(FEATURED);
  const prompts = (featured ?? []) as DigestPrompt[];
  // Sin destacados el correo no tiene nada que decir: no se manda.
  if (prompts.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "no featured prompts" });
  }

  const { data: subscribers } = await admin
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token, user_id")
    .eq("status", "active");

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "no active subscribers" });
  }

  const subs = subscribers as { email: string; unsubscribe_token: string; user_id: string | null }[];
  const langOf = await languages(admin, subs);

  let sent = 0, failed = 0;
  for (const sub of subs) {
    const lang = langOf.get(sub.email) ?? "es";
    const unsub = unsubscribeUrl(sub.unsubscribe_token, lang);
    const m = digestEmail({ lang, prompts, unsubscribeUrl: unsub });
    try {
      const { error } = await resend.emails.send({
        // Mismo remitente que src/lib/email.ts (H-44); antes estaba escrito a mano.
        from: EMAIL_FROM,
        to: sub.email,
        subject: m.subject,
        html: m.html,
        text: m.text,
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "kind", value: "digest" }],
      });
      if (error) throw new Error(error.message);
      await admin.from("newsletter_subscribers").update({ last_sent_at: new Date().toISOString() }).eq("email", sub.email);
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
