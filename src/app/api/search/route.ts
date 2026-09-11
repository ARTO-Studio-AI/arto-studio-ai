import { NextResponse, type NextRequest } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface MatchRow {
  id: string;
  title_en: string;
  title_es: string;
  category: string;
  subcategory: string;
  ai_model: string;
  difficulty: string;
  tier: string;
  use_case: string | null;
  similarity: number;
}

interface ClaudeOutput {
  explanation: string;
  recommended_ids: string[];
}

// Lazy singletons so the route module can be imported during build/static
// analysis even when API keys aren't set (e.g., Vercel Preview env without
// secrets). Construction happens on first request, not on module load.
let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// Per-IP cap per hour (anonymous). Authenticated users get 5x.
const RATE_LIMIT_ANON = 12;
const RATE_LIMIT_AUTH = 60;

function detectLang(s: string): "es" | "en" {
  if (/[áéíóúñ¿¡]/i.test(s)) return "es";
  if (/\b(que|para|con|necesito|quiero|estoy|tengo|hacer|cómo|donde)\b/i.test(s)) return "es";
  return "en";
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query: string = (body.query ?? "").toString().trim();
    const langOverride: string | undefined = body.lang;

    if (query.length < 8) {
      return NextResponse.json({ error: "Tell me more about what you need (at least 8 characters)." }, { status: 400 });
    }
    if (query.length > 1000) {
      return NextResponse.json({ error: "Query too long (max 1000 characters)." }, { status: 400 });
    }

    // Rate limit before doing any expensive work.
    const admin = createAdminClient();
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    const ip = getClientIp(request);
    const rlKey = user ? `user:${user.id}` : `ip:${ip}`;
    const cap = user ? RATE_LIMIT_AUTH : RATE_LIMIT_ANON;

    const { data: bumped, error: rlErr } = await admin.rpc("bump_rate_limit", { rl_key: rlKey });
    if (rlErr) {
      console.error("rate limit error:", rlErr);
    }
    const newCount = (bumped as unknown as number) ?? 0;
    if (newCount > cap) {
      return NextResponse.json(
        { error: `Rate limit exceeded (${cap}/hour). Sign in for a higher limit, or try again next hour.` },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    const lang: "es" | "en" = langOverride === "es" || langOverride === "en"
      ? langOverride
      : detectLang(query);

    const embResp = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = `[${embResp.data[0].embedding.join(",")}]`;

    const { data: candidates, error: matchErr } = await admin.rpc("match_prompts", {
      query_embedding: queryEmbedding,
      match_count: 20,
    });
    if (matchErr) {
      console.error("match error:", matchErr);
      return NextResponse.json({ error: matchErr.message }, { status: 500 });
    }
    const matches = (candidates ?? []) as MatchRow[];
    if (matches.length === 0) {
      return NextResponse.json({ explanation: "", prompts: [], lang });
    }

    const candidatesText = matches
      .map((c, i) => {
        const titleField = lang === "es" ? c.title_es : c.title_en;
        return `${i + 1}. [${c.id}] ${titleField} — category=${c.category}/${c.subcategory}, difficulty=${c.difficulty}, tier=${c.tier}. Use case: ${c.use_case ?? "n/a"}`;
      })
      .join("\n");

    const systemPrompt = lang === "es"
      ? `Eres un coach creativo del catálogo ARTO Studio AI Prompt Library. Hablas español de México (tú/tienes/quieres, NUNCA vos/tenés/acá). Tu trabajo: cuando alguien describe su proyecto, le entregas no solo prompts sino una mini-estrategia de cómo usarlos. Tono directo, accionable, sin relleno corporativo. Evita las palabras prohibidas de ARTO: leverage, empower, robust, holistic, ecosystem, scalable, optimize, elevate, foster.`
      : `You are a creative coach for the ARTO Studio AI Prompt Library catalog. When someone describes their project, you deliver not only prompts but a mini-strategy on how to use them. Direct tone, actionable, no corporate filler. Avoid: leverage, empower, robust, holistic, ecosystem, scalable, optimize, elevate, foster.`;

    const userPrompt = lang === "es"
      ? `Un usuario describe lo que necesita:\n"${query}"\n\nTienes 20 prompts del catálogo más cercanos por similitud semántica:\n\n${candidatesText}\n\nElige los 4 a 6 más útiles para su caso y respóndele como un coach. Estructura la respuesta así (todo dentro de "explanation", separa cada bloque con un salto de línea doble):\n\n1. **Lectura del proyecto** (1 frase) — qué entendiste de su necesidad.\n2. **Por qué estos prompts** (2-3 frases) — qué problema resuelven juntos. Menciona los IDs específicos en negritas (**BR-0023**) cuando hables de un prompt concreto.\n3. **Orden sugerido** (3-4 frases o lista numerada) — qué hacer primero, segundo, tercero, con qué prompts. Sé específico.\n4. **Tip clave** (1-2 frases) — un consejo accionable para que aprovechen mejor el set.\n\nRESPONDE SOLO con un objeto JSON:\n{\n  "explanation": "El texto completo siguiendo la estructura. Usa **negritas** con asteriscos donde tenga sentido (IDs, etapas, conceptos clave). Mantén el tono coach: directo, específico, en español de México.",\n  "recommended_ids": ["BR-0023", "..."]\n}`
      : `A user describes what they need:\n"${query}"\n\nYou have 20 catalog prompts closest by semantic similarity:\n\n${candidatesText}\n\nPick the 4 to 6 most useful for their case and respond as a coach. Structure the answer like this (all inside "explanation", separate each block with a blank line):\n\n1. **Project read** (1 sentence) — what you understood from their need.\n2. **Why these prompts** (2-3 sentences) — what problem they solve together. Mention specific IDs in bold (**BR-0023**) when referencing a particular prompt.\n3. **Suggested order** (3-4 sentences or numbered list) — what to do first, second, third, with which prompts. Be specific.\n4. **Key tip** (1-2 sentences) — one actionable insight to get the most from the set.\n\nReply with ONLY a JSON object:\n{\n  "explanation": "Full text following the structure above. Use **bold** with asterisks where it makes sense (IDs, phases, key concepts). Keep coach tone: direct, specific.",\n  "recommended_ids": ["BR-0023", "..."]\n}`;

    const claudeResp = await getAnthropic().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = claudeResp.content[0]?.type === "text" ? claudeResp.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let parsed: ClaudeOutput = { explanation: "", recommended_ids: [] };
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]) as ClaudeOutput;
      } catch (e) {
        console.error("Claude JSON parse failed:", text);
      }
    }

    const validIds = new Set(matches.map((m) => m.id));
    let recIds = (parsed.recommended_ids || []).filter((id) => validIds.has(id));
    if (recIds.length === 0) recIds = matches.slice(0, 6).map((m) => m.id);

    const { data: full } = await admin
      .from("prompts")
      .select("id, title_en, title_es, category, subcategory, ai_model, difficulty, tier, tags")
      .in("id", recIds);

    const sorted = recIds.map((id) => (full ?? []).find((p) => p.id === id)).filter(Boolean);

    try {
      let userTier: string | null = null;
      if (user) {
        const { data: prof } = await admin.from("profiles").select("tier").eq("id", user.id).maybeSingle();
        userTier = prof?.tier ?? null;
      }
      await admin.from("search_queries").insert({
        user_id: user?.id ?? null,
        query,
        query_lang: lang,
        results_count: sorted.length,
        top_result_id: matches[0].id,
        top_similarity: matches[0].similarity,
        llm_recommended_ids: recIds,
        llm_explanation: parsed.explanation,
        user_tier: userTier,
      });
    } catch (logErr) {
      console.error("search log error:", logErr);
    }

    return NextResponse.json({
      explanation: parsed.explanation,
      prompts: sorted,
      lang,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("/api/search error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
