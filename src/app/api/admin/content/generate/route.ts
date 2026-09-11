import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";
import { applyVoiceScrub } from "@/lib/voice";

/* POST /api/admin/content/generate
 *
 * body { type: "prompt" | "blog_post", count?: number, language?: "en" | "es", brief?: string }
 *
 * Generates `count` (default 3) new drafts of the given type. For
 * each item, Claude returns a strict JSON shape that matches the
 * payload spec for that type (see content_items table comment). We
 * upsert them as content_items rows with status='draft'.
 *
 * If `brief` is provided, it's appended to the system prompt to steer
 * generation (e.g. "focus on fashion vertical", "respond to the
 * recent Meta layoffs signal"). Otherwise we pull recent
 * engine_signals + content_gaps as context.
 */

const MAX_COUNT = 10;
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  "claude-opus-4-5": { input: 15.0, output: 75.0 },
};

const SYSTEM_BASE = `You generate ARTO Studio AI content for the Content Factory.

ARTO Studio AI: bilingual prompt library, AI skills (brand positioning, architecture), autonomous creative agents. Built on 15+ years with Google, Nike, Uber. https://creative.artostudio.ai

Tone rules (apply to either language):
- Direct, terse, no marketing fluff. No emoji unless intentional and rare.
- Spanish uses tú-form (Mexico). NEVER vos/che/tenés/acá.
- Banned in either language: leverage, empower, synergy, holistic, ecosystem, disruptive, scalable, optimize, elevate, robust, potenciar, empoderar, sinergia, robusto, holístico, disruptivo, escalable, optimizar.
- Show that ARTO actually does the work via concrete frameworks, methodology, client examples. Not motivational fluff.

PUNCTUATION — no em-dashes anywhere.
The em-dash character (—) is BANNED. Also banned: en-dashes (–) used in place of em-dashes.
If you would normally write an em-dash, use one of these instead: a period to end the thought, a comma to keep flowing, a colon to introduce an explanation, parentheses to set off an aside, or simply a new sentence. Hyphens (-) inside compound words like "art-design-and-strategy" are fine; replacements for em-dashes are not.

ANTI-PATTERNS — these are AI-tell phrasings. Never use them:
- "Not X. It is Y." / "Not X, but Y." / "X is not Y, X is Z."
  Spanish equivalents: "No es X. Es Y." / "No X. Sino Y." / "X no es Y, X es Z."
  This antithesis trick is the most obvious AI pattern. Just state Y plainly without setting up the negation.
- "It's not about X, it's about Y."
- Triplet build-ups for rhythm: "Bold. Clear. Focused." Avoid the three-staccato-words pattern.
- "We don't just X, we Y." / "More than X, it is Y."
- Opening with "In a world where..." or "In today's..."
- Hollow scale claims like "redefining the future of design".

Write declarative statements. State what is, plainly. The reader will feel the contrast on their own.

EDITORIAL FLOW — write paragraphs, not lists of sentences.
ARTO copy reads as gallery-wall text or a broadsheet feature, not as a sequence of staccato claims. This is the single most common AI tell after em-dashes and antithesis tricks: short, disconnected sentences each making a different point. Avoid it.

Rules for paragraph construction:
- One paragraph carries one idea, developed across 3-6 sentences. Open with a claim, then EXPAND it: give a reason, show a mechanism, name an example, introduce a tension.
- Sentence length varies. Mix short (8-12 words) with medium (15-25 words). At least one longer sentence (25-40 words) per paragraph carrying a complete thought through subordination or a relative clause.
- Use connectors. In Spanish: "porque", "cuando", "lo que pasa es que", "en la práctica", "esto significa que", "el problema viene de", "una vez que", "incluso si", "más allá de", "lo que esto explica es que". In English: "because", "when this happens", "the reason is that", "in practice", "what this means is", "the problem comes from", "once", "even when", "beyond that", "what this explains is".
- Subordinate clauses are encouraged: "que", "porque", "aunque", "cuando", "donde", "lo que", "lo cual" / "which", "because", "even though", "where", "what". They show thought, not just position.
- A run of three short declarative sentences back-to-back is a red flag. Rewrite at least one into a longer connected thought.
- Do NOT open three consecutive sentences with the same word or grammatical structure.
- A paragraph that is just "Subject verb object. Subject verb object. Subject verb object." reads as AI. Insert connecting tissue.

Editorial register: declarative but expansive. The reader should feel the writer is THINKING through the topic on the page, not listing pre-canned conclusions.

Output STRICT JSON only, no preamble.`;

