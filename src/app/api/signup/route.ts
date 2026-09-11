import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import path from "path";
import { createClient } from "@/lib/clients/store";
import { sendTrialWelcomeEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Load .env.local explicitly (workaround for Next.js 16 Turbopack env loading)
config({
  path: path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local"),
  override: true,
});

export const maxDuration = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const TRIAL_CALLS = 5;
const TRIAL_ALLOWED_SKILLS = ["brand-positioning"];
const TRIAL_RATE_LIMIT = 10; // per hour (still hit by trial limit first at 5 total)

/* ── Rate limit por IP para frenar spam de signups (3/hora, persistente en Postgres) ── */

const SIGNUP_RATE_LIMIT = 3; // 3 signups per hour per IP

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const rl = await checkRateLimit(`signup:ip:${ip}`, SIGNUP_RATE_LIMIT);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many signups from this network. Try again in an hour." },
      { status: 429, headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { email?: unknown; name?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; name?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required.", field: "email" },
      { status: 400, headers: corsHeaders }
    );
  }
  if (email.length > 200) {
    return NextResponse.json(
      { error: "Email is too long.", field: "email" },
      { status: 400, headers: corsHeaders }
    );
  }
  if (name.length > 100) {
    return NextResponse.json(
      { error: "Name is too long.", field: "name" },
      { status: 400, headers: corsHeaders }
    );
  }

  const displayName = name || email.split("@")[0];

  const client = await createClient({
    name: displayName,
    email,
    tier: "trial",
    allowed_skills: TRIAL_ALLOWED_SKILLS,
    rate_limit_per_hour: TRIAL_RATE_LIMIT,
    trial_calls_limit: TRIAL_CALLS,
    notes: `Self-service trial signup via /api/signup (ip=${ip})`,
  });

  if (!client) {
    return NextResponse.json(
      {
        error:
          "Failed to create your trial account. Please try again or contact hello@artogroup.com.",
      },
      { status: 500, headers: corsHeaders }
    );
  }

  const upgradeUrl = absoluteUrl(request, `/upgrade?client_id=${client.id}`);

  // Fire-and-forget email — don't block the response on Resend.
  void sendTrialWelcomeEmail({
    to: email,
    name: displayName,
    apiKey: client.api_key,
    trialCalls: TRIAL_CALLS,
    upgradeUrl,
  });

  console.log(
    JSON.stringify({
      event: "signup_created",
      client_id: client.id,
      email,
      ip,
      tier: "trial",
      trial_calls: TRIAL_CALLS,
    })
  );

  return NextResponse.json(
    {
      client_id: client.id,
      api_key: client.api_key,
      api_key_prefix: client.api_key_prefix,
      email: client.email,
      trial_calls_remaining: TRIAL_CALLS,
      allowed_skills: client.allowed_skills,
      upgrade_url: upgradeUrl,
      message:
        "Account created. Your API key is shown once — copy it now. We also emailed it to you.",
    },
    { status: 201, headers: corsHeaders }
  );
}

function absoluteUrl(request: NextRequest, path: string): string {
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (request.nextUrl.protocol ? request.nextUrl.protocol.replace(":", "") : "https");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  return `${proto}://${host}${path}`;
}
