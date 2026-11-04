import { describe, expect, it } from "vitest";
import {
  SIGNUP_BAR_DISMISS_DAYS,
  dismissedRecently,
  formatCount,
  hasSupabaseSessionCookie,
  isSignupBarExcluded,
  pathSection,
  signupHref,
} from "./signup-bar";

describe("hasSupabaseSessionCookie", () => {
  it("detecta la cookie de sesion entera o partida", () => {
    expect(hasSupabaseSessionCookie("sb-abcd-auth-token=base64-xyz")).toBe(true);
    expect(hasSupabaseSessionCookie("asai_vid=1; sb-abcd-auth-token.0=base64-xyz; x=2")).toBe(true);
  });
  it("no confunde otras cookies ni una vacia", () => {
    expect(hasSupabaseSessionCookie("")).toBe(false);
    expect(hasSupabaseSessionCookie(null)).toBe(false);
    expect(hasSupabaseSessionCookie("asai_consent=all; ph_x=1")).toBe(false);
    expect(hasSupabaseSessionCookie("sb-abcd-auth-token-code-verifier=abc")).toBe(false);
    expect(hasSupabaseSessionCookie("sb-abcd-auth-token=")).toBe(false);
  });
});

describe("isSignupBarExcluded", () => {
  it("oculta la barra en login y cuenta", () => {
    expect(isSignupBarExcluded("/es/login")).toBe(true);
    expect(isSignupBarExcluded("/en/login/")).toBe(true);
    expect(isSignupBarExcluded("/es/account")).toBe(true);
  });
  it("la deja en el resto", () => {
    expect(isSignupBarExcluded("/es")).toBe(false);
    expect(isSignupBarExcluded("/es/prompts/BR-0001")).toBe(false);
    expect(isSignupBarExcluded("/es/loginx")).toBe(false);
  });
});

describe("dismissedRecently", () => {
  const now = Date.UTC(2026, 10, 5);
  it("respeta el cierre dentro del plazo", () => {
    expect(dismissedRecently(String(now - 1000), now)).toBe(true);
  });
  it("vuelve a mostrar pasado el plazo o con basura", () => {
    expect(dismissedRecently(String(now - (SIGNUP_BAR_DISMISS_DAYS + 1) * 86_400_000), now)).toBe(false);
    expect(dismissedRecently(null, now)).toBe(false);
    expect(dismissedRecently("nope", now)).toBe(false);
  });
});

describe("signupHref y pathSection", () => {
  it("manda a login con next de la ruta actual", () => {
    expect(signupHref("es", "/es/prompts/BR-0001")).toBe("/es/login?next=%2Fes%2Fprompts%2FBR-0001");
    expect(signupHref("en", "/en/prompts", "?tier=free")).toBe("/en/login?next=%2Fen%2Fprompts%3Ftier%3Dfree");
  });
  it("saca la seccion sin ids", () => {
    expect(pathSection("/es")).toBe("home");
    expect(pathSection("/es/prompts/BR-0001")).toBe("prompts");
    expect(pathSection("/en/pricing")).toBe("pricing");
  });
});

describe("formatCount", () => {
  it("usa separador de miles", () => {
    expect(formatCount(3001, "es")).toBe("3,001");
    expect(formatCount(749, "en")).toBe("749");
  });
});
