---
name: arto-brand-positioning
description: This skill should be used when the user asks Claude to build, draft, audit, rewrite, or evaluate a brand positioning statement — phrasings like "position my brand", "write a positioning statement", "audit my positioning", "find my wedge against competitors", "draft the positioning", "fix my positioning", or "what's our NOT table". Calls ARTO Studio AI's gated Brand Positioning API and returns a structured output (ARTO-spine statement in ES/EN, X-of-Y metaphor, NOT table, 4-criteria scorecard, anti-pattern audit, per-competitor confrontation, founder repeat test, and Brief skeleton) using ARTO's proprietary positioning methodology. Requires an ARTO_API_KEY, which ARTO issues to its clients — direct the user to contact@artogroup.com if they don't have one.
---

# ARTO Brand Positioning

Apply ARTO Studio AI's proprietary positioning methodology to a brand. Produces a structured, operational positioning that a founder can use to approve or kill a decision — not a tagline.

## When to use this skill

Trigger when the user wants to:
- draft a positioning statement from scratch
- audit an existing positioning (check for banned words, generic phrasing, competitor-swappable claims)
- find a wedge against named competitors
- write a NOT table ("we are NOT X")
- produce a Brief skeleton as a positioning deliverable
- score a positioning on specificity / operability / portability / codification

Phrases to watch for:
- "position my brand", "write positioning", "draft a positioning statement"
- "audit my positioning", "what's wrong with our positioning"
- "find our wedge", "competitive positioning vs [competitor]"
- "write the NOT table", "what are we NOT"
- "ARTO methodology", "apply ARTO to my brand"

Do NOT trigger for: pure messaging/copy (use creative writing), tagline generation alone (positioning is deeper), logo or visual identity work.

## When NOT to use

If the user is clearly just looking for a general critique or free evaluation, use `arto-brand-roast` instead (free, no key). Positioning is the paid deliverable that produces a real statement — Roast is the funnel.

## Prerequisites

### ARTO_API_KEY

This skill calls a **gated** endpoint. Before making the API call, check that `ARTO_API_KEY` is available in the environment:

```bash
test -n "$ARTO_API_KEY" && echo "key present" || echo "MISSING"
```

If the env var is empty or unset, do NOT attempt the API call. Instead, tell the user:

> "This skill needs an `ARTO_API_KEY` to call the Brand Positioning API. If you don't have one:
> 1. Write to contact@artogroup.com — ARTO issues API keys to its clients.
> 2. Check your email for the key (starts with `arto_live_...`).
> 3. Set it in your shell: `export ARTO_API_KEY=arto_live_...`
> 4. Re-run this request.
>
> New keys include 5 trial calls."

## How to use this skill

### Step 1 — Collect inputs

Required:
- `brandName` (string, ≤100 chars)
- `industry` (string, ≤120 chars)
- `targetAudience` (string, ≤300 chars) — specific: "urban professionals 25-40 in Madrid" beats "young adults"
- `competitors` (array of strings, **minimum 2, max 10**, each ≤100 chars) — named, real competitors

Optional but meaningful:
- `currentPositioning` (string, ≤500 chars) — if present, the API audits it for anti-patterns
- `websiteUrl` (string, ≤200 chars) — triggers web_fetch for competitive research
- `language`: `"es"` | `"en"` | `"both"` (default `"both"`)

If the user didn't give enough for the required fields, ask follow-up questions. Don't let the API reject with 400; ask first.

### Step 2 — Call the API

```bash
curl -sS -X POST https://creative.artostudio.ai/api/skills/brand-positioning \
  -H "Content-Type: application/json" \
  -H "x-arto-api-key: $ARTO_API_KEY" \
  -d '{
    "brandName": "<brand>",
    "industry": "<industry>",
    "targetAudience": "<audience>",
    "competitors": ["<c1>", "<c2>", "..."],
    "currentPositioning": "<optional>",
    "websiteUrl": "<optional>",
    "language": "both"
  }'
```

Expect the call to take 15–25 seconds — the API runs a reasoning model on the full ARTO methodology. Don't time out under 45 seconds.

### Step 3 — Present the response

