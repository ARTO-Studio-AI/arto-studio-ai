import Anthropic from "@anthropic-ai/sdk";

/* Claude scoring for prospect fit. Uses Haiku for cost efficiency: prospect
 * fit is a classification task and Haiku 4.5 handles it well at ~1/4 the
 * Sonnet price, so a $0.50 nightly cap buys hundreds of candidates. Bump via
 * SCRAPER_MODEL env if you want Sonnet quality. */

const MODEL = process.env.SCRAPER_MODEL || "claude-haiku-4-5";
const PRICING = {
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
};

const SYSTEM = `You qualify potential B2B prospects for ARTO, an art / design / digital-strategy
group (New York, Toronto, Mexico City, Madrid). ARTO sells brand strategy, brand + product design,
content, and web/product work to companies that need high-end creative.

Given a news/article item, decide whether the COMPANY it is about is a plausible ARTO prospect:
a company that likely needs branding, rebrand, design, content, or digital work soon. Strong
signals: just raised funding, rebranding, launching a product, new creative/marketing leadership,
expanding to new markets. Weak/none: pure tech infra with no consumer brand, government notices,
listicles, articles about ARTO's competitors as the subject, or items with no identifiable company.

Return STRICT JSON only:
{
  "is_prospect": boolean,
  "company": "the company name, or null",
  "person_name": "a named decision-maker if present, else null",
  "vertical": "one of: branding, tech, ecommerce, fashion, hospitality, real_estate, food, finance, health, media, other",
  "country": "ISO-ish country name if inferable, else null",
  "language": "es if the company/market is Spanish-speaking, else en",
  "score": 0-100 legitimate-interest fit (0 = not a prospect, 100 = ideal),
  "reasoning": "one sentence, why this is or is not a fit. No em-dashes."
}`;

export function makeScorer() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });
  const pricing = PRICING[MODEL] ?? PRICING["claude-haiku-4-5"];
  const state = { spentUsd: 0, tokensIn: 0, tokensOut: 0, calls: 0 };

  return {
    state,
    model: MODEL,
    /* Rough pre-check: ~600 in + 200 out worst case. */
    estNextUsd() {
      return (600 / 1e6) * pricing.input + (250 / 1e6) * pricing.output;
    },
    async score(item) {
      const user = `ITEM\nsource: ${item.source_name}\ntitle: ${item.title}\nsnippet: ${(item.snippet || "").slice(0, 600)}\nurl: ${item.url}`;
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      });
      state.calls += 1;
      state.tokensIn += resp.usage.input_tokens;
      state.tokensOut += resp.usage.output_tokens;
      state.spentUsd +=
        (resp.usage.input_tokens / 1e6) * pricing.input +
        (resp.usage.output_tokens / 1e6) * pricing.output;
      const text = resp.content.find((b) => b.type === "text")?.text ?? "{}";
      const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      try {
        return JSON.parse(trimmed);
      } catch {
        return { is_prospect: false, reasoning: "unparseable model output" };
      }
    },
  };
}
