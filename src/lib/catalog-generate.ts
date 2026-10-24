import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAntithesisPattern, scrubDashes } from "@/lib/voice";
import { CATEGORIES, csvValue, DIFFICULTIES, TIERS } from "@/lib/catalog";
import { selectAll } from "@/lib/catalog-server";
import { VERTICALS, type Category } from "@/types/prompt";

/* Generador de borradores del Catalogo (2026-10-12). Rescata de Content Factory lo que
 * servia: las reglas de voz de ARTO, la lista de titulos existentes para no repetir y el
 * limpiador de guiones y antitesis. No guarda nada: devuelve borradores que el editor
 * llena para que una persona los revise y los cree. */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

const SYSTEM = `You write entries for the ARTO Studio AI prompt library: bilingual (Spanish and English) prompts that strategists and creatives paste into an AI model to get professional brand and creative work.

ARTO is a creative agency (since 2009) specialized in brand strategy and design. Its prompts encode real methodology: positioning, brand tension, naming, creative briefs, voice and tone, art direction. A good entry is specific, structured and ready to paste: role, context with [placeholders] the user fills, numbered steps, and the exact output format.

Tone rules (both languages):
- Direct and concrete. No marketing fluff, no emoji.
- Spanish is Mexican Spanish with tú. Never vos/che/tenés/acá.
- Banned words: leverage, empower, synergy, holistic, ecosystem, disruptive, scalable, optimize, elevate, robust, seamless, cutting-edge, game-changer, potenciar, empoderar, sinergia, robusto, holístico, disruptivo, escalable, optimizar, elevar, de vanguardia.
- No em-dashes (—) or en-dashes (–). Use a period, comma, colon or parentheses.
- Never use the antithesis trick ("Not X. It is Y.", "No es X, es Y", "It's not about X, it's about Y").

Both language versions must be complete and equivalent, not literal translations. Output STRICT JSON only, no preamble.`;

export interface Draft {
  title_es: string;
  title_en: string;
  prompt_es: string;
  prompt_en: string;
  category: Category;
  subcategory: string;
  ai_model: string;
  difficulty: string;
  tier: string;
  tags: string[];
  use_case: string;
  expected_output: string;
}

export interface GenerateInput {
  category: Category;
  idea: string;
  tier: (typeof TIERS)[number];
  count: number;
  aiModels: string[];
  subcategory?: string;
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateDrafts(input: GenerateInput): Promise<{ drafts: Draft[]; rejected: { title: string; reason: string }[] }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY.");
  const sb = createAdminClient();
  const existing = await selectAll<{ title_es: string; title_en: string; category: string }>(() => sb.from("prompts").select("title_es, title_en, category").order("id"));
  const taken = new Set(existing.flatMap((r) => [normalizeTitle(r.title_es), normalizeTitle(r.title_en)]));
  const sameVertical = existing.filter((r) => r.category === input.category).map((r) => `- ${r.title_en}`).join("\n");

  const v = VERTICALS[input.category];
  const user = `Write ${input.count} new prompt ${input.count === 1 ? "entry" : "entries"} for the ${v.label_en} vertical (code ${v.code}).

Operator brief: ${input.idea}
${input.subcategory ? `Subcategory (snake_case): ${input.subcategory}` : "Pick a fitting subcategory in snake_case."}
Tier: ${input.tier} (${input.tier === "pro" ? "encodes ARTO's proprietary method in depth" : "useful on its own, lighter method"}).
ai_model must be one of: ${input.aiModels.join(", ")}.
difficulty must be one of: ${DIFFICULTIES.join(", ")}.

Each entry:
{ "title_es": "...", "title_en": "...", "prompt_es": "...", "prompt_en": "...", "subcategory": "...", "ai_model": "...", "difficulty": "...", "tags": ["3 to 6 lowercase tags"], "use_case": "one sentence: when a strategist picks this prompt", "expected_output": "one sentence: the deliverable" }

Constraints: titles under 70 characters; each prompt 150 to 300 words, ready to paste, with [placeholders] in brackets; entries must differ from each other and from these existing ${v.label_en} titles:
${sameVertical.slice(0, 12000)}

Return { "items": [ ... ] }`;

