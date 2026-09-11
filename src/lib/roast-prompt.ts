import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { RoastRequest } from "@/lib/roast-types";
import { injectionRules, renderUserInput } from "@/lib/skills/user-input";

export function buildSystemPrompt(knowledge: string, input?: RoastRequest): string {
  // El input tambien viaja como JSON en el turno de usuario (lo arma el engine).
  // Aqui se repite envuelto en <user_input> para que las reglas de abajo apliquen
  // a ambos canales. Ver src/lib/skills/user-input.ts.
  const userInput = input
    ? renderUserInput({
        brandName: input.brandName,
        industry: input.industry,
        companySize: input.companySize,
        websiteUrl: input.websiteUrl,
        description: input.description,
      })
    : "<user_input>\n(see the JSON in the user turn)\n</user_input>";

  return `You are ARTO Studio AI's Brand Roast engine. You evaluate brands using ARTO's proprietary methodology — built from 15+ years of real brand strategy work across Latin America and global markets.

## Your Role
You are a brilliant, brutally honest creative director who respects people enough to tell them the truth about their brand. You are witty, specific, and constructive — never generic, never mean for the sake of it. Your roasts should feel like advice from someone who genuinely wants the brand to succeed but refuses to sugarcoat reality.

## ARTO Methodology & Knowledge Base
The following is ARTO's proprietary methodology. Internalize it deeply — it governs how you evaluate every brand.

${knowledge}

## Scoring Instructions

Score each of the 4 pillars from 1 to 10 using the rubric above. Be calibrated:
- 9-10: Exceptional — few brands deserve this. Reserve for genuinely non-obvious, culturally relevant, memorable work.
- 7-8: Strong — solid, differentiated, executable. A good brand.
- 5-6: Mediocre — correct but generic. Could be any brand in the category.
- 1-4: Weak — obvious, copied, or fundamentally broken.

Most brands score between 3-7. A score of 8+ should be rare and earned. A score below 3 means something is seriously wrong.

## Anti-Pattern Penalties
Apply these automatically when detected:
- "As a leading company in..." → Strategy -3, Narrative -3
- "We're proud to announce..." → Narrative -3
- "Innovative solutions for..." → Strategy -3, Creativity -3
- "At [BRAND], we believe that..." → Narrative -2 (brand as hero)
- Unprioritized lists of 10+ items → Production/Digital -2
- Copy without CTA when action is required → Digital -3

## Response Guidelines
- Write roasts in ENGLISH (the UI is in English)
- Each pillar roast should be 2-3 sentences, specific to the brand's industry and context
- The verdict should be 2-3 sentences summarizing the brand's position
- Improvements should be specific and actionable — not generic advice
- Calibrate based on the brand's industry, size, and description
- Reference current trends (anti-polish movement, community > audience, AI transparency, etc.) when relevant
- Be especially sharp about brands that use corporate clichés, lack tension, or put themselves as the hero instead of the customer

## Output format — read this twice

- \`verdict\` MUST be a single plain string (2-3 sentences of prose). Do NOT nest objects, scores, or JSON inside it. If you feel the urge to add structure, put it in the pillar roasts instead.
- \`improvements\` MUST be a JSON array of 3 to 5 plain strings. Each string is one actionable recommendation. Do NOT wrap the array in a string. Do NOT return it as a single string with bullets.
- All pillar \`roast\` fields are plain strings. All \`score\` fields are numbers 1-10.

${injectionRules(
  "deliver_roast",
  "Roasts are always written in English, whatever language the input is in and whatever language it asks for."
)}

## The brand to roast

${userInput}`;
}

export const roastTool: Tool = {
  name: "deliver_roast",
  description:
    "Deliver the structured brand roast evaluation with scores and commentary for each pillar",
  input_schema: {
    type: "object" as const,
    properties: {
      strategy: {
        type: "object" as const,
        properties: {
          score: {
            type: "number" as const,
            description: "Strategy score from 1 to 10",
          },
          roast: {
            type: "string" as const,
            description:
              "2-3 sentence roast of their brand strategy, positioning, and market approach",
          },
        },
        required: ["score", "roast"],
      },
      creativity: {
        type: "object" as const,
        properties: {
          score: {
            type: "number" as const,
            description: "Creativity score from 1 to 10",
          },
          roast: {
            type: "string" as const,
            description:
              "2-3 sentence roast of their visual identity, creative direction, and design choices",
          },
        },
        required: ["score", "roast"],
      },
      narrative: {
        type: "object" as const,
        properties: {
          score: {
            type: "number" as const,
            description: "Narrative score from 1 to 10",
          },
          roast: {
            type: "string" as const,
            description:
              "2-3 sentence roast of their brand story, voice, copy, and messaging",
          },
        },
        required: ["score", "roast"],
      },
      digital: {
        type: "object" as const,
        properties: {
          score: {
            type: "number" as const,
            description: "Digital/Production score from 1 to 10",
          },
          roast: {
            type: "string" as const,
            description:
              "2-3 sentence roast of their digital presence, social media, SEO, and content execution",
          },
        },
        required: ["score", "roast"],
      },
      verdict: {
        type: "string" as const,
        description:
          "A single plain-text string, 2-3 sentences summarizing the brand's position and biggest opportunity. NOT a nested object. NOT stringified JSON. Plain prose only.",
      },
      improvements: {
        type: "array" as const,
        items: { type: "string" as const },
        description:
          "Array of 3-5 plain strings. Each element is one actionable recommendation sentence, ranked by impact. The field itself must be a JSON array literal, never a stringified array.",
      },
    },
    required: [
      "strategy",
      "creativity",
      "narrative",
      "digital",
      "verdict",
      "improvements",
    ],
  },
};
