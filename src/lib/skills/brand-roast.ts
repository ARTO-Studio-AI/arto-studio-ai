import { buildRoastSystemPrompt, legacyRoastTool } from "@/lib/roast-prompt";
import { runBrandRoast, weightedOverall } from "@/lib/roast-runner";
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

  const companySize = typeof b.companySize === "string" ? b.companySize.trim().slice(0, 40) : undefined;

  // v2 (2026-10-06): idioma de salida. Sin `lang` se queda en ingles, como antes,
  // para no cambiarle el idioma a quien ya llama al API; la pagina /roast lo manda.
  const lang = b.lang === "es" ? "es" : "en";

  return {
    valid: true,
    data: {
      brandName,
      industry,
      ...(websiteUrl && { websiteUrl }),
      ...(companySize && { companySize }),
      ...(description && { description }),
      lang,
    },
  };
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
  // El roast corre por customRun (roast-runner.ts). Estos dos campos solo los usa el
  // catalogo y la ruta generica del engine, que con customRun ya no se ejecuta.
  systemPromptBuilder: (knowledge, input) => buildRoastSystemPrompt(knowledge, input.lang === "es" ? "es" : "en"),
  outputToolSchema: legacyRoastTool,
  customRun: async (input) => {
    const run = await runBrandRoast(input);
    return { output: run.output, model: run.model };
  },
  // Sin fallbackFn desde el v2: el roast de plantilla no habla de la marca. Si el modelo
  // falla, el engine lanza SkillExecutionError y las rutas responden 503.
  computeDerived: (out) => ({
    ...out,
    overall: weightedOverall(out),
    improvements: out.improvements.slice(0, 5),
  }),
  maxTokens: 8000,
};

registerSkill(brandRoastSkill);
