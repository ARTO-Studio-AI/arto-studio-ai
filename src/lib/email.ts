import { Resend } from "resend";
import { SITE_URL } from "@/lib/site";

/**
 * Resend wrapper + transactional email templates for ARTO Studio AI.
 *
 * Sender: during Session 6 MVP we use Resend's testing sender
 * `onboarding@resend.dev`. Swap to `no-reply@artogroup.com` once the
 * domain is verified in the Resend dashboard.
 */

const FROM = process.env.EMAIL_FROM || "ARTO Studio AI <onboarding@resend.dev>";

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
      from: FROM,
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

/* ── Templates ────────────────────────────────────────── */

export async function sendTrialWelcomeEmail(params: {
  to: string;
  name: string;
  apiKey: string;
  trialCalls: number;
  upgradeUrl: string;
}): Promise<boolean> {
  const { to, name, apiKey, trialCalls, upgradeUrl } = params;
  const subject = "Your ARTO Studio AI API key";
  const firstName = name.trim().split(" ")[0] || "there";

  const text = `Hi ${firstName},

Welcome to ARTO Studio AI. Your trial includes ${trialCalls} free calls to Brand Positioning — ARTO's proprietary methodology applied to your brand.

Your API key (store it securely — it will only be shown this one time):

${apiKey}

Quick start:

curl -X POST ${SITE_URL}/api/skills/brand-positioning \\
  -H "Content-Type: application/json" \\
  -H "x-arto-api-key: ${apiKey}" \\
  -d '{"brandName":"Your Brand","industry":"your industry","targetAudience":"who you serve","competitors":["competitor1","competitor2"]}'

When you run out of trial calls, upgrade to Starter for $99/mo (unlimited calls):
${upgradeUrl}

— ARTO Studio AI`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
  <h1 style="font-size: 24px; margin: 0 0 16px;">Welcome to ARTO Studio AI</h1>
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>Your trial includes <strong>${trialCalls} free calls</strong> to <strong>Brand Positioning</strong> — ARTO's proprietary methodology applied to your brand.</p>

  <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-top: 32px;">Your API key</h2>
  <p style="font-size: 13px; color: #666; margin: 0 0 8px;">Store this securely — it will only be shown once.</p>
  <code style="display: block; padding: 12px 16px; background: #f5f5f5; border-radius: 8px; font-family: 'SF Mono', Menlo, monospace; font-size: 13px; word-break: break-all;">${escapeHtml(apiKey)}</code>

  <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-top: 32px;">Quick start</h2>
  <pre style="padding: 12px 16px; background: #f5f5f5; border-radius: 8px; font-family: 'SF Mono', Menlo, monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">curl -X POST ${SITE_URL}/api/skills/brand-positioning \\
  -H "Content-Type: application/json" \\
  -H "x-arto-api-key: ${escapeHtml(apiKey)}" \\
  -d '{"brandName":"Your Brand","industry":"your industry","targetAudience":"who you serve","competitors":["competitor1","competitor2"]}'</pre>

  <p style="margin-top: 32px;">When you run out of trial calls, you can upgrade to Starter ($99/mo, unlimited calls):</p>
  <p><a href="${escapeHtml(upgradeUrl)}" style="display: inline-block; padding: 12px 24px; background: #111; color: white; text-decoration: none; border-radius: 999px; font-weight: 500;">Upgrade to Starter</a></p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0 16px;">
  <p style="font-size: 12px; color: #999;">— ARTO Studio AI</p>
</body>
</html>`;

  return send({ to, subject, html, text });
}

export async function sendUpgradeConfirmationEmail(params: {
  to: string;
  name: string;
}): Promise<boolean> {
  const { to, name } = params;
  const subject = "You're now on ARTO Studio AI Starter";
  const firstName = name.trim().split(" ")[0] || "there";

  const text = `Hi ${firstName},

You've upgraded to ARTO Studio AI Starter. Your API key now has unlimited access to Brand Positioning.

Your existing key still works — no need to regenerate.

Thanks for backing us.

— ARTO Studio AI`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
  <h1 style="font-size: 24px; margin: 0 0 16px;">You're in 🎉</h1>
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>You've upgraded to <strong>ARTO Studio AI Starter</strong>. Your API key now has unlimited access to Brand Positioning.</p>
  <p>Your existing key still works — no need to regenerate.</p>
  <p>Thanks for backing us.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0 16px;">
  <p style="font-size: 12px; color: #999;">— ARTO Studio AI</p>
</body>
</html>`;

  return send({ to, subject, html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
