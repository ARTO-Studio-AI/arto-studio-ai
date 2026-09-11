import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import path from "path";
import "@/lib/skills"; // side-effect: register all skills
import { getSkill } from "@/lib/skills/registry";
import { runSkill, SkillNotFoundError, SkillExecutionError } from "@/lib/skills/engine";
import { requireClientAuth } from "@/lib/clients/auth";
import type { SkillContext } from "@/lib/skills/types";

config({
  path: path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local"),
  override: true,
});

export const maxDuration = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-arto-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/* ── Public skill rate limiter (per IP) ────────────────── */

const publicRateMap = new Map<string, number[]>();
const PUBLIC_RATE_LIMIT = 10;
const PUBLIC_RATE_WINDOW_MS = 60 * 60 * 1000;

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = publicRateMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < PUBLIC_RATE_WINDOW_MS);
  publicRateMap.set(ip, recent);
  if (recent.length >= PUBLIC_RATE_LIMIT) return true;
  recent.push(now);
  return false;
}

/* ── POST /api/skills/{slug} ───────────────────────────── */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const skill = getSkill(slug);
  if (!skill) {
    return NextResponse.json(
      { error: `Skill '${slug}' not found` },
      { status: 404, headers: corsHeaders }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // El body se valida ANTES de autenticar: desde la Fase 1B requireClientAuth consume
  // una llamada del trial de forma atomica, y un 400 por JSON o campos invalidos
  // no debe costarle una llamada al cliente.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: corsHeaders }
    );
  }

  const validation = skill.inputValidator(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error, field: validation.field },
      { status: 400, headers: corsHeaders }
    );
  }

  let clientId: string | null = null;

  if (skill.public) {
    if (isIpRateLimited(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later.", retryAfter: 3600 },
        { status: 429, headers: corsHeaders }
      );
    }
  } else {
    const auth = await requireClientAuth(request, slug);
    if (!auth.ok) {
      const body: { error: string; upgrade_url?: string } = { error: auth.error };
      if (auth.upgrade_url) body.upgrade_url = auth.upgrade_url;
      return NextResponse.json(body, { status: auth.status, headers: corsHeaders });
    }
    clientId = auth.client.id;
  }

  const ctx: SkillContext = { clientId, ip };

  try {
    const result = await runSkill(slug, validation.data, ctx);
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof SkillNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: corsHeaders }
      );
    }
    if (error instanceof SkillExecutionError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: corsHeaders }
      );
    }
    console.error(`[/api/skills/${slug}] unexpected error:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
