import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import path from "path";
import "@/lib/skills"; // side-effect: register all skills
import { getSkill } from "@/lib/skills/registry";
import { runSkill } from "@/lib/skills/engine";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { RoastRequest, RoastResult, RoastResponse } from "@/lib/roast-types";
import type { SkillContext } from "@/lib/skills/types";

/**
 * Legacy alias: /api/roast → brand-roast skill.
 * Preserves the original { source, result } shape so the existing /roast page
 * and any external clients keep working unchanged.
 */

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

/* ── Rate limiter (per IP, 10/hora, persistente en Postgres; ver lib/rate-limit) ── */

const RATE_LIMIT = 10;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const rl = await checkRateLimit(`roast:ip:${ip}`, RATE_LIMIT);
  if (rl.limited) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later.", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", field: "body" },
      { status: 400, headers: corsHeaders }
    );
  }

  const skill = getSkill("brand-roast");
  if (!skill) {
    return NextResponse.json(
      { error: "Brand Roast skill not registered" },
      { status: 500, headers: corsHeaders }
    );
  }

  const validation = skill.inputValidator(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, field: validation.field },
      { status: 400, headers: corsHeaders }
    );
  }

  const ctx: SkillContext = { clientId: null, ip };

  try {
    const skillResp = await runSkill<RoastRequest, RoastResult>(
      "brand-roast",
      validation.data as RoastRequest,
      ctx
    );
    const legacy: RoastResponse = {
      source: skillResp.source,
      result: skillResp.output,
    };
    return NextResponse.json(legacy, { headers: corsHeaders });
  } catch (error) {
    console.error("[/api/roast] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
