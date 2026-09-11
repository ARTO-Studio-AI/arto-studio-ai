import Anthropic from "@anthropic-ai/sdk";
import { loadKnowledge } from "@/lib/knowledge";
import { saveSkillTrace } from "@/lib/trace-store";
import { incrementTrialCallsUsed } from "@/lib/clients/store";
import { getSkill } from "./registry";
import type { SkillContext, SkillResponse } from "./types";

/**
 * Generic skill execution engine.
 *
 * Given a registered skill slug + validated input + context, this:
 *   1. Loads the skill's knowledge slices
 *   2. Builds the system prompt
 *   3. Calls Claude with web_fetch (optional) + the skill's deliver tool
 *   4. Extracts the structured tool_use output
 *   5. Falls back to the skill's deterministic fn on error (if defined)
 *   6. Persists a trace fire-and-forget
 *   7. Returns a normalized SkillResponse
 */

export class SkillNotFoundError extends Error {
  constructor(slug: string) {
    super(`Skill '${slug}' is not registered`);
    this.name = "SkillNotFoundError";
  }
}

export class SkillExecutionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "SkillExecutionError";
  }
}

export async function runSkill<TIn, TOut>(
  slug: string,
  input: TIn,
  ctx: SkillContext
): Promise<SkillResponse<TOut>> {
  const skill = getSkill(slug);
  if (!skill) throw new SkillNotFoundError(slug);

  const startTime = Date.now();
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  // If no API key, go straight to fallback (or fail if none)
  if (!process.env.ANTHROPIC_API_KEY) {
    return finishWithFallback<TIn, TOut>(slug, input, ctx, startTime, "no-api-key");
  }

  try {
    const anthropic = new Anthropic();
    const knowledge = loadKnowledge(skill.knowledgeKeys);
    const systemPrompt = skill.systemPromptBuilder(knowledge, input as unknown as never);

    // Build user message — include URL hint if the skill uses web_fetch
    const hasUrl =
      skill.requiresWebFetch &&
      skill.urlField !== undefined &&
      typeof (input as Record<string, unknown>)[skill.urlField] === "string" &&
      ((input as Record<string, unknown>)[skill.urlField] as string).length > 0;

    const urlValue = hasUrl
      ? ((input as Record<string, unknown>)[skill.urlField as unknown as string] as string)
      : undefined;

    const userMessage = [
      `Input: ${JSON.stringify(input)}`,
      "",
      hasUrl
        ? `IMPORTANT: You MUST use the web_fetch tool to visit ${urlValue} and analyze the actual content BEFORE producing your output. Base your evaluation on what you actually observe, not on assumptions. Then call the ${skill.outputToolSchema.name} tool with your result.`
        : `Produce your output by calling the ${skill.outputToolSchema.name} tool.`,
    ].join("\n");

    // Build tools list
    const tools: Array<Record<string, unknown>> = [
      skill.outputToolSchema as unknown as Record<string, unknown>,
    ];
    if (hasUrl) {
      tools.unshift({
        type: "web_fetch_20250910",
        name: "web_fetch",
        max_uses: 3,
        max_content_tokens: 50000,
      });
    }

    const createParams = {
      model,
      max_tokens: skill.maxTokens ?? 4000,
      system: systemPrompt,
      tools: tools as never,
      tool_choice: hasUrl
        ? ({ type: "auto" } as const)
        : ({ type: "tool", name: skill.outputToolSchema.name } as const),
      messages: [{ role: "user" as const, content: userMessage }],
    };

    const response = hasUrl
      ? await anthropic.beta.messages.create({
          ...createParams,
          betas: ["web-fetch-2025-09-10"],
        })
      : await anthropic.messages.create(createParams);

    // Extract the deliver tool_use block
    const toolName = skill.outputToolSchema.name;
    const toolBlock = response.content.find(
      (block) => block.type === "tool_use" && block.name === toolName
    );

    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new SkillExecutionError(
        `Claude did not call the '${toolName}' tool. Response: ${JSON.stringify(response.content).slice(0, 200)}`
      );
    }

    let output = toolBlock.input as TOut;
    if (skill.computeDerived) {
      output = skill.computeDerived(output, input as unknown as never) as TOut;
    }

    const latencyMs = Date.now() - startTime;

    // H-34 (2026-09-11): antes era `void saveSkillTrace(...)`. En Vercel la funcion se
    // congela al responder y la promesa nunca terminaba: cero trazas en skill_traces.
    // Se espera; saveSkillTrace nunca lanza (regresa false y loguea).
    await saveSkillTrace({
      skill_slug: slug,
      client_id: ctx.clientId,
      input: input as unknown,
      output: output as unknown,
      source: "ai",
      model,
      latency_ms: latencyMs,
      email: null,
    });

    // Misma razon: el contador del trial se espera para que quede escrito.
    if (ctx.clientId) {
      await incrementTrialCallsUsed(ctx.clientId);
    }

    // Structured log for Vercel logs
    console.log(
      JSON.stringify({
        event: "skill_trace",
        skill_slug: slug,
        client_id: ctx.clientId,
        source: "ai",
        model,
        latency_ms: latencyMs,
      })
    );

    return {
      skill: slug,
      source: "ai",
      output,
      latencyMs,
      model,
    };
  } catch (error) {
    console.error(`[skills/engine] ${slug} AI error:`, error);
    return finishWithFallback<TIn, TOut>(slug, input, ctx, startTime, "ai-error");
  }
}

// async solo porque ahora se esperan la traza y el contador (H-34); los callers ya
// hacian `return finishWithFallback(...)` dentro de una funcion async, no cambian.
async function finishWithFallback<TIn, TOut>(
  slug: string,
  input: TIn,
  ctx: SkillContext,
  startTime: number,
  reason: string
): Promise<SkillResponse<TOut>> {
  const skill = getSkill(slug)!;

  if (!skill.fallbackFn) {
    throw new SkillExecutionError(
      `Skill '${slug}' has no fallback and Claude failed (${reason}).`
    );
  }

  let output = skill.fallbackFn(input as unknown as never) as TOut;
  if (skill.computeDerived) {
    output = skill.computeDerived(output, input as unknown as never) as TOut;
  }

  const latencyMs = Date.now() - startTime;

  // H-34: se espera (ver arriba).
  await saveSkillTrace({
    skill_slug: slug,
    client_id: ctx.clientId,
    input: input as unknown,
    output: output as unknown,
    source: "fallback",
    model: reason,
    latency_ms: latencyMs,
    email: null,
  });

  if (ctx.clientId) {
    await incrementTrialCallsUsed(ctx.clientId);
  }

  console.log(
    JSON.stringify({
      event: "skill_trace",
      skill_slug: slug,
      client_id: ctx.clientId,
      source: "fallback",
      model: reason,
      latency_ms: latencyMs,
    })
  );

  return {
    skill: slug,
    source: "fallback",
    output,
    latencyMs,
    model: reason,
  };
}
