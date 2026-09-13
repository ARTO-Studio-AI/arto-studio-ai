import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import path from "path";
import "@/lib/skills"; // side-effect: register all skills
import { getSkill } from "@/lib/skills/registry";
import { runSkill, SkillNotFoundError, SkillExecutionError } from "@/lib/skills/engine";
import { requireClientAuth } from "@/lib/clients/auth";
import { refundTrialCall } from "@/lib/clients/store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
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

/* ── Public skill rate limiter (per IP, 10/hora, persistente; ver lib/rate-limit) ── */

const PUBLIC_RATE_LIMIT = 10;

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

  const ip = getClientIp(request);

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
  // H-39: solo los clientes con tope de trial reciben devolucion si el skill cae a fallback.
  let refundable = false;

  if (skill.public) {
    const rl = await checkRateLimit(`skill:${slug}:ip:${ip}`, PUBLIC_RATE_LIMIT);
    if (rl.limited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later.", retryAfter: rl.retryAfterSec },
        { status: 429, headers: { ...corsHeaders, "Retry-After": String(rl.retryAfterSec) } }
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
    refundable = auth.client.trial_calls_limit !== null;
  }

  const ctx: SkillContext = { clientId, ip };

  try {
    const result = await runSkill(slug, validation.data, ctx);
    // H-39 (2026-09-13): requireClientAuth ya cobro la llamada del trial. Si Claude
    // fallo y el engine respondio con el fallback generico, se la devolvemos al
    // cliente con tope. Los clientes sin tope (trial_calls_limit null) no se tocan.
    if (result.source === "fallback" && refundable && clientId) {
      const left = await refundTrialCall(clientId);
      console.log(
        JSON.stringify({ event: "trial_refund", skill_slug: slug, client_id: clientId, trial_calls_used: left })
      );
    }
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
