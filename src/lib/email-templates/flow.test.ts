import { describe, expect, it, beforeAll } from "vitest";
import { signReportToken, verifyReportToken } from "@/lib/roast-share";
import { listConfirmationEmail } from "@/lib/email-templates/confirm";

/* Token del reporte y doble opt-in (auditoria de Fable, PR #76). */

describe("report token", () => {
  beforeAll(() => {
    process.env.ARTO_API_KEY_SALT = "test-salt";
  });
  it("firma y verifica el id de la traza", () => {
    const t = signReportToken(1234)!;
    expect(verifyReportToken(t)).toBe(1234);
  });
  it("rechaza ids cambiados, firmas falsas y basura", () => {
    const t = signReportToken(1234)!;
    const forged = `1235.${t.split(".")[1]}`;
    expect(verifyReportToken(forged)).toBeNull();
    expect(verifyReportToken("1234.xxxxxxxxxxxxxxxxxxxxxx")).toBeNull();
    expect(verifyReportToken("1234")).toBeNull();
    expect(verifyReportToken(1234)).toBeNull();
    expect(signReportToken(0)).toBeNull();
  });
});

describe("listConfirmationEmail", () => {
  it("lleva el enlace de confirmacion y aclara que sin confirmar no se inscribe", () => {
    const m = listConfirmationEmail("es", "https://x/api/newsletter/confirm?token=t&lang=es");
    expect(m.html).toContain("https://x/api/newsletter/confirm?token=t&amp;lang=es");
    expect(m.text).toContain("no te vamos a inscribir");
  });
});
