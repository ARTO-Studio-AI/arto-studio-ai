import { describe, expect, it } from "vitest";
import { roastReportEmail } from "@/lib/email-templates/roast-report";
import { WELCOME_DEFAULT, welcomeEmail } from "@/lib/email-templates/welcome";
import { sanitizeWelcome } from "@/lib/email-config";

/* Correos de marca (2026-10-07). */

const result = {
  overall: 4.6,
  headline: "Una frase <script>alert(1)</script>",
  strategy: { score: 5, roast: "a" },
  creativity: { score: 5, roast: "b" },
  narrative: { score: 4, roast: "c" },
  digital: { score: 4, roast: "d" },
  verdict: "v",
  improvements: ["uno", "dos"],
  evidence: ["e1"],
};

describe("roastReportEmail", () => {
  it("lleva score, frase escapada, pilares, descargas y enlace para compartir", () => {
    const m = roastReportEmail({ lang: "es", brand: "Acme & Co", result, shareQuery: "brand=Acme&score=4.6&s=5&c=5&n=4&d=4&lang=es" });
    expect(m.subject).toContain("Acme & Co sacó 4.6/10");
    expect(m.html).toContain("Acme &amp; Co");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("format=square");
    expect(m.html).toContain("format=story");
    expect(m.html).toContain("/es/roast?brand=Acme");
    expect(m.text).toContain("Estrategia: 5/10");
  });
});

describe("welcomeEmail", () => {
  it("usa el idioma, lleva el enlace de baja y el bloque de promocion", () => {
    const m = welcomeEmail(WELCOME_DEFAULT, "en", "https://x/unsub?token=t");
    expect(m.subject).toBe(WELCOME_DEFAULT.subject_en);
    expect(m.html).toContain("https://x/unsub?token=t");
    expect(m.html).toContain(WELCOME_DEFAULT.promo_title_en);
    const off = welcomeEmail({ ...WELCOME_DEFAULT, promo_enabled: false }, "es");
    expect(off.html).not.toContain(WELCOME_DEFAULT.promo_title_es);
  });
});

describe("sanitizeWelcome", () => {
  it("recorta textos y bloquea enlaces que no sean https o rutas", () => {
    const s = sanitizeWelcome({ ...WELCOME_DEFAULT, subject_es: "x".repeat(500), promo_url: "javascript:alert(1)", items: [{ title_es: "t", url: "data:text/html,x" }] });
    expect(s?.subject_es).toHaveLength(150);
    expect(s?.promo_url).toBe("/");
    expect(s?.items[0].url).toBe("/");
    expect(sanitizeWelcome("nope")).toBeNull();
  });
});
