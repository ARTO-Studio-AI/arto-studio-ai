import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

/* POST  /api/admin/outreach/drafts  body { target_id, regenerate?: boolean }
 *   - Generates a new draft via Claude for the target.
 *   - If a draft already exists and regenerate is false, returns the existing one.
 *   - Upserts into outreach_drafts (status reset to 'draft' on regenerate).
 *
 * PATCH /api/admin/outreach/drafts  body { id, subject?, body?, status? }
 *   - Operator edits to subject/body mark edited_by_human=true.
 *   - status transitions allowed: draft → approved | skipped, approved → draft.
 *
 * The 'sent' status is set by the engine when delivery succeeds; the
 * admin UI cannot manually mark sent. */

const SYSTEM_PROMPT = `You write outreach emails for ARTO Studio AI's growth engine.

ARTO Studio AI is a creative-studio-as-software: 3,000 bilingual prompts, AI skills (brand positioning, architecture), and autonomous creative agents. Built on 15+ years working with Google, Nike, Uber. https://creative.artostudio.ai.

Rules:
- One email at a time. Direct, terse, no marketing fluff.
- Personalize using the target's company, vertical, and the curator notes — show you actually know who they are.
- Spanish must use tú-form (México). Banned in either language: leverage, empower, synergy, holistic, ecosystem, disruptive, scalable, optimize, elevate, robust, potenciar, empoderar, sinergia, robusto, holistico, disruptivo, escalable, optimizar.
- 90-160 words body. Subject under 60 characters.
- Sign every email as: Victor Hugo Celaya, ARTO Studio AI.
- Always close with a single, low-friction ask (try Brand Roast, see /pricing, reply with a yes/no).
- Never invent contact context. If the curator notes say "lost client", acknowledge it; don't pretend a fresh start.

Output STRICT JSON only, no preamble:
{
  "subject": "...",
  "body": "...",
  "language": "en" | "es"
}`;

interface DraftJson {
  subject: string;
  body: string;
  language: "en" | "es";
}

interface TargetForDraft {
  id: string;
  email: string | null;
  name: string | null;
  company: string | null;
  vertical: string | null;
  country: string | null;
  language: string;
  legitimate_interest_score: number | null;
  legitimate_interest_reasoning: string | null;
  metadata: Record<string, unknown> | null;
}

function renderTargetContext(t: TargetForDraft): string {
  const lines = [
    `target_id: ${t.id}`,
    `email: ${t.email ?? "(none on file)"}`,
    `point_person: ${t.name ?? "(unknown)"}`,
    `company: ${t.company ?? "(unknown)"}`,
    `vertical: ${t.vertical ?? "(unknown)"}`,
    `country: ${t.country ?? "(unknown)"}`,
    `language: ${t.language}`,
    `legitimate_interest_score: ${t.legitimate_interest_score ?? "(missing)"}`,
    `curator_reasoning: ${t.legitimate_interest_reasoning ?? "(missing)"}`,
  ];
  const m = t.metadata as Record<string, unknown> | null;
  if (m) {
    if (m.notes) lines.push(`curator_notes: ${String(m.notes)}`);
    if (m.priority) lines.push(`priority: ${String(m.priority)}`);
    if (m.relationship_density) lines.push(`relationship_density: ${String(m.relationship_density)}`);
  }
  return lines.join("\n");
}

function parseDraft(raw: string): DraftJson {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw new Error("draft missing subject/body");
  }
  const lang = parsed.language === "es" ? "es" : "en";
  return {
    subject: (parsed.subject as string).trim(),
    body: (parsed.body as string).trim(),
    language: lang as "en" | "es",
  };
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  "claude-opus-4-5": { input: 15.0, output: 75.0 },
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const targetId = String(body?.target_id ?? "").trim();
  const regenerate = body?.regenerate === true;
  if (!targetId) return NextResponse.json({ error: "target_id required" }, { status: 400 });

  const sb = createAdminClient();

  // Existing draft?
  const { data: existing } = await sb
    .from("outreach_drafts")
    .select("id, subject, body, language, status, edited_by_human, cost_usd, updated_at")
    .eq("target_id", targetId)
    .maybeSingle();
  if (existing && !regenerate) {
    return NextResponse.json({ draft: existing, fresh: false });
  }

  // Fetch target.
  const { data: target, error: tErr } = await sb
    .from("outreach_targets")
    .select(
      "id, email, name, company, vertical, country, language, legitimate_interest_score, legitimate_interest_reasoning, metadata",
    )
    .eq("id", targetId)
    .maybeSingle();
  if (tErr || !target) {
    return NextResponse.json({ error: tErr?.message ?? "target not found" }, { status: 404 });
  }

  // Generate via Anthropic SDK directly (no engine repo dependency).
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }
  const anth = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userPrompt = `Draft one outreach email for the following target. Output STRICT JSON only.\n\n${renderTargetContext(target as TargetForDraft)}`;
  const resp = await anth.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  let draft: DraftJson;
  try {
    draft = parseDraft(text);
  } catch (e) {
    return NextResponse.json(
      { error: `Claude returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  const pricing = PRICING[MODEL] ?? PRICING["claude-sonnet-5"];
  const costUsd =
    (resp.usage.input_tokens / 1_000_000) * pricing.input +
    (resp.usage.output_tokens / 1_000_000) * pricing.output;

  // Upsert.
  const { data: saved, error: sErr } = await sb
    .from("outreach_drafts")
    .upsert(
      {
        target_id: targetId,
        subject: draft.subject,
        body: draft.body,
        language: draft.language,
        status: "draft",
        edited_by_human: false,
        cost_usd: costUsd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "target_id" },
    )
    .select("id, subject, body, language, status, edited_by_human, cost_usd, updated_at")
    .single();
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  return NextResponse.json({ draft: saved, fresh: true });
}

const ALLOWED_STATUSES = new Set(["draft", "approved", "skipped"]);

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.subject === "string") {
    updates.subject = body.subject.trim();
    updates.edited_by_human = true;
  }
  if (typeof body.body === "string") {
    updates.body = body.body.trim();
    updates.edited_by_human = true;
  }
  if (typeof body.status === "string") {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "no updatable fields" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("outreach_drafts")
    .update(updates)
    .eq("id", id)
    .select("id, subject, body, language, status, edited_by_human, cost_usd, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}
