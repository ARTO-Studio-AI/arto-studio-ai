import { EMAIL_FROM } from "@/lib/email";
import { Resend } from "resend";
import { SITE_URL } from "@/lib/site-url";
import { getWelcomeContent } from "@/lib/email-config";
import { welcomeEmail } from "@/lib/email-templates/welcome";
import { roastReportEmail, type RoastReportInput } from "@/lib/email-templates/roast-report";
import { listConfirmationEmail } from "@/lib/email-templates/confirm";

/* Envio de los correos de marca (2026-10-07). Nunca lanza: el correo es best-effort y no
 * debe tumbar el roast ni el login. El de bienvenida es de promociones y lleva
 * List-Unsubscribe (Gmail y Apple Mail muestran el boton de baja). */

async function deliver(p: { to: string; subject: string; html: string; text: string; headers?: Record<string, string>; tag: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[mailer] RESEND_API_KEY ausente; no se envio:", p.tag);
    return false;
  }
  try {
    const { data, error } = await new Resend(key).emails.send({
      from: EMAIL_FROM,
      to: p.to,
      subject: p.subject,
      html: p.html,
      text: p.text,
      headers: p.headers,
      tags: [{ name: "kind", value: p.tag }],
    });
    if (error) {
      console.error("[mailer] envio fallo:", p.tag, error);
      return false;
    }
    console.log(JSON.stringify({ event: "email_sent", kind: p.tag, id: data?.id }));
    return true;
  } catch (err) {
    console.error("[mailer] error:", p.tag, err);
    return false;
  }
}

export function unsubscribeUrl(token: string, lang: "es" | "en" = "es"): string {
  return `${SITE_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}&lang=${lang}`;
}

/** Doble opt-in del roast: correo con el boton para confirmar la inscripcion. */
export async function sendListConfirmation(to: string, lang: "es" | "en", token: string): Promise<boolean> {
  const url = `${SITE_URL}/api/newsletter/confirm?token=${encodeURIComponent(token)}&lang=${lang}`;
  const m = listConfirmationEmail(lang, url);
  return deliver({ to, ...m, tag: "list_confirmation" });
}

export async function sendRoastReport(to: string, input: RoastReportInput): Promise<boolean> {
  const m = roastReportEmail(input);
  return deliver({ to, ...m, tag: "roast_report" });
}

export async function sendWelcome(to: string, lang: "es" | "en", unsubscribeToken: string | null): Promise<boolean> {
  const unsub = unsubscribeToken ? unsubscribeUrl(unsubscribeToken, lang) : undefined;
  const m = welcomeEmail(await getWelcomeContent(), lang, unsub);
  return deliver({
    to,
    ...m,
    tag: "welcome",
    headers: unsub ? { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
  });
}
