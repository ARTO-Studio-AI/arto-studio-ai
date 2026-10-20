import { SITE_URL } from "@/lib/site-url";
import { Resend } from "resend";
import { C, F, button, checks, esc, eyebrow, hero, layout, signoff } from "@/lib/email-templates/layout";

/**
 * Resend wrapper + transactional email templates for ARTO Studio AI.
 *
 * Sender: EMAIL_FROM (en Vercel, `hola@creative.artostudio.ai`). Si falta, cae al
 * remitente de pruebas de Resend. Los correos de acceso los manda Supabase desde
 * `noreply@artostudio.ai`: ver D13 en docs/DECISIONES.md.
 */

/**
 * Remitente unico de todo correo que mande la app. Exportado desde el
 * 2026-09-13 (H-44) para que el cron del digest use el mismo en vez de uno
 * escrito a mano. Mismo valor y mismo default que antes.
 */
export const EMAIL_FROM = process.env.EMAIL_FROM || "ARTO Studio AI <onboarding@resend.dev>";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/**
 * Generic send helper. Returns true on success, false on failure (logs error).
 * Never throws — email is best-effort; callers shouldn't fail the main flow
 * just because email didn't deliver.
 */
async function send(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — email not sent:", params.subject);
    return false;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      console.error("[email] send failed:", error);
      return false;
    }
    console.log(JSON.stringify({ event: "email_sent", to: params.to, subject: params.subject, id: data?.id }));
    return true;
  } catch (err) {
    console.error("[email] send threw:", err);
    return false;
  }
}

/* ── Templates ──────────────────────────────────────────
 * Desde el 2026-10-20 (regla de Victor del 16 oct) estos dos correos tambien van con
 * el diseno de marca de `layout()`. Son de la API de skills (clientes que ya tienen
 * llave), en ingles como siempre. Starter ya no se vende (D7): la bienvenida de prueba
 * manda a escribir a contact@artogroup.com en vez de ofrecer el plan. */

const CODE_STYLE = `display:block;padding:14px 16px;background:${C.paper};border:1px solid ${C.line};border-radius:10px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12px;line-height:18px;color:${C.ink};word-break:break-all;white-space:pre-wrap;`;

export async function sendTrialWelcomeEmail(params: {
  to: string;
  name: string;
  apiKey: string;
  trialCalls: number;
  upgradeUrl: string;
}): Promise<boolean> {
  const { to, name, apiKey, trialCalls } = params;
  const subject = "Your ARTO Studio AI API key";
  const firstName = name.trim().split(" ")[0] || "there";
  const curl = `curl -X POST ${SITE_URL}/api/skills/brand-positioning \\
  -H "Content-Type: application/json" \\
  -H "x-arto-api-key: ${apiKey}" \\
  -d '{"brandName":"Your Brand","industry":"your industry","targetAudience":"who you serve","competitors":["competitor1","competitor2"]}'`;
  const reason = "You're receiving this because you requested an ARTO Studio AI API key.";

  const text = `Hi ${firstName},

Welcome to ARTO Studio AI. Your trial includes ${trialCalls} free calls to Brand Positioning, ARTO's methodology applied to your brand.

Your API key (store it securely: it is only shown this one time):

${apiKey}

Quick start:

${curl}

When your trial calls run out, write to contact@artogroup.com to keep using it.

ARTO Studio AI

--
${reason}`;

  const body = `
    ${hero({ eyebrow: "Your API key", title: "Welcome to", accent: "the studio.", intro: `Hi ${firstName}, your trial includes ${trialCalls} free calls to Brand Positioning, ARTO's methodology applied to your brand.` })}
    <div style="margin:28px 0 8px 0;">${eyebrow("Your key")}</div>
    <div style="font-family:${F.body};font-size:13px;line-height:20px;color:${C.ink2};margin:0 0 10px 0;">Store it securely: it is only shown this one time.</div>
    <code style="${CODE_STYLE}">${esc(apiKey)}</code>
    <div style="margin:28px 0 10px 0;">${eyebrow("Quick start")}</div>
    <pre style="${CODE_STYLE}margin:0;">${esc(curl)}</pre>
    <div style="font-family:${F.body};font-size:15px;line-height:23px;color:${C.ink2};margin:24px 0 16px 0;">When your trial calls run out, write to us and we'll keep you going.</div>
    ${button("Write to ARTO", "mailto:contact@artogroup.com", "dark")}
    ${signoff("Talk soon.")}`;

  const html = layout({ lang: "en", preheader: "Your ARTO Studio AI API key and a quick start.", body, reason });
  return send({ to, subject, html, text });
}

export async function sendUpgradeConfirmationEmail(params: {
  to: string;
  name: string;
}): Promise<boolean> {
  const { to, name } = params;
  const subject = "You're now on ARTO Studio AI Starter";
  const firstName = name.trim().split(" ")[0] || "there";
  const reason = "You're receiving this because you upgraded your ARTO Studio AI API plan.";

  const text = `Hi ${firstName},

You've upgraded to ARTO Studio AI Starter. Your API key now has unlimited access to Brand Positioning.

Your existing key still works: no need to regenerate it.

Thanks for backing us.

ARTO Studio AI

--
${reason}`;

  const body = `
    ${hero({ eyebrow: "Starter", title: "You're", accent: "in.", intro: `Hi ${firstName}, you've upgraded to ARTO Studio AI Starter.` })}
    <div style="margin-top:26px;">${checks(["Your API key now has unlimited access to Brand Positioning.", "Your existing key still works: no need to regenerate it."])}</div>
    ${signoff("Thanks for backing us.")}`;

  const html = layout({ lang: "en", preheader: "Your API key now has unlimited access to Brand Positioning.", body, reason });
  return send({ to, subject, html, text });
}
