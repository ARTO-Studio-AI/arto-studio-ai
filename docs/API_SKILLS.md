> Movido aquí desde `docs/ADDING_A_SKILL.md` el 2026-11-05. Es para los skills del **API** (motor `src/lib/skills/`, Brand Roast y Positioning). Para subir skills descargables, mods y prompts al sitio, la guía es `docs/ADDING_A_SKILL.md`.

# Adding a new skill to ARTO Studio AI

Target: from "I have an idea for a skill" → "it's live in production" in ~15 minutes.

Every skill is a self-contained `SkillDefinition<TInput, TOutput>` registered in `src/lib/skills/index.ts`. The generic engine (`src/lib/skills/engine.ts`) handles: input validation → knowledge loading → Claude call (optionally with `web_fetch`) → tool extraction → derived fields → fallback → trace persistence. You do not touch it.

Unless you set `public: true`, the new skill is gated behind a client API key automatically. Only `brand-roast` is public.

## The 4 steps

### 1. Define the input and output types

Either add them to an existing `*-types.ts` file or create `src/lib/skills/<slug>-types.ts`.

```ts
export interface BrandPositioningRequest {
  brandName: string;
  industry: string;
  audience: string;
  competitors?: string[];
  websiteUrl?: string;
}

export interface BrandPositioningResult {
  positioningStatement: string;
  pillars: Array<{ name: string; description: string }>;
  differentiators: string[];
  risks: string[];
}
```

### 2. Write the system prompt and the Claude tool schema

The system prompt receives the concatenated ARTO knowledge slices you declare + the validated input. The tool schema is what Claude must fill in.

```ts
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export function buildBrandPositioningPrompt(knowledge: string): string {
  return `You are ARTO Studio AI's Brand Positioning engine.
Use the methodology below to produce a sharp, differentiated positioning.

${knowledge}

Return exactly one call to the deliver_positioning tool.`;
}

export const brandPositioningTool: Tool = {
  name: "deliver_positioning",
  description: "Deliver a brand positioning statement + pillars.",
  input_schema: {
    type: "object",
    properties: {
      positioningStatement: { type: "string" },
      pillars: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["name", "description"],
        },
      },
      differentiators: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
    },
    required: ["positioningStatement", "pillars", "differentiators", "risks"],
  },
};
```

### 3. (Optional) Write a deterministic fallback

If Claude is down or there's no API key, the engine calls `fallbackFn(input)`. Skip this if the skill should just 503 on failure — but for anything customer-facing, write one.

```ts
export function fallbackPositioning(input: BrandPositioningRequest): BrandPositioningResult {
  return {
    positioningStatement: `${input.brandName} — the [category] brand for [audience] who want [outcome].`,
    pillars: [
      { name: "Clarity", description: "State what you do in one sentence." },
      { name: "Tension", description: "Define who you are NOT for." },
      { name: "Proof", description: "Show the receipts, not the promise." },
    ],
    differentiators: ["Define 3-5 truths only you can claim."],
    risks: ["Generic category language erodes differentiation."],
  };
}
```

### 4. Register the skill

Create `src/lib/skills/brand-positioning.ts`:

```ts
import { registerSkill } from "./registry";
import type { SkillDefinition, InputValidationResult } from "./types";
import type { BrandPositioningRequest, BrandPositioningResult } from "./brand-positioning-types";
import { buildBrandPositioningPrompt, brandPositioningTool } from "./brand-positioning-prompt";
import { fallbackPositioning } from "./brand-positioning-fallback";

function validate(body: unknown): InputValidationResult<BrandPositioningRequest> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body is required", field: "body" };
  }
  const b = body as Record<string, unknown>;
  const brandName = typeof b.brandName === "string" ? b.brandName.trim() : "";
  const industry = typeof b.industry === "string" ? b.industry.trim() : "";
  const audience = typeof b.audience === "string" ? b.audience.trim() : "";
  if (!brandName) return { valid: false, error: "brandName required", field: "brandName" };
  if (!industry) return { valid: false, error: "industry required", field: "industry" };
  if (!audience) return { valid: false, error: "audience required", field: "audience" };
  return {
    valid: true,
    data: {
      brandName,
      industry,
      audience,
      competitors: Array.isArray(b.competitors)
        ? (b.competitors as unknown[]).filter((c): c is string => typeof c === "string")
        : undefined,
      websiteUrl: typeof b.websiteUrl === "string" ? b.websiteUrl : undefined,
    },
  };
}

export const brandPositioningSkill: SkillDefinition<BrandPositioningRequest, BrandPositioningResult> = {
  slug: "brand-positioning",
  name: "Brand Positioning",
  description: "Generate a sharp, differentiated brand positioning statement with pillars.",
  public: false, // gated — requires client API key
  knowledgeKeys: ["strategy", "narrative"],
  requiresWebFetch: true,
  urlField: "websiteUrl",
  inputValidator: validate,
  systemPromptBuilder: (knowledge) => buildBrandPositioningPrompt(knowledge),
  outputToolSchema: brandPositioningTool,
  fallbackFn: fallbackPositioning,
  maxTokens: 3000,
};

registerSkill(brandPositioningSkill);
```

Then add one import line to `src/lib/skills/index.ts`:

```ts
import "./brand-positioning";
```

That's it. The skill is now callable at `POST /api/skills/brand-positioning` with header `x-arto-api-key: arto_live_...`. It shows up in `GET /api/skills` for clients whose `allowed_skills` includes its slug (or `"*"`).

## Knowledge slices

`knowledgeKeys` references keys in `src/lib/knowledge.ts → KNOWLEDGE_MAP`. To add a new slice:

1. Drop a `.md` file somewhere under `/knowledge/` (e.g. `/knowledge/methodology/positioning.md`).
2. Register it in `KNOWLEDGE_MAP` under a short key (`positioning: "knowledge/methodology/positioning.md"`).
3. Reference the key from your skill's `knowledgeKeys`.

The loader caches per key, so slices you don't use aren't loaded.

## Permissioning a client

```bash
curl -X POST https://arto-studio-ai.vercel.app/api/admin/clients \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Co",
    "email": "ops@acme.com",
    "tier": "agency",
    "allowed_skills": ["brand-roast", "brand-positioning"],
    "rate_limit_per_hour": 100
  }'
```

The response contains `api_key` **once**. Send it to the client over a secure channel — it's never retrievable again.

## Checklist before shipping a skill

- [ ] Input validator rejects missing/oversized fields with a clear `field` name.
- [ ] Tool schema lists every required output field.
- [ ] System prompt references ARTO methodology, not generic advice.
- [ ] Fallback produces something usable (not "TODO").
- [ ] `knowledgeKeys` loads only what the skill actually needs.
- [ ] Decided `public` flag deliberately (default: `false`).
- [ ] `npm run build` passes locally.
- [ ] Smoke test via curl against localhost before deploying.
