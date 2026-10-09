import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import path from "path";
import postgres from "postgres";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { addToMarketingList } from "@/lib/marketing-list";
import { sendListConfirmation, sendRoastReport } from "@/lib/mailer";
import { signShare, verifyReportToken } from "@/lib/roast-share";
import type { RoastResult } from "@/lib/roast-types";

// Load .env.local explicitly (workaround for Next.js 16 Turbopack env loading)
config({
  path: path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local"),
  override: true,
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

let cached: ReturnType<typeof postgres> | null = null;
function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = postgres(url, { ssl: "require", max: 1, prepare: false });
  return cached;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/roast/email  { email, reportToken, marketing? }
 *
 * Guarda el correo en la traza del roast y le manda el reporte completo.
 * 2026-10-07 (auditoria de Fable del PR #76):
 *   - La traza se identifica con `reportToken` (id firmado que devuelve /api/roast),
 *     no por brandName: nadie puede pedir el roast de otro ni pisarle el lead.
 *   - Solo se escribe si la traza no tiene correo o ya es el mismo (no se sobreescribe).
 *   - Limite por IP (10/h) y por destinatario (3/h): no sirve para bombardear a un tercero.
 *   - La casilla de promociones del roast es doble opt-in: queda "pending" y se manda un
 *     correo de confirmacion. Solo al confirmar entra a la lista y recibe la bienvenida.
 */
const RATE_LIMIT = 10;
const PER_RECIPIENT = 3;

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(`roast-email:ip:${getClientIp(request)}`, RATE_LIMIT);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later.", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { email?: string; reportToken?: string; marketing?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400, headers: corsHeaders });
  }
  const traceId = verifyReportToken(body.reportToken);
  if (!traceId) {
    return NextResponse.json({ error: "Valid reportToken is required", field: "reportToken" }, { status: 400, headers: corsHeaders });
  }

  const perTo = await checkRateLimit(`roast-email:to:${email}`, PER_RECIPIENT);
  if (perTo.limited) {
    return NextResponse.json(
      { error: "Too many emails to this address. Try again later.", retryAfter: perTo.retryAfterSec },
      { status: 429, headers: { ...corsHeaders, "Retry-After": String(perTo.retryAfterSec) } },
    );
  }

  const sql = getDb();
  if (!sql) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503, headers: corsHeaders });
  }

  let row: { id: number; input: unknown; output: unknown } | undefined;
  try {
    [row] = await sql`
      UPDATE skill_traces
      SET email = ${email}
      WHERE id = ${traceId}
        AND skill_slug = 'brand-roast'
        AND source = 'ai'
        AND created_at > now() - interval '24 hours'
        AND (email IS NULL OR lower(email) = ${email})
      RETURNING id, input, output
    `;
  } catch (error) {
    console.error("[/api/roast/email] DB update failed:", error);
    return NextResponse.json({ error: "Could not save the email. Try again." }, { status: 500, headers: corsHeaders });
  }
  if (!row) {
    return NextResponse.json({ error: "Roast not found or already claimed." }, { status: 404, headers: corsHeaders });
  }

  console.log(JSON.stringify({ event: "roast_email_capture", trace_id: row.id }));

  // Reporte completo (transaccional: lo pidio al dejar su correo para ver el reporte).
  const input = (row.input ?? {}) as { brandName?: string; lang?: string; industry?: string };
  const result = row.output as RoastResult;
  const lang = input.lang === "es" ? "es" : "en";
  const brand = (input.brandName ?? "").slice(0, 100);
  const h = (result.headline ?? "").slice(0, 160);
  const payload = {
    brand,
    score: String(result.overall),
    s: String(result.strategy.score),
    c: String(result.creativity.score),
    n: String(result.narrative.score),
    d: String(result.digital.score),
    h,
    lang,
  };
  const q = new URLSearchParams({ brand, score: payload.score, s: payload.s, c: payload.c, n: payload.n, d: payload.d, lang });
  const sig = signShare(payload);
  if (sig && h) {
    q.set("h", h);
    q.set("sig", sig);
  }
  const reportSent = await sendRoastReport(email, { lang, brand, industry: input.industry, result, shareQuery: q.toString() });

  // Promociones: doble opt-in. Queda pendiente hasta que confirme desde su buzon.
  let confirmationSent = false;
  if (body.marketing === true) {
    const list = await addToMarketingList({ email, source: "roast", requireConfirm: true });
    if (list.ok && list.needsConfirmation && list.unsubscribeToken) {
      confirmationSent = await sendListConfirmation(email, lang, list.unsubscribeToken);
    }
  }

  return NextResponse.json(
    { ok: true, trace_id: row.id, report_sent: reportSent, confirmation_sent: confirmationSent },
    { headers: corsHeaders },
  );
}
