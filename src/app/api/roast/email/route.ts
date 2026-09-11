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
 * Stores in DB if available, always logs to console.
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

  console.log(
    JSON.stringify({
      event: "roast_email_capture",
      timestamp: new Date().toISOString(),
      email,
      brand: brandName || "unknown",
    })
  );

  // Update the most recent trace for this brand with the email (if DB available)
  const sql = getDb();
  if (sql) {
    try {
      await sql`
        UPDATE roast_traces
        SET email = ${email}
        WHERE id = (
          SELECT id FROM roast_traces
          WHERE brand_name = ${brandName}
            AND email IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        )
      `;
    } catch (error) {
      console.error("[/api/roast/email] DB update failed:", error);
    }
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
