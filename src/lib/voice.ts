/* ARTO brand voice helpers.
 *
 * The Content Factory generator embeds the voice rules in its system
 * prompt, but model output isn't 100% obedient and operators can edit
 * payloads by hand or call the publisher with externally-authored copy.
 * So the rules are also enforced at the data layer via this module —
 * defense in depth.
 *
 * Two operations:
 *   - `scrubDashes(s)`: replace em-dashes (—) and en-dashes (–) used as
 *     em-dashes with ASCII punctuation (sentence break when spaced,
 *     comma when hugging a word). Cleanup of accidental `,.` artifacts.
 *   - `hasAntithesisPattern(s)`: detect "Not X. It is Y." / "No es X. Es
 *     Y." style AI-tell rhythms. Returns true if any pattern matches.
 *     Auto-fixing is too risky; callers reject offending items.
 *
 * Plus a high-level helper for content_items payloads:
 *   - `applyVoiceScrub(type, items)`: iterate over the text fields of
 *     each payload (per content-item type), scrub dashes, reject items
 *     with antithesis. Lo usa el generador del Catalogo (src/lib/catalog-generate.ts).
 *
 * And a low-level helper for the publisher:
 *   - `scrubCopy(s)`: scrub dashes on a single piece of copy without
 *     antithesis detection. Used by the social publisher right before
 *     sending text to Buffer so even hand-edited copy lands clean. */

/* Antithesis catalog. Each pattern matches a different shape of the same
 * AI-tell rhythm: "not X — but Y" / "no X. Y instead". We keep them
 * separate (instead of one mega-regex) so a debugging message can name
 * which family fired. Patterns are case-insensitive and tolerate the
 * curly apostrophe variants Claude sometimes emits.
 *
 * Cross-language note: Spanish ANTITHESIS_PATTERNS include the verb
 * ESTAR (no está) in addition to SER (no es), and several formulations
 * with "no sólo / no solo" that the earlier ban missed (caught by
 * Victor in PR #51 review). English patterns add "not only X but Y"
 * and "no longer X. Now Y". */
