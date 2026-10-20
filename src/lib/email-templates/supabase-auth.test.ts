import { describe, expect, it } from "vitest";
import { supabaseAuthTemplate } from "@/lib/email-templates/supabase-auth";

/* Plantillas de acceso de Supabase con el diseno de marca (2026-10-20). */
describe("supabaseAuthTemplate", () => {
  for (const kind of ["magic_link", "confirmation"] as const) {
    it(`${kind}: rama ES/EN, variables de Supabase intactas y banner`, () => {
      const { subject, html } = supabaseAuthTemplate(kind);
      expect(subject).toContain("·");
      expect(html.startsWith('{{ if and .Data.signup_locale (eq .Data.signup_locale "es") }}')).toBe(true);
      expect(html).toContain("{{ else }}");
      expect(html.endsWith("{{ end }}")).toBe(true);
      expect(html.match(/\{\{ \.ConfirmationURL \}\}/g)?.length).toBe(6);
      expect(html.match(/\{\{ \.Email \}\}/g)?.length).toBe(2);
      expect(html).toContain("/email/header-es.png");
      expect(html).toContain("/email/header-en.png");
      expect(html).not.toContain("—");
    });
  }
});