const PROMPT_INSTRUCTIONS = `Generate {count} prompt-library entries, ALL in {language}.

Each prompt is a row in the catalog table. Strict shape per item:
{
  "title_en": "...",
  "title_es": "...",
  "body_en": "...",
  "body_es": "...",
  "category": "branding" | "graphic_design" | "copywriting" | "photography" | "video" | "ux_ui" | "illustration" | "marketing" | "music" | "architecture" | "fashion" | "creative_productivity",
  "subcategory": "...",
  "ai_model": "any" | "gpt" | "claude" | "midjourney" | "sora" | "veo" | "suno" | "udio" | "elevenlabs" | "kling" | "runway",
  "difficulty": "beginner" | "intermediate" | "advanced" | "expert",
  "tier": "free" | "pro",
  "tags": ["..."],
  "use_case": "...",
  "expected_output": "..."
}

Constraints:
- title must be under 70 chars
- body must be a full working prompt 120-400 words, ready to paste into the target AI model
- always fill BOTH title_en AND title_es, BOTH body_en AND body_es
- use_case: one sentence describing when an operator picks this prompt
- expected_output: one sentence describing the deliverable
- mark tier "pro" only if the prompt encodes proprietary ARTO methodology; otherwise "free"

Return a JSON object: { "items": [ ... ] }`;

