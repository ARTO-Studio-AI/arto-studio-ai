import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM } from "@/lib/email";
import { unsubscribeUrl } from "@/lib/mailer";
import { digestEmail, type DigestPrompt } from "@/lib/email-templates/digest";
import { Resend } from "resend";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Resumen semanal (cron de los lunes, vercel.json). Desde el 2026-10-16 usa la plantilla de
 * marca de src/lib/email-templates/digest.ts: solo prompts destacados, linea editorial y
 * biblioteca, en el idioma del suscriptor. Ya no lee search_queries: las busquedas de los
 * usuarios y la brecha del catalogo son datos internos y no van a la lista.
 *
 * Envio por lotes (auditoria de Fable): resend.batch.send de hasta 100 correos por
 * llamada con una pausa entre lotes (Resend admite 2 solicitudes por segundo), clave de
 * idempotencia por lote y dia, y solo a quien no recibio el digest en los ultimos 6 dias:
 * si la funcion se corta o se relanza a mano, no se repite a nadie. */

const FEATURED = 5;
const BATCH = 100;
const PAUSE_MS = 600;
const RESEND_EVERY_DAYS = 6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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
    const { data, error } = await admin.from("profiles").select("id, signup_locale").in("id", ids);
    if (error) console.warn("[digest] idioma de profiles:", error.message);
    for (const p of (data ?? []) as { id: string; signup_locale: string | null }[]) {
      if (p.signup_locale) byUser.set(p.id, p.signup_locale);
    }
  }
  const byEmail = new Map<string, string>();
  // waitlist guarda el correo en minusculas; filas viejas de la lista pueden no estarlo.
  for (const emails of chunks(subs.map((s) => s.email.toLowerCase()))) {
    const { data, error } = await admin.from("waitlist").select("email, locale").in("email", emails);
    if (error) console.warn("[digest] idioma de waitlist:", error.message);
    for (const w of (data ?? []) as { email: string; locale: string | null }[]) {
      if (w.locale) byEmail.set(w.email.toLowerCase(), w.locale);
    }
  }
  for (const s of subs) {
    const raw = (s.user_id && byUser.get(s.user_id)) || byEmail.get(s.email.toLowerCase());
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

  const { data: featured, error: featuredError } = await admin
    .from("prompts")
    .select("id, title_en, title_es, category")
    .eq("is_featured", true)
    .eq("is_published", true)
    .order("featured_at", { ascending: false })
    .limit(FEATURED);
  if (featuredError) {
    console.error("[digest] prompts:", featuredError.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  const prompts = (featured ?? []) as DigestPrompt[];
  // Sin destacados el correo no tiene nada que decir: no se manda.
  if (prompts.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "no featured prompts" });
  }

  const since = new Date(Date.now() - RESEND_EVERY_DAYS * 86_400_000).toISOString();
  const { data: subscribers, error: subsError } = await admin
    .from("newsletter_subscribers")
    .select("email, unsubscribe_token, user_id")
    .eq("status", "active")
    .or(`last_sent_at.is.null,last_sent_at.lt.${since}`);
  if (subsError) {
    console.error("[digest] suscriptores:", subsError.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "no active subscribers" });
  }

  const subs = subscribers as { email: string; unsubscribe_token: string; user_id: string | null }[];
  const langOf = await languages(admin, subs);

  const day = new Date().toISOString().slice(0, 10);
  let sent = 0, failed = 0;
  for (let i = 0; i < subs.length; i += BATCH) {
    const group = subs.slice(i, i + BATCH);
    const payload = group.map((sub) => {
      const lang = langOf.get(sub.email) ?? "es";
      const unsub = unsubscribeUrl(sub.unsubscribe_token, lang);
      const m = digestEmail({ lang, prompts, unsubscribeUrl: unsub });
      return {
        // Mismo remitente que src/lib/email.ts (H-44); antes estaba escrito a mano.
        from: EMAIL_FROM,
        to: sub.email,
        subject: m.subject,
        html: m.html,
        text: m.text,
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        tags: [{ name: "kind", value: "digest" }],
      };
    });
    // Misma clave para el mismo lote el mismo dia: Resend no lo manda dos veces.
    const idempotencyKey = `digest-${day}-${createHash("sha256").update(group.map((g) => g.email).join(",")).digest("hex").slice(0, 32)}`;
    let res = await resend.batch.send(payload, { idempotencyKey });
    if (res.error?.name === "rate_limit_exceeded") {
      await sleep(1500);
      res = await resend.batch.send(payload, { idempotencyKey });
    }
    if (res.error) {
      console.error("[digest] lote fallo:", res.error.name, res.error.message);
      failed += group.length;
    } else {
      const { error } = await admin
        .from("newsletter_subscribers")
        .update({ last_sent_at: new Date().toISOString() })
        .in("email", group.map((g) => g.email));
      if (error) console.error("[digest] last_sent_at:", error.message);
      sent += group.length;
    }
    if (i + BATCH < subs.length) await sleep(PAUSE_MS);
  }

  return NextResponse.json({ ok: true, sent, failed });
}
