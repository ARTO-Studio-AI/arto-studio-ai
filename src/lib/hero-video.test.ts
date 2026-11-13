import { describe, expect, it } from "vitest";
import { promptOfTheDayIndex } from "./hero-video";

describe("prompt del dia", () => {
  it("sin prompts no hay indice", () => {
    expect(promptOfTheDayIndex(0)).toBe(-1);
  });
  it("es el mismo todo el dia y cambia al siguiente", () => {
    const a = promptOfTheDayIndex(6, new Date("2026-11-11T00:01:00Z"));
    const b = promptOfTheDayIndex(6, new Date("2026-11-11T23:59:00Z"));
    const c = promptOfTheDayIndex(6, new Date("2026-11-12T00:01:00Z"));
    expect(a).toBe(b);
    expect(c).toBe((a + 1) % 6);
  });
});
