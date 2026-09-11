import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import path from "path";
import postgres from "postgres";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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
 * POST /api/roast/email
 * Associates an email with a brand roast for lead capture.
 *
 * H-28 (2026-09-11): los roasts se guardan en skill_traces (skill_slug =
 * 'brand-roast', columna email), no en roast_traces, que es la tabla del
 * endpoint viejo. Antes este UPDATE iba a roast_traces y nunca pegaba una fila.
 * Ahora se actualiza la traza mas reciente cuyo input->>'brandName' coincide
 * (sin distinguir mayusculas) y se responde 404 si no hay ninguna.
 */
// 10/hora por IP, persistente en Postgres (antes no habia ningun limite aqui).
const RATE_LIMIT = 10;

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(`roast-email:ip:${getClientIp(request)}`, RATE_LIMIT);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later.", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { email?: string; brandName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400, headers: corsHeaders }
    );
  }
  if (!brandName) {
    return NextResponse.json(
      { error: "brandName is required", field: "brandName" },
      { status: 400, headers: corsHeaders }
    );
  }

  console.log(
    JSON.stringify({
      event: "roast_email_capture",
      timestamp: new Date().toISOString(),
      email,
      brand: brandName,
    })
  );

  const sql = getDb();
  if (!sql) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503, headers: corsHeaders }
    );
  }

  try {
    const [row] = await sql`
      UPDATE skill_traces
      SET email = ${email}
      WHERE id = (
        SELECT id FROM skill_traces
        WHERE skill_slug = 'brand-roast'
          AND lower(input->>'brandName') = lower(${brandName})
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id
    `;
    if (!row) {
      return NextResponse.json(
        { error: `No roast found for brand '${brandName}'. Run the roast first, then leave your email.` },
        { status: 404, headers: corsHeaders }
      );
    }
    return NextResponse.json({ ok: true, trace_id: row.id }, { headers: corsHeaders });
  } catch (error) {
    console.error("[/api/roast/email] DB update failed:", error);
    return NextResponse.json(
      { error: "Could not save the email. Try again." },
      { status: 500, headers: corsHeaders }
    );
  }
}