const BLOG_POST_INSTRUCTIONS = `Generate {count} editorial blog posts for /learn/[slug], ALL in {language}.

Each is a vertical guide. Strict shape per item:
{
  "slug": "...",
  "category": "branding" | "graphic_design" | "copywriting" | "photography" | "video" | "ux_ui" | "illustration" | "marketing" | "music" | "architecture" | "fashion" | "creative_productivity",
  "title_en": "...",
  "title_es": "...",
  "meta_description_en": "...",
  "meta_description_es": "...",
  "hero_en": "...",
  "hero_es": "...",
  "intro_en": "...",
  "intro_es": "...",
  "body_en": "Full editorial article body in English, 500-800 words.",
  "body_es": "Cuerpo editorial completo en español, 500-800 palabras.",
  "use_cases_en": ["...", "..."],
  "use_cases_es": ["...", "..."],
  "image_brief": {
    "treatment": "silhouette" | "pleated_warm" | "frosted_glass" | "photographic_crop" | "poster_headline" | "bubbles_overlay" | "geographic_card" | "architectural",
    "text_overlay": null | "SHORT PHRASE IN CAPS",
    "wordmark": true | false,
    "geo_tags": true | false
  }
}

Constraints:
- slug: short lowercase-with-hyphens, unique, no existing learn slug
- title under 60 chars
- meta_description 120-160 chars
- hero: one strong headline (under 80 chars)
- intro: 80-160 words, sets up what the AI can do in this vertical in 2026 (this is the article opener, the hook)
- body: **HARD MINIMUM 400 words in EACH language, target 400-500 words.** Server-side rejection for under 400. Editorial article body. Structure as 4-5 paragraphs separated by ONE blank line each (literal \\n\\n in the JSON string). EACH paragraph 80-120 words. EDITORIAL FLOW MANDATORY: every paragraph develops ONE idea across 3-6 sentences with connectors and varied sentence length. NO runs of three short declarative sentences. NO paragraphs that are lists of claims. Read it back to yourself after writing: if any paragraph sounds like "Subject verb object. Subject verb object. Subject verb object." rewrite it. Name concrete tools (Claude, Midjourney, ElevenLabs, Figma, Notion, Linear), techniques (positioning matrix, NOT-table, brand spine), brands (Neefter, Crecy, Google, Nike, Uber) when relevant. Walk through methodology step by step. Show mechanism, not conclusion. Avoid "in conclusion", "in summary", "ultimately", "at the end of the day". Do NOT repeat the intro — the body advances the thesis. The last paragraph ends on a claim or a question, not a recap.

BOLD KEY PHRASES — mandatory in body.
Inside body_en and body_es, mark 2-4 load-bearing phrases per paragraph in markdown bold using **double asterisks** around the phrase. Example in Spanish: "El brief tradicional asumía un destinatario humano que podía **leer entre líneas**. Cuando trabajas con Claude, esa ambigüedad **se convierte en error**." Each bolded phrase must be a CONCEPT or a CLAIM the reader should skim and grasp at a glance, not stylistic emphasis. Avoid bolding common adverbs, conjunctions, single nouns out of context, or full sentences. Each bolded run is 2-7 words. Distribute bold phrases across the paragraph, not clustered at the end. The bolded phrases are part of the reading rhythm and must read sensibly when extracted (a skimmer should be able to read JUST the bolded phrases and get the gist of the paragraph).

Before submitting, count your own words: if body_en or body_es is under 400, expand it BEFORE returning.
- use_cases: 4-6 concrete situations where an operator uses prompts in this vertical

IMAGE BRIEF — chosen by you, the writer.
Every blog hero must carry a brand image. Pick the treatment that fits the topic. The 8 treatments are the same as social_post:
- silhouette: silhouette character on paper. For posts about people, identity, narrative.
- pleated_warm: warm-brown pleated motion-blur. For posts about methodology / momentum.
- frosted_glass: frosted plate over warm-brown. For conceptual posts.
- photographic_crop: tight sepia photo (hands, materials). For posts about craft.
- poster_headline: poster-scale Manrope Bold ALL CAPS on paper. text_overlay REQUIRED.
- bubbles_overlay: glass bubbles cropping in. For posts about energy / surprise.
- geographic_card: NEW YORK / TORONTO / MEXICO CITY / MADRID corner tags. For posts about ARTO's global presence.
- architectural: hairlines + black planes + tight type. For posts about systems / structure.

text_overlay: SHORT (4-8 words) ALL-CAPS phrase rendered in the image. REQUIRED for poster_headline. Optional elsewhere. Should be a quotable line that complements the hero, NOT the title verbatim.
wordmark: default true. Set false when the treatment already includes typography (geographic_card, poster_headline).
geo_tags: default false. Set true for geographic_card.

Vary treatments across the batch.

Return a JSON object: { "items": [ ... ] }`;

