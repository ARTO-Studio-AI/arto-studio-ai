import Anthropic from "@anthropic-ai/sdk";
import { loadKnowledge } from "@/lib/knowledge";
import { buildRoastSystemPrompt, buildRoastUserMessage, roastOutputSchema } from "@/lib/roast-prompt";
import { fetchSiteSnapshot, renderSnapshot } from "@/lib/site-snapshot";
import type { RoastLang, RoastRequest, RoastResult } from "@/lib/roast-types";

/**
 * Brand Roast v2 (2026-10-06): lee el sitio en el servidor y hace UNA llamada al
 * modelo con salida estructurada. Ver site-snapshot.ts y roast-prompt.ts.
 *
 * Modelo: ROAST_MODEL (por defecto claude-opus-5-5) y ROAST_EFFORT (por defecto low).
 * Se eligio midiendo el 2026-10-06 contra Sonnet 5 (el de antes), Sonnet 5.5 y Opus 5.5
 * en low y medium con tres marcas: Opus 5.5 low da las observaciones mas concretas en
 * unos 16 s. Medium tarda 20-23 s sin mejora que justifique la espera.
 * Es independiente de ANTHROPIC_MODEL a proposito: los demas skills usan tool_choice
 * forzado, que Opus 5.5 y Sonnet 5.5 rechazan con 400.
 */

export const ROAST_DEFAULT_MODEL = "claude-opus-5-5";
const ROAST_DEFAULT_EFFORT = "low" as const;
const KNOWLEDGE_KEYS = ["strategy", "narrative", "rubric", "trends"];

/**
 * Tiempo maximo para la llamada al modelo, sin reintentos del SDK (que reintenta
 * timeouts): 7 s de sitio + 45 s caben en el maxDuration de 60. Auditoria de Fable.
 */
const MODEL_TIMEOUT_MS = 45_000;
const EFFORTS = ["low", "medium", "high"] as const;

export class RoastGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoastGenerationError";
  }
}

export interface RoastRun {
  output: RoastResult;
  model: string;
  siteRead: boolean;
  siteReason?: string;
}

function clampScore(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(10, Math.max(1, Math.round(v)));
}

function cleanText(v: unknown): string {
  if (typeof v !== "string") return "";
  // Quita comillas que envuelven TODO el texto y markdown basico que a veces se cuela.
  let t = v.trim().replace(/\*\*/g, "");
  if (t.length > 1 && /^["“]/.test(t) && /["”]$/.test(t) && !/["“”]/.test(t.slice(1, -1))) t = t.slice(1, -1);
  return t.trim();
}

function cleanList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s) => cleanText(s).replace(/^[-•\d.)\s]+/, ""))
    .filter((s) => s.length > 0)
    .slice(0, max);
}

export function weightedOverall(o: Pick<RoastResult, "strategy" | "creativity" | "narrative" | "digital">): number {
  return (
    Math.round(
      (o.strategy.score * 0.3 + o.creativity.score * 0.25 + o.narrative.score * 0.25 + o.digital.score * 0.2) * 10
    ) / 10
  );
}

/** Valida y normaliza lo que regresa el modelo. Lanza si falta algo esencial. */
export function validateRoastOutput(raw: unknown, lang: RoastLang): RoastResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pillars = {} as Record<"strategy" | "creativity" | "narrative" | "digital", { score: number; roast: string }>;
  for (const key of ["strategy", "creativity", "narrative", "digital"] as const) {
    const p = (r[key] ?? {}) as Record<string, unknown>;
    const score = clampScore(p.score);
    const roast = cleanText(p.roast);
    if (score === null || !roast) throw new RoastGenerationError(`pillar ${key} incomplete`);
    pillars[key] = { score, roast };
  }
  const verdict = cleanText(r.verdict);
  const improvements = cleanList(r.improvements, 5);
  if (!verdict || improvements.length < 2) throw new RoastGenerationError("verdict or improvements missing");
  const headline = cleanText(r.headline).slice(0, 160);
  const out: RoastResult = {
    ...pillars,
    overall: 0,
    verdict,
    improvements,
    headline: headline || undefined,
    evidence: cleanList(r.evidence, 4),
    lang,
  };
  out.overall = weightedOverall(out);
  return out;
}

export async function runBrandRoast(input: RoastRequest): Promise<RoastRun> {
  if (!process.env.ANTHROPIC_API_KEY) throw new RoastGenerationError("no-api-key");

  const lang: RoastLang = input.lang === "es" ? "es" : "en";
  const model = process.env.ROAST_MODEL || ROAST_DEFAULT_MODEL;
  const envEffort = process.env.ROAST_EFFORT as (typeof EFFORTS)[number] | undefined;
  const effort = envEffort && EFFORTS.includes(envEffort) ? envEffort : ROAST_DEFAULT_EFFORT;

  const snapshot = input.websiteUrl ? await fetchSiteSnapshot(input.websiteUrl) : null;
  const snapshotBlock = snapshot && input.websiteUrl ? renderSnapshot(snapshot, input.websiteUrl) : null;

  const client = new Anthropic({ timeout: MODEL_TIMEOUT_MS, maxRetries: 0 });
  // `fallbacks: "default"`: si el clasificador de seguridad declina (p. ej. "cyber" con
  // una marca de ciberseguridad), Anthropic reintenta en el modelo que recomienda para
  // esa categoria dentro de la misma llamada. El SDK 0.87 no tipa el campo.
  const params = {
    model,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort,
      format: { type: "json_schema", schema: roastOutputSchema as unknown as Record<string, unknown> },
    },
    system: [
      {
        type: "text",
        text: buildRoastSystemPrompt(loadKnowledge(KNOWLEDGE_KEYS), lang),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildRoastUserMessage(input, snapshotBlock) }],
  };
  const response = (await client.beta.messages.create(
    params as unknown as Parameters<typeof client.beta.messages.create>[0]
  )) as Anthropic.Beta.BetaMessage;

  if (response.stop_reason === "refusal") throw new RoastGenerationError("refusal");
  if (response.stop_reason === "max_tokens") throw new RoastGenerationError("max_tokens");

  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RoastGenerationError(`invalid JSON: ${text.slice(0, 120)}`);
  }

  return {
    output: validateRoastOutput(parsed, lang),
    // response.model dice que modelo respondio de verdad (cambia si hubo fallback).
    model: response.model || model,
    siteRead: snapshot?.ok === true,
    siteReason: snapshot && !snapshot.ok ? snapshot.reason : undefined,
  };
}
