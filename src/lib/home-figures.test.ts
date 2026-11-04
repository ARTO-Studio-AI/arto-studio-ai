import { describe, expect, it } from "vitest";
import { VERTICAL_COUNT, formatPromptCount, toolsFromModels } from "./home-figures";

describe("formatPromptCount", () => {
  it("deja exacto debajo de mil y redondea hacia abajo arriba", () => {
    expect(formatPromptCount(12)).toBe("12");
    expect(formatPromptCount(999)).toBe("999");
    expect(formatPromptCount(1842)).toBe("1,800+");
    expect(formatPromptCount(3045)).toBe("3,000+");
  });
});

describe("VERTICAL_COUNT", () => {
  it("cuenta las 12 verticales del catalogo", () => {
    expect(VERTICAL_COUNT).toBe(12);
  });
});

describe("toolsFromModels", () => {
  const rep = (m: string, n: number) => Array.from({ length: n }, () => m);

  it("junta las variantes de Claude y GPT y ordena por uso", () => {
    const tools = toolsFromModels(
      [...rep("claude_sonnet", 5), ...rep("claude", 2), ...rep("gpt_5", 4), ...rep("midjourney", 3)],
      { min: 1 },
    );
    expect(tools.map((t) => [t.label, t.count])).toEqual([
      ["Claude", 7],
      ["ChatGPT", 4],
      ["Midjourney", 3],
    ]);
  });

  it("deja fuera genericos, herramientas en retiro, modelos sin ficha y nulos", () => {
    const tools = toolsFromModels(
      [...rep("any", 9), ...rep("generic", 9), ...rep("sora", 9), ...rep("dall-e", 9), ...rep("modelo_raro", 9), null, undefined, ...rep("suno", 1)],
      { min: 1 },
    );
    expect(tools.map((t) => t.label)).toEqual(["Suno"]);
  });

  it("respeta el minimo y el limite", () => {
    const models = [...rep("elevenlabs", 5), ...rep("veo", 2), ...rep("kling", 4), ...rep("flux", 6)];
    expect(toolsFromModels(models, { min: 3 }).map((t) => t.label)).toEqual(["Flux Pro", "ElevenLabs", "Kling"]);
    expect(toolsFromModels(models, { min: 1, limit: 2 }).map((t) => t.label)).toEqual(["Flux Pro", "ElevenLabs"]);
  });
});