export const ANTITHESIS_PATTERNS: RegExp[] = [
  // === English ===
  // "not X. It is Y." / "not just X, it's Y."
  /\bnot\s+(just\s+|simply\s+|merely\s+|only\s+)?[\w'’\- ]{1,50}[.,]\s*(it\s+is|it'?s|it\s+is\s+about|we|you)\s+\w/i,
  // "it's not about X. It's about Y."
  /\bit'?s\s+not\s+about\s+[\w'’\- ]{1,40}[.,]\s+it'?s\s+about\s+\w/i,
  // "more than X. It is Y."
  /\bmore\s+than\s+[\w'’\- ]{1,40}[.,]\s+it\s+is\s+\w/i,
  // "not only X. But (also) Y."
  /\bnot\s+only\s+[\w'’\- ]{1,40}[.,]?\s+but\s+(also\s+)?\w/i,
  // "no longer X. Now/Today Y."
  /\bno\s+longer\s+[\w'’\- ]{1,40}[.,]\s+(now|today|currently)\s+\w/i,
  // "isn't X. It is Y."
  /\b(isn'?t|aren'?t|wasn'?t|weren'?t)\s+[\w'’\- ]{1,40}[.,]\s+(it\s+is|it'?s|they\s+are|they'?re)\s+\w/i,

  // === Spanish ===
  // "no es X. Es Y." / "no son X. Son Y." (SER)
  /\bno\s+(es|son)\s+[\w'áéíóúñ\- ]{1,50}[.,]\s+(es|son)\s+\w/i,
  // "no está X. Está Y." / "no está en X. Está en Y." (ESTAR — Victor's flag)
  /\bno\s+est[aá]\s+(en\s+)?[\w'áéíóúñ\- ]{1,50}[.,]\s+est[aá]\s+(en\s+)?\w/i,
  // "no se trata de X. Se trata de Y."
  /\bno\s+se\s+trata\s+de\s+[\w'áéíóúñ\- ]{1,40}[.,]\s+se\s+trata\s+de\s+\w/i,
  // "más que X. Es Y."
  /\bm[aá]s\s+que\s+[\w'áéíóúñ\- ]{1,40}[.,]\s+es\s+\w/i,
  // "no sólo X. Sino (también/que) Y." / "no solo X, sino Y."
  /\bno\s+s[oó]lo\s+[\w'áéíóúñ\- ]{1,50}[.,]?\s+sino\s+(que\s+|tambi[eé]n\s+)?\w/i,
  // "no es cuestión de X. Es cuestión de Y."
  /\bno\s+es\s+cuesti[oó]n\s+de\s+[\w'áéíóúñ\- ]{1,30}[.,]\s+es\s+cuesti[oó]n\s+de\s+\w/i,
  // "ya no es X. Ahora/Hoy es Y."
  /\bya\s+no\s+(es|son|est[aá]n?)\s+[\w'áéíóúñ\- ]{1,40}[.,]\s+(ahora|hoy)\s+(es|son|est[aá]n?)\s+\w/i,
  // "no consiste en X. Consiste en Y."
  /\bno\s+consiste\s+en\s+[\w'áéíóúñ\- ]{1,40}[.,]\s+consiste\s+en\s+\w/i,
];

/* Replace em-dash + en-dash with the right ASCII punctuation. The em-dash
 * usually wants ". " (sentence break) when surrounded by spaces, or "," when
 * it's mid-clause. Default to ". " which is the safer brand fit for ARTO. */
export function scrubDashes(s: string): { out: string; touched: boolean } {
  if (!s) return { out: s, touched: false };
  const original = s;
  let out = s.replace(/\s+—\s+/g, ". ");
  out = out.replace(/—/g, ", ");
  out = out.replace(/\s+–\s+/g, ". ");
  out = out.replace(/–/g, ", ");
  out = out.replace(/,\s*\./g, ".").replace(/\.{2,}/g, ".");
  return { out, touched: out !== original };
}

/* Convenience: just return the scrubbed string. No-op for falsy / non-string
 * input so callers can pass `payload.copy` without pre-validating. */
export function scrubCopy(s: unknown): string {
  if (typeof s !== "string" || !s) return typeof s === "string" ? s : "";
  return scrubDashes(s).out;
}

export function hasAntithesisPattern(s: unknown): string | null {
  if (typeof s !== "string" || !s) return null;
  for (const re of ANTITHESIS_PATTERNS) {
    if (re.test(s)) return s.slice(0, 80);
  }
  return null;
}

/* Per-type field allowlist. Anything not listed is left untouched. For
 * social_post we walk into nested per-network objects too — see
 * SOCIAL_NETWORK_KEYS. */
export const PAYLOAD_TEXT_KEYS: Record<string, string[]> = {
  prompt: ["title_en", "title_es", "body_en", "body_es", "use_case", "expected_output"],
  blog_post: [
    "title_en", "title_es", "meta_description_en", "meta_description_es",
    "hero_en", "hero_es", "intro_en", "intro_es", "body_en", "body_es",
  ],
  social_post: ["cta_text", "hook", "copy"],
};

/* social_post payloads may be either the new shape (one object per
 * network: { linkedin: {hook, copy}, instagram: {...}, facebook: {...} })
 * or the legacy shape (single top-level { hook, copy, network }). The
 * scrubber handles both. */
const SOCIAL_NETWORK_KEYS = ["linkedin", "instagram", "facebook"] as const;
const SOCIAL_NETWORK_TEXT_KEYS = ["hook", "copy"] as const;

export interface VoiceResult {
  kept: Record<string, unknown>[];
  rejected: Array<{ payload: Record<string, unknown>; reason: string }>;
  fixes: number;
}

export function applyVoiceScrub(
  type: string,
  items: Record<string, unknown>[],
): VoiceResult {
  const out: VoiceResult = { kept: [], rejected: [], fixes: 0 };
  for (const raw of items) {
    const keys = PAYLOAD_TEXT_KEYS[type] ?? Object.keys(raw).filter((k) => typeof raw[k] === "string");
    let antithesisHit: string | null = null;
    const fixed: Record<string, unknown> = { ...raw };

    // Top-level text fields.
    for (const k of keys) {
      const v = raw[k];
      if (typeof v !== "string") continue;
      const sample = hasAntithesisPattern(v);
      if (sample) {
        antithesisHit = `field '${k}' uses an antithesis anti-pattern: "${sample}..."`;
        break;
      }
      const { out: scrubbed, touched } = scrubDashes(v);
      if (touched) {
        fixed[k] = scrubbed;
        out.fixes += 1;
      }
    }

    // Nested per-network text fields for social_post.
    if (!antithesisHit && type === "social_post") {
      for (const net of SOCIAL_NETWORK_KEYS) {
        const sub = raw[net];
        if (!sub || typeof sub !== "object") continue;
        const subRaw = sub as Record<string, unknown>;
        const subFixed: Record<string, unknown> = { ...subRaw };
        for (const k of SOCIAL_NETWORK_TEXT_KEYS) {
          const v = subRaw[k];
          if (typeof v !== "string") continue;
          const sample = hasAntithesisPattern(v);
          if (sample) {
            antithesisHit = `field '${net}.${k}' uses an antithesis anti-pattern: "${sample}..."`;
            break;
          }
          const { out: scrubbed, touched } = scrubDashes(v);
          if (touched) {
            subFixed[k] = scrubbed;
            out.fixes += 1;
          }
        }
        if (antithesisHit) break;
        fixed[net] = subFixed;
      }
    }

    if (antithesisHit) {
      out.rejected.push({ payload: raw, reason: antithesisHit });
    } else {
      out.kept.push(fixed);
    }
  }
  return out;
}