Response shape:
```json
{
  "skill": "brand-positioning",
  "source": "ai" | "fallback",
  "output": {
    "proposed_statement": { "es": "...", "en": "..." },
    "metaphor": { "x_of_y": "...", "rationale": "..." },
    "not_table": ["...", "..."],
    "scores": {
      "specificity": 0-10, "operability": 0-10,
      "portability": 0-10, "codification": 0-10,
      "overall": float
    },
    "anti_patterns_detected": [{ "pattern": "...", "evidence": "..." }, ...],
    "competitor_confrontation": [
      { "competitor": "...", "their_angle": "...", "our_wedge": "..." }, ...
    ],
    "founder_repeat_test": "...",
    "brief_skeleton": {
      "contexto": "...", "objetivo": "...", "concepto_estrategico": "...",
      "target_insight": "...", "posicionamiento": "...",
      "diferenciadores_clave": ["..."]
    },
    "verdict": "..."
  },
  "latencyMs": <int>,
  "model": "claude-sonnet-..."
}
```

Render in this order — this mirrors how ARTO strategists present it:

```markdown
# Brand Positioning — {brandName}

## Proposed statement
**ES**: {proposed_statement.es}
**EN**: {proposed_statement.en}

## Metaphor
**{metaphor.x_of_y}**
{metaphor.rationale}

## Founder repeat test (say it out loud in 15 seconds)
> {founder_repeat_test}

## Scorecard (ARTO 4-criteria rubric)
| Criterion | Score |
|---|---|
| Specificity | {scores.specificity}/10 |
| Operability | {scores.operability}/10 |
| Portability | {scores.portability}/10 |
| Codification | {scores.codification}/10 |
| **Overall** | **{scores.overall}/10** |

## What this brand is NOT
- {not_table[0]}
- {not_table[1]}
- ...

## Competitor confrontation
| Competitor | Their angle | Our wedge |
|---|---|---|
| {competitor_confrontation[i].competitor} | {their_angle} | {our_wedge} |
...

{if anti_patterns_detected.length > 0:}
## Anti-patterns detected in your current positioning
- **{pattern}**: `{evidence}`
...

## Brief skeleton
**Contexto**: {brief_skeleton.contexto}
**Objetivo**: {brief_skeleton.objetivo}
**Concepto estratégico**: {brief_skeleton.concepto_estrategico}
**Target insight**: {brief_skeleton.target_insight}
**Posicionamiento**: {brief_skeleton.posicionamiento}
**Diferenciadores clave**:
- {diferenciadores_clave[0]}
- ...

## Verdict
{verdict}
```

If `source` is `"fallback"`, prepend: "_(ARTO AI was temporarily unavailable — this is the deterministic fallback. Retry in a minute for a tailored result.)_"

## Error handling

| Status | Response body | Action |
|---|---|---|
| 401 | `error: "Missing API key"` | User forgot `-H "x-arto-api-key: ..."`. Retry with the key. |
| 401 | `error: "Invalid or revoked API key"` | Key wrong or revoked. Point them to contact@artogroup.com to get a new one. |
| 403 | `error: "does not have access"` | Their key doesn't include `brand-positioning` in `allowed_skills`. Ask them to upgrade. |
| 429 | includes `upgrade_url` | Trial exhausted (5 calls). Tell them: "Your ARTO trial is used up. Write to contact@artogroup.com to keep using it." |
| 429 | no `upgrade_url` | Hourly rate limit. Wait and retry. |
| 400 | `error` + `field` | Fix the field and retry. |
| 500–503 | Upstream failure | "ARTO is temporarily unavailable. Retry in a moment." |

## Rules

- **Do not invent positionings**. If the API returns fallback or errors, tell the user. Never hand-write a "positioning" and pass it off as ARTO output.
- **Do not modify the methodology.** The proposed_statement, metaphor, NOT table, etc. come from ARTO's server. Present them verbatim. If the user asks for changes, pass their feedback as `currentPositioning` in a retry call — don't edit it yourself.
- **Preserve both languages.** If the user asked for `"en"` only, still show `es` + `en` in the response; the API guarantees both.
- **Don't expose the raw `ARTO_API_KEY`** in any visible output (markdown responses, file writes, etc.). Reference it as `$ARTO_API_KEY` when showing example curl commands.