const SOCIAL_POST_INSTRUCTIONS = `Generate {count} social media posts for ARTO Studio AI, ALL in {language}.

Each item is one POST IDEA published in three platform-specific variants. LinkedIn, Instagram, and Facebook each have their own optimal length, tone, and hashtag norms, so the SAME idea is rewritten three times in the same payload. The shape:

{
  "campaign_name": "4-8 word descriptive title for this campaign",
  "linkedin": { "hook": "...", "copy": "..." },
  "instagram": { "hook": "...", "copy": "...", "hashtags": ["..."] },
  "facebook": { "hook": "...", "copy": "..." },
  "cta_text": "...",
  "cta_url": "...",
  "image_brief": {
    "treatment": "silhouette" | "pleated_warm" | "frosted_glass" | "photographic_crop" | "poster_headline" | "bubbles_overlay" | "geographic_card" | "architectural",
    "text_overlay": null | "FRASE EN MAYÚSCULAS 4-8 PALABRAS",
    "wordmark": true | false,
    "geo_tags": true | false
  }
}

Per-network rules (mandatory):

LinkedIn (page post, professional)
- copy: 800-1500 chars. Narrative, declarative, gallery-text register. 2-4 short paragraphs. ONE line break between paragraphs (not two).
- hook: first 5-8 words. Loaded statement, not a question. Avoid "I'm excited to share" / "Thrilled to announce".
- Hashtags: 0-3 only, end of copy if at all. Never #ai #marketing #branding.
- CTA is appended as a separate line by the publisher.

Instagram (business profile, visual-first feed)
- copy: 80-220 chars. Tight, punchy, image carries the meaning. ONE clear thought.
- hook: first 5-8 words. Must stop the scroll without a question. Concrete + specific.
- hashtags: 3-7 distinct, RELEVANT hashtags as a string array. No generic spam (#ai #marketing #ux). Mix branded + niche.
- CTA: short ("Link in bio" or 3-5 word verb phrase).

Facebook (page post, conversational)
- copy: 200-400 chars. Conversational, slight warmth, can ask the reader something at the end (but NOT as the hook).
- hook: first 5-8 words. Declarative. No clickbait.
- Hashtags: 0-2 only.
- CTA appended as a separate line.

Shared
- campaign_name: a short descriptive title that identifies this campaign at-a-glance in the dashboard list. 4-8 words, sentence case (not all caps), in the same language as the post. Should summarize WHAT the post is about, NOT use the hook verbatim. Examples: "Discipline beats inspiration thesis", "Disciplina supera a la inspiración", "ARTO global presence across four cities", "3000 prompt catalog launch in Spanish". Avoid "The X campaign" / "Post about X" patterns.
- cta_text: 3-5 words. Examples: 'Browse the catalog', 'Try Brand Roast', 'Read the guide'.
- cta_url: one of /prompts, /pricing, /work, /roast, /learn, /learn/<slug>. NEVER external.
- Tone rules apply on all 3 variants (banned words list, tú-form Spanish, no AI tells, no em-dashes, no antithesis patterns).
- Lean into ARTO's concrete identity: 3,000 bilingual prompts, 15+ years with Google / Nike / Uber, methodology not motivation.

The 3 versions should clearly be the SAME idea, never invent a different topic per network. They should diverge ONLY in length, hashtag treatment, and register, not in substance.

IMAGE BRIEF — chosen by you, the writer.
Every social_post carries an image. Pick the visual treatment that fits the idea. ARTO has 8 treatments:

- silhouette: bold black silhouette character (eye-in-hand, eye-in-chest motif) on paper. Use for posts about people, craft, identity, or when copy is narrative and abstract.
- pleated_warm: warm-brown pleated motion-blur field. Use for posts about momentum, methodology, depth.
- frosted_glass: frosted glass plate over warm-brown ground. Use for conceptual / process posts.
- photographic_crop: tight sepia-warm photo (hands, objects, faces partially cropped). Use for posts about craft and tangible work.
- poster_headline: poster-scale Manrope Bold ALL-CAPS headline on paper. Use when the post has a strong, quotable claim. text_overlay MUST be set.
- bubbles_overlay: liquid / mercury glass bubbles cropping into the frame. Use for posts about energy, motion, surprise.
- geographic_card: editorial composition with NEW YORK / TORONTO / MEXICO CITY / MADRID corner tags. Use for posts about scale / reach / "the global agency that never sleeps".
- architectural: editorial grid with hairlines and black planes. Use for posts about systems, structure, methodology.

Also decide:
- text_overlay: a SHORT (4-8 words) ALL-CAPS phrase to render IN the image. Required for poster_headline. Optional (and often null) for other treatments. When set, must complement the post idea, NOT repeat the hook verbatim.
- wordmark: true to include the small italic-serif "arto" wordmark in a corner. Default true. Set false ONLY when the treatment already includes typography (geographic_card, poster_headline).
- geo_tags: true to include corner-pinned NEW YORK / TORONTO / MEXICO CITY / MADRID tags. Default false. Only set true for geographic_card OR for posts explicitly about ARTO's global presence.

Vary treatments across the batch. Three social posts in a row should not all be silhouette.

Return a JSON object: { "items": [ ... ] }`;

