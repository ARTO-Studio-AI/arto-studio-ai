import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

/* H-46: el `next` del callback solo puede ser una ruta del mismo origin. */

const SITE = "https://creative.artostudio.ai";

describe("safeNextPath", () => {
  it.each([
    ["/en/prompts", "/en/prompts"],
    ["/es/account?x=1#a", "/es/account?x=1#a"],
    ["/", "/"],
    ["/es/prompts/../account", "/es/account"],
  ])("acepta la ruta interna %s", (next, expected) => {
    expect(safeNextPath(next, "/", SITE)).toBe(expected);
  });

  it.each([
    ".evil.com",
    "@evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "http://evil.com",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "%2F%2Fevil.com",
    "evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/en\r\nSet-Cookie:x=1",
    "///evil.com",
    "",
  ])("rechaza %j y devuelve el fallback", (next) => {
    expect(safeNextPath(next, "/", SITE)).toBe("/");
  });

  it("null y undefined devuelven el fallback", () => {
    expect(safeNextPath(null, "/", SITE)).toBe("/");
    expect(safeNextPath(undefined, "/", SITE)).toBe("/");
  });

  it("respeta un fallback distinto", () => {
    expect(safeNextPath("@evil.com", "/es", SITE)).toBe("/es");
    expect(safeNextPath(null, "/en/prompts", SITE)).toBe("/en/prompts");
  });

  it("con siteUrl invalido devuelve el fallback", () => {
    expect(safeNextPath("/en/prompts", "/", "no es url")).toBe("/");
  });

  it("el resultado concatenado al siteUrl nunca sale del origin", () => {
    for (const next of ["/en/prompts", ".evil.com", "@evil.com", "//evil.com", "/\\evil.com"]) {
      const target = new URL(`${SITE}${safeNextPath(next, "/", SITE)}`);
      expect(target.origin).toBe(SITE);
    }
  });
});
