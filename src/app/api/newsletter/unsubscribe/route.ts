import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionPage } from "@/lib/email-templates/page";
import { setAudienceUnsubscribed } from "@/lib/resend-audience";

/* Baja de la lista. 2026-10-07 (auditoria de Fable, PR #76):
 *   GET  muestra un boton (los escaneres de enlaces abren el GET y no deben dar de baja).
 *   POST da de baja: desde ese boton (via=page, responde HTML) o en un clic desde Gmail o
 *        Apple Mail por List-Unsubscribe (RFC 8058, responde JSON). */

export const runtime = "nodejs";

function langOf(req: NextRequest): "es" | "en" {
  return new URL(req.url).searchParams.get("lang") === "en" ? "en" : "es";
}

export async function GET(request: NextRequest) {
  const lang = langOf(request);
  const es = lang === "es";
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return actionPage({ lang, title: es ? "Enlace incompleto" : "Incomplete link", body: es ? "Al enlace le falta el token." : "The link is missing its token.", status: 400 });
  return actionPage({
    lang,
    title: es ? "¿Darte de baja?" : "Unsubscribe?",
    body: es ? "Dejarás de recibir los correos de promociones de ARTO Studio AI. Los correos que pidas (como tu Brand Roast) siguen llegando." : "You'll stop receiving ARTO Studio AI promotional emails. Emails you request (like your Brand Roast) still arrive.",
    action: { url: `/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}&lang=${lang}`, label: es ? "Sí, darme de baja" : "Yes, unsubscribe me" },
  });
}

export async function POST(request: NextRequest) {
  const lang = langOf(request);
  const es = lang === "es";
  const token = new URL(request.url).searchParams.get("token");
  let viaPage = false;
  try {
    const form = await request.formData();
    viaPage = form.get("via") === "page";
  } catch {
    /* cuerpo vacio o no es form */
  }
  if (!token) {
    return viaPage
      ? actionPage({ lang, title: es ? "Enlace incompleto" : "Incomplete link", body: es ? "Al enlace le falta el token." : "The link is missing its token.", status: 400 })
      : NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("email");
  // Tambien en Resend, para que los Broadcasts respeten la baja (D12). No bloquea la respuesta.
  for (const row of rows ?? []) await setAudienceUnsubscribed(row.email, true);
  if (!viaPage) return error ? NextResponse.json({ error: "error" }, { status: 500 }) : NextResponse.json({ ok: true });
  return actionPage({
    lang,
    title: error ? (es ? "Algo falló" : "Something went wrong") : es ? "Listo, te diste de baja" : "Done, you're unsubscribed",
    body: error ? (es ? "Inténtalo de nuevo en unos minutos." : "Please try again in a few minutes.") : es ? "Ya no te mandaremos promociones. Si fue un error, puedes volver a inscribirte desde el sitio." : "We won't send you promotions anymore. If this was a mistake, you can subscribe again from the site.",
  });
}
