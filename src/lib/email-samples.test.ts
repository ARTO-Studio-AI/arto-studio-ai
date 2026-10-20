import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email-config", async () => {
  const { WELCOME_DEFAULT } = await import("@/lib/email-templates/welcome");
  return { getWelcomeContent: async () => WELCOME_DEFAULT };
});

import { EMAIL_KINDS } from "@/lib/email-kinds";
import { sampleEmail } from "@/lib/email-samples";

/* Muestras de /admin/emails (2026-10-20): todas con la plantilla real, sin variables de
 * Supabase sin llenar y con el banner de marca. */
describe("sampleEmail", () => {
  for (const k of EMAIL_KINDS) {
    for (const lang of ["es", "en"] as const) {
      it(`${k.id} ${lang}`, async () => {
        const m = await sampleEmail(k.id, lang, "admin@ejemplo.com");
        expect(m.subject.length).toBeGreaterThan(0);
        expect(m.html.startsWith("<!doctype html>")).toBe(true);
        expect(m.html.trim().endsWith("</html>")).toBe(true);
        expect(m.html).not.toMatch(/\{\{|\}\}/);
        expect(m.html).toContain(`/email/header-${lang}.png`);
        if (k.id.startsWith("auth_")) expect(m.html).toContain("admin@ejemplo.com");
      });
    }
  }
});
