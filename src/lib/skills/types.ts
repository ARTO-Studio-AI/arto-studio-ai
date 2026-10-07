import type { Tool } from "@anthropic-ai/sdk/resources/messages";

/**
 * Core types for the ARTO skills library.
 *
 * A skill is a self-contained unit of ARTO methodology exposed via the API.
 * Each skill declares its input/output shapes, which knowledge slices it
 * needs, how its system prompt is built, and (optionally) a deterministic
 * fallback when Claude is unavailable.
 */

export type InputValidationResult<TInput> =
  | { valid: true; data: TInput }
  | { valid: false; error: string; field?: string };

export interface SkillContext {
  /** ID of the authenticated client calling this skill, or null for public calls. */
  clientId: string | null;
  /** IP of the caller, for rate limiting on public skills. */
  ip: string;
}

/**
 * Definition of a single skill. Register via `registerSkill()` in the registry.
 */
export interface SkillDefinition<TInput = unknown, TOutput = unknown> {
  /** URL-safe identifier used in /api/skills/{slug}. */
  slug: string;

  /** Human-readable name shown in the catalog. */
  name: string;

  /** One-sentence description of what the skill does. */
  description: string;

  /**
   * If true, this skill is callable without an API key (rate-limited by IP).
   * Only the Brand Roast should be public — it's the marketing funnel.
   * Every other skill MUST be gated (default: false).
   */
  public: boolean;

  /** Knowledge slice keys from `src/lib/knowledge.ts` this skill needs. */
  knowledgeKeys: string[];

  /** Whether the skill should use Claude's web_fetch tool when a URL is provided. */
  requiresWebFetch: boolean;

  /** Name of the field in `TInput` that holds the URL (if `requiresWebFetch`). */
  urlField?: keyof TInput & string;

  /**
   * Validate + normalize raw JSON body into a typed TInput.
   * Returns field-level errors for 400 responses.
   */
  inputValidator: (body: unknown) => InputValidationResult<TInput>;

  /**
   * Build the Claude system prompt. Receives the knowledge context already
   * concatenated for this skill's `knowledgeKeys`, plus the validated input.
   */
  systemPromptBuilder: (knowledge: string, input: TInput) => string;

  /** Claude tool schema for structured output. The tool name becomes the "deliver" tool. */
  outputToolSchema: Tool;

  /**
   * Optional: deterministic fallback when Claude is unavailable or errors.
   * If absent, failures surface as 503 to the caller.
   */
  fallbackFn?: (input: TInput) => TOutput;

  /**
   * Optional: post-process the raw Claude output before returning.
   * Useful for derived fields (e.g. Brand Roast's weighted overall score).
   */
  computeDerived?: (rawOutput: TOutput, input: TInput) => TOutput;

  /** Max tokens for the Claude call. Default 4000. */
  maxTokens?: number;

  /**
   * Optional: el skill trae su propia ejecucion y el engine solo pone trazas y
   * fallback alrededor. Lo usa el Brand Roast v2 (2026-10-06), que lee el sitio en el
   * servidor y usa salida estructurada en vez de tool_choice forzado. Si lanza, el
   * engine responde con `fallbackFn` igual que con la ruta normal.
   */
  customRun?: (input: TInput, ctx: SkillContext) => Promise<{ output: TOutput; model: string }>;
}

/**
 * Generic response shape for all skill calls.
 * Legacy aliases (like /api/roast) may transform this to a custom shape.
 */
export interface SkillResponse<TOutput = unknown> {
  skill: string;
  source: "ai" | "fallback";
  output: TOutput;
  latencyMs: number;
  model: string;
  /** Id de la traza guardada (solo en la ruta customRun, 2026-10-07). */
  traceId?: number | null;
}

/** Entry in the public skills catalog. */
export interface SkillCatalogEntry {
  slug: string;
  name: string;
  description: string;
  public: boolean;
  requiresWebFetch: boolean;
  inputFields: string[];
  outputFields: string[];
}
