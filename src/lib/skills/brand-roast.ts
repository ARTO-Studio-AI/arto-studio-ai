import { buildSystemPrompt, roastTool } from "@/lib/roast-prompt";
import { generateDeterministicRoast } from "@/lib/roast-fallback";
import type { RoastRequest, RoastResult } from "@/lib/roast-types";
import { registerSkill } from "./registry";
import type { SkillDefinition, InputValidationResult } from "./types";

/**
 * Brand Roast — ARTO's first skill and public marketing funnel.
 * This is the ONLY skill marked `public: true`. Every future skill is gated
 * behind a client API key.
 */

function validateRoastInput(body: unknown): InputValidationResult<RoastRequest> {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body is required", field: "body" };
  }
  const b = body as Record<string, unknown>;

  const brandName = typeof b.brandName === "string" ? b.brandName.trim() : "";
  if (!brandName) return { valid: false, error: "Brand name is required", field: "brandName" };
  if (brandName.length > 100)
    return { valid: false, error: "Brand name must be 100 characters or less", field: "brandName" };

  const industry = typeof b.industry === "string" ? b.industry.trim() : "";
  if (!industry) return { valid: false, error: "Industry is required", field: "industry" };

  const websiteUrl = typeof b.websiteUrl === "string" ? b.websiteUrl.trim() : undefined;
  if (websiteUrl && websiteUrl.length > 200)
    return { valid: false, error: "Website URL must be 200 characters or less", field: "websiteUrl" };

  const description = typeof b.description === "string" ? b.description.trim() : undefined;
  if (description && description.length > 500)
    return { valid: false, error: "Description must be 500 characters or less", field: "description" };

  const companySize = typeof b.companySize === "string" ? b.companySize.trim() : undefined;

  return {
    valid: true,
    data: {
      brandName,
      industry,
      ...(websiteUrl && { websiteUrl }),
      ...(companySize && { companySize }),
      ...(description && { description }),
    },
  };
}

function weightedOverall(out: RoastResult): number {
  return (
    Math.round(
      (out.strategy.score * 0.3 +
        out.creativity.score * 0.25 +
        out.narrative.score * 0.25 +
        out.digital.score * 0.2) *
        10
    ) / 10
  );
}

export const brandRoastSkill: SkillDefinition<RoastRequest, RoastResult> = {
  slug: "brand-roast",
  name: "Brand Roast",
  description: "Brutally honest brand evaluation across 4 ARTO pillars (Strategy, Creativity, Narrative, Digital).",
  public: true,
  knowledgeKeys: ["strategy", "narrative", "rubric", "trends"],
  requiresWebFetch: true,
  urlField: "websiteUrl",
  inputValidator: validateRoastInput,
  systemPromptBuilder: (knowledge, input) => buildSystemPrompt(knowledge, input),
  outputToolSchema: roastTool,
  fallbackFn: (input) =>
    generateDeterministicRoast(input.brandName, input.industry, input.description ?? ""),
  computeDerived: (out) => ({
    ...out,
    overall: weightedOverall(out),
    improvements: out.improvements.slice(0, 5),
  }),
  maxTokens: 4500,
};

registerSkill(brandRoastSkill);