interface GenerateBody {
  type: "prompt" | "blog_post" | "social_post";
  count?: number;
  language?: "en" | "es";
  brief?: string;
}

async function fetchContextSignals(): Promise<string> {
  try {
    const sb = createAdminClient();
    const { data: signals } = await sb
      .from("engine_signals")
      .select("signal_type, summary, metadata")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!signals || signals.length === 0) return "";
    const lines = signals.map(
      (s) =>
        `- ${s.signal_type}: ${s.summary}`,
    );
    return `\n\nRecent engine signals to consider (use sparingly, as inspiration):\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as GenerateBody | null;
  const type = body?.type;
  if (type !== "prompt" && type !== "blog_post" && type !== "social_post") {
    return NextResponse.json(
      { error: "type must be 'prompt', 'blog_post', or 'social_post'" },
      { status: 400 },
    );
  }
  const count = Math.max(1, Math.min(MAX_COUNT, body?.count ?? 3));
  const language: "en" | "es" = body?.language === "es" ? "es" : "en";
  const brief = (body?.brief ?? "").trim();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const template =
    type === "prompt"
      ? PROMPT_INSTRUCTIONS
      : type === "blog_post"
      ? BLOG_POST_INSTRUCTIONS
      : SOCIAL_POST_INSTRUCTIONS;
  const instructions = template.replace("{count}", String(count)).replace("{language}", language);
  const context = await fetchContextSignals();
  const briefBlock = brief ? `\n\nOperator brief: ${brief}` : "";

  /* Dedup pass 1 — anti-list in the prompt.
   * We hand Claude every existing title (en + es) for prompts, or every
   * existing /learn slug + title for blog posts, so it actively avoids
   * generating something we already have. ~5-15K input tokens depending
   * on catalog size, well within budget for the quality bump. */
  const sb = createAdminClient();
  const antiList = await buildAntiList(sb, type);

  const anth = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await anth.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_BASE,
    messages: [
      {
        role: "user",
        content: instructions + briefBlock + context + antiList,
      },
    ],
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  let parsed: { items?: unknown[] };
  try {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return NextResponse.json(
      { error: `Claude returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
  if (!parsed.items || !Array.isArray(parsed.items)) {
    return NextResponse.json({ error: "Claude returned no items array" }, { status: 502 });
  }

  const pricing = PRICING[MODEL] ?? PRICING["claude-sonnet-5"];
  const totalCost =
    (resp.usage.input_tokens / 1_000_000) * pricing.input +
    (resp.usage.output_tokens / 1_000_000) * pricing.output;
  const costPerItem = totalCost / parsed.items.length;

  /* Dedup pass 2 — fuzzy match after generation.
   * Claude sometimes ignores the anti-list (~5% of the time). We
   * normalize titles and reject any item whose normalized title appears
   * in the existing catalog (or whose slug already exists for blog
   * posts). Rejected items are NOT inserted; we report them back so the
   * operator can see what happened. */
  const dedup = await dedupCheck(sb, type, parsed.items);

  /* Voice scrub — backstop the prompt-level rules.
   * Auto-fix em-dashes / en-dashes (replace with ". " when at clause
   * boundaries, ", " otherwise). Detect "no es X, es Y" antithesis
   * (en + es) and reject those items into the rejections list so the
   * operator sees what was filtered. */
  const voiced = applyVoiceScrub(type, dedup.kept);

  /* Length scrub — blog_post body floor.
   * Claude regularly under-shoots the 500-word minimum (we measured
   * 237 / 310 words on a fresh sample even with the prompt explicit).
   * Reject anything below the floor so the dashboard never accumulates
   * thin articles. Both languages must meet the bar, otherwise the
   * operator sees a rejection with the actual count and can regenerate. */
  const BLOG_BODY_MIN_WORDS = 400;
  const countWords = (s: unknown) => typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0;
  const lengthScrubKept: typeof voiced.kept = [];
  const lengthScrubRejected: typeof voiced.rejected = [];
  if (type === "blog_post") {
    for (const item of voiced.kept) {
      const wEn = countWords(item.body_en);
      const wEs = countWords(item.body_es);
      if (wEn < BLOG_BODY_MIN_WORDS || wEs < BLOG_BODY_MIN_WORDS) {
        lengthScrubRejected.push({
          payload: item,
          reason: `length: body too short (en=${wEn}, es=${wEs}, min=${BLOG_BODY_MIN_WORDS})`,
        });
      } else {
        lengthScrubKept.push(item);
      }
    }
  } else {
    lengthScrubKept.push(...voiced.kept);
  }

  const rowsToInsert = lengthScrubKept.map((payload) => ({
    type,
    status: "draft" as const,
    language,
    payload,
    cost_usd: costPerItem,
  }));
  let inserted: unknown[] = [];
  if (rowsToInsert.length > 0) {
    const { data, error } = await sb.from("content_items").insert(rowsToInsert).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inserted = data ?? [];
  }

  const allRejections = [
    ...dedup.rejected,
    ...voiced.rejected.map((r) => ({ ...r, reason: `voice: ${r.reason}` })),
    ...lengthScrubRejected,
  ];
  return NextResponse.json({
    inserted: inserted.length,
    rejected: allRejections.length,
    rejections: allRejections,
    items: inserted,
    cost_usd: totalCost,
    voice_fixes: voiced.fixes,
  });
}