  const anth = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  // Un borrador por llamada, con tope de salida y de tiempo para responder antes de que
  // Vercel corte a los 60 s (auditoria de Fable del PR #89).
  let resp: Anthropic.Message;
  try {
    resp = await anth.messages.create(
      { model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }] },
      { timeout: 50_000, maxRetries: 0 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    throw new Error(/timeout|timed out/i.test(msg) ? "La IA tardó demasiado. Intenta otra vez o pide menos borradores." : `La IA no respondió: ${msg}`);
  }
  if (resp.stop_reason === "max_tokens") throw new Error("El borrador salió demasiado largo. Intenta otra vez o acota la idea.");
  const text = resp.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
  let parsed: { items?: unknown };
  try {
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, ""));
  } catch {
    throw new Error("La IA devolvió un formato que no se pudo leer. Intenta de nuevo.");
  }
  const items = Array.isArray(parsed.items) ? (parsed.items as Record<string, unknown>[]) : [];
  const drafts: Draft[] = [];
  const rejected: { title: string; reason: string }[] = [];
  for (const it of items.slice(0, input.count)) {
    const str = (k: string) => (typeof it[k] === "string" ? scrubDashes(it[k] as string).out.trim() : "");
    const d: Draft = {
      title_es: str("title_es"),
      title_en: str("title_en"),
      prompt_es: str("prompt_es"),
      prompt_en: str("prompt_en"),
      category: input.category,
      subcategory: "",
      ai_model: "",
      difficulty: "",
      tier: input.tier,
      tags: [],
      use_case: str("use_case"),
      expected_output: str("expected_output"),
    };
    const sub = csvValue("subcategory", input.subcategory || str("subcategory"));
    const model = csvValue("ai_model", str("ai_model"));
    const diff = csvValue("difficulty", str("difficulty"));
    const tags = csvValue("tags", Array.isArray(it.tags) ? (it.tags as unknown[]).map(String).join("|") : "");
    d.subcategory = sub.ok ? String(sub.value) : "general";
    d.ai_model = model.ok && input.aiModels.includes(String(model.value)) ? String(model.value) : "claude";
    d.difficulty = diff.ok ? String(diff.value) : "intermediate";
    d.tags = tags.ok ? (tags.value as string[]) : [];
    const title = d.title_es || d.title_en || "(sin título)";
    if (!d.title_es || !d.title_en || !d.prompt_es || !d.prompt_en) {
      rejected.push({ title, reason: "llegó incompleto" });
      continue;
    }
    if (taken.has(normalizeTitle(d.title_es)) || taken.has(normalizeTitle(d.title_en))) {
      rejected.push({ title, reason: "ya existe un prompt con ese título" });
      continue;
    }
    const anti = [d.title_es, d.title_en, d.prompt_es, d.prompt_en, d.use_case].map(hasAntithesisPattern).find(Boolean);
    if (anti) {
      rejected.push({ title, reason: `usa la fórmula «no es X, es Y» («${anti}»)` });
      continue;
    }
    drafts.push(d);
  }
  return { drafts, rejected };
}

export function parseGenerateInput(raw: unknown, aiModels: string[]): GenerateInput | string {
  if (!raw || typeof raw !== "object") return "Faltan datos.";
  const r = raw as Record<string, unknown>;
  const category = String(r.category ?? "");
  if (!(CATEGORIES as string[]).includes(category)) return "Elige una vertical.";
  const idea = String(r.idea ?? "").trim();
  if (idea.length < 10) return "Describe la idea en al menos una frase.";
  if (idea.length > 1500) return "La idea pasa de 1,500 caracteres.";
  const tier = String(r.tier ?? "free");
  if (!(TIERS as readonly string[]).includes(tier)) return "Plan no válido.";
  // Uno por llamada para caber en 60 s; la pantalla pide varios en paralelo.
  const count = 1;
  const sub = typeof r.subcategory === "string" && r.subcategory.trim() ? csvValue("subcategory", r.subcategory) : null;
  return { category: category as Category, idea, tier: tier as GenerateInput["tier"], count, aiModels, subcategory: sub?.ok ? String(sub.value) : undefined };
}
