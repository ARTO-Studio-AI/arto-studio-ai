import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, analyticsAllowed, parseConsent, readCookie, serializeConsent } from "./consent";

/* Cookie asai_consent (H-48, 9 oct 2026): sin respuesta, con otra version o con un
 * valor raro no hay analitica. */

describe("consent", () => {
  it("lee las dos elecciones de la version vigente", () => {
    expect(parseConsent(serializeConsent("all"))).toBe("all");
    expect(parseConsent(serializeConsent("essential"))).toBe("essential");
    expect(parseConsent(encodeURIComponent(serializeConsent("all")))).toBe("all");
  });

  it("sin cookie, version vieja o valor raro no hay eleccion", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("all")).toBeNull();
    expect(parseConsent("all.v0-viejo")).toBeNull();
    expect(parseConsent(`todo.${CONSENT_VERSION}`)).toBeNull();
  });

  it("solo 'all' permite analitica", () => {
    expect(analyticsAllowed(serializeConsent("all"))).toBe(true);
    expect(analyticsAllowed(serializeConsent("essential"))).toBe(false);
    expect(analyticsAllowed(undefined)).toBe(false);
  });

  it("readCookie encuentra la cookie exacta, no una con prefijo parecido", () => {
    const jar = "asai_consent_x=1; asai_consent=all.v1; otra=2";
    expect(readCookie(jar, "asai_consent")).toBe("all.v1");
    expect(readCookie(jar, "nada")).toBeUndefined();
    expect(readCookie(undefined, "asai_consent")).toBeUndefined();
  });
});