/* Voice scrub logic moved to src/lib/voice.ts so the publisher and any
 * other surface that touches user-facing copy can apply the same rules. */

/* ---------- dedup helpers ---------- */

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildAntiList(
  sb: ReturnType<typeof createAdminClient>,
  type: "prompt" | "blog_post" | "social_post",
): Promise<string> {
  if (type === "social_post") {
    // Pull the last 30 published social posts so Claude doesn't recycle
    // hooks or copy. Lighter dedup than prompts/blogs because social posts
    // are intentionally repeatable — but we don't want word-for-word copies.
    const { data } = await sb
      .from("content_items")
      .select("payload")
      .eq("type", "social_post")
      .in("status", ["published", "approved", "draft"])
      .order("updated_at", { ascending: false })
      .limit(30);
    if (!data || data.length === 0) return "";
    const lines = data
      .map((row) => {
        const p = row.payload as Record<string, string>;
        return `- ${p.hook ?? "(no hook)"} | ${(p.copy ?? "").slice(0, 80)}`;
      })
      .join("\n");
    return `\n\nRecent ARTO social posts — DO NOT repeat the same hook or angle:\n${lines}`;
  }
  if (type === "prompt") {
    const { data } = await sb.from("prompts").select("id, title_en, title_es").limit(5000);
    if (!data || data.length === 0) return "";
    const lines = data
      .map((p) => `- ${p.id}: ${p.title_en ?? ""} | ${p.title_es ?? ""}`)
      .join("\n");
    return `\n\nDO NOT generate anything similar to these prompts already in the ARTO catalog. The new prompts MUST cover different angles, use-cases, or methodologies:\n${lines}`;
  }
  // blog_post: pull existing /learn slugs + titles from content_items too.
  const { data: existing } = await sb
    .from("content_items")
    .select("payload")
    .eq("type", "blog_post");
  const taken = new Set<string>();
  for (const row of existing ?? []) {
    const p = row.payload as Record<string, string>;
    if (p.slug) taken.add(p.slug);
  }
  // Also exclude the 12 hardcoded /learn/[slug] vertical guides.
  const HARDCODED_LEARN_SLUGS = [
    "branding",
    "graphic-design",
    "copywriting",
    "photography",
    "video",
    "ux-ui",
    "illustration",
    "marketing",
    "music",
    "architecture",
    "fashion",
    "creative-productivity",
  ];
  for (const slug of HARDCODED_LEARN_SLUGS) taken.add(slug);
  const list = Array.from(taken).sort().join(", ");
  return `\n\nDO NOT use any of these slugs (already taken): ${list}. Pick a fresh slug for each blog post.`;
}

interface DedupResult {
  kept: Array<Record<string, unknown>>;
  rejected: Array<{ payload: Record<string, unknown>; reason: string }>;
}

async function dedupCheck(
  sb: ReturnType<typeof createAdminClient>,
  type: "prompt" | "blog_post" | "social_post",
  items: unknown[],
): Promise<DedupResult> {
  const result: DedupResult = { kept: [], rejected: [] };

  if (type === "social_post") {
    // Light dedup for social: only reject if the FIRST 40 chars of copy
    // match an existing post verbatim. Social hooks can intentionally
    // riff on each other; we just block exact-clone laziness.
    const { data: existing } = await sb
      .from("content_items")
      .select("payload")
      .eq("type", "social_post")
      .limit(200);
    const taken = new Set<string>();
    for (const row of existing ?? []) {
      const p = row.payload as Record<string, string>;
      if (p.copy) taken.add(normalizeTitle(String(p.copy).slice(0, 40)));
    }
    for (const raw of items) {
      const payload = raw as Record<string, string>;
      const key = payload.copy ? normalizeTitle(String(payload.copy).slice(0, 40)) : "";
      if (key && taken.has(key)) {
        result.rejected.push({ payload: raw as Record<string, unknown>, reason: "near-duplicate copy" });
        continue;
      }
      if (key) taken.add(key);
      result.kept.push(raw as Record<string, unknown>);
    }
    return result;
  }

  if (type === "prompt") {
    const { data: existing } = await sb.from("prompts").select("title_en, title_es");
    const taken = new Set<string>();
    for (const r of existing ?? []) {
      if (r.title_en) taken.add(normalizeTitle(r.title_en));
      if (r.title_es) taken.add(normalizeTitle(r.title_es));
    }
    for (const raw of items) {
      const payload = raw as Record<string, string>;
      const enKey = payload.title_en ? normalizeTitle(payload.title_en) : "";
      const esKey = payload.title_es ? normalizeTitle(payload.title_es) : "";
      if ((enKey && taken.has(enKey)) || (esKey && taken.has(esKey))) {
        result.rejected.push({ payload: raw as Record<string, unknown>, reason: "duplicate title" });
        continue;
      }
      // Reject obvious within-batch dupes too.
      if (enKey) taken.add(enKey);
      if (esKey) taken.add(esKey);
      result.kept.push(raw as Record<string, unknown>);
    }
    return result;
  }

  // blog_post: dedup by slug.
  const { data: existing } = await sb
    .from("content_items")
    .select("payload")
    .eq("type", "blog_post");
  const takenSlugs = new Set<string>();
  for (const row of existing ?? []) {
    const p = row.payload as Record<string, string>;
    if (p.slug) takenSlugs.add(p.slug.toLowerCase());
  }
  const HARDCODED = [
    "branding",
    "graphic-design",
    "copywriting",
    "photography",
    "video",
    "ux-ui",
    "illustration",
    "marketing",
    "music",
    "architecture",
    "fashion",
    "creative-productivity",
  ];
  for (const s of HARDCODED) takenSlugs.add(s);

  for (const raw of items) {
    const payload = raw as Record<string, string>;
    const slug = (payload.slug ?? "").toLowerCase().trim();
    if (!slug) {
      result.rejected.push({ payload: raw as Record<string, unknown>, reason: "missing slug" });
      continue;
    }
    if (takenSlugs.has(slug)) {
      result.rejected.push({
        payload: raw as Record<string, unknown>,
        reason: `slug already exists: ${slug}`,
      });
      continue;
    }
    takenSlugs.add(slug);
    result.kept.push(raw as Record<string, unknown>);
  }
  return result;
}
