import { describe, expect, it } from "vitest";
import { digestEmail, digestUrl, type DigestPrompt } from "@/lib/email-templates/digest";

/* Resumen semanal con el diseno de marca (2026-10-16). Solo contenido publico: ninguna
 * seccion interna (busquedas de usuarios ni brecha del catalogo) llega a la lista. */

const prompts: DigestPrompt[] = [
  { id: "VD-0001", title_es: "Escribe un guion de 60 segundos", title_en: "Write a 60-Second Script", category: "video", tier: "free" },
  { id: "DG-0001", title_es: "Carrusel <b>de</b> Instagram", title_en: "Instagram Carousel", category: "graphic_design", tier: "pro" },
];
const unsub = "https://x/api/newsletter/unsubscribe?token=t&lang=es";

describe("digestEmail", () => {
  it("en espanol: titulos, categoria traducida, UTM por prompt, baja, privacidad y remitente", () => {
    const m = digestEmail({ lang: "es", prompts, unsubscribeUrl: unsub });
    expect(m.subject).toContain("ARTO Studio AI");
    expect(m.html).toContain('lang="es"');
    expect(m.html).toContain("Escribe un guion de 60 segundos");
    expect(m.html).toContain("Diseño Gráfico");
    expect(m.html).toContain("Carrusel &lt;b&gt;de&lt;/b&gt; Instagram");
    expect(m.html).toContain("/es/prompts/VD-0001?utm_source=email&amp;utm_medium=email&amp;utm_campaign=digest&amp;utm_content=VD-0001");
    expect(m.html).toContain("utm_content=biblioteca");
    expect(m.html).toContain("token=t&amp;lang=es");
    expect(m.html).toContain("/es/privacy");
    expect(m.html).toContain("ARTO Group");
    expect(m.text).toContain("Darme de baja: " + unsub);
    expect(m.text).toContain("Aviso de privacidad:");
    expect(m.text).toContain("ARTO Group");
    expect(m.text).toContain("/es/prompts/DG-0001?utm_source=email&utm_medium=email&utm_campaign=digest&utm_content=DG-0001");
    expect(m.html).toContain(">Gratis</span>");
    expect(m.html).toContain(">Pro</span>");
    expect(m.text).toContain("(VD-0001, Video, Gratis)");
    expect(m.text).toContain("martes");
  });

  it("no presenta la seleccion como editorial ni verificada", () => {
    for (const lang of ["es", "en"] as const) {
      const m = digestEmail({ lang, prompts, unsubscribeUrl: unsub });
      for (const s of [m.html, m.text]) {
        expect(s).not.toMatch(/estrategas|strategists|probado|tested|lunes|Monday/i);
      }
    }
    expect(digestEmail({ lang: "en", prompts, unsubscribeUrl: unsub }).text).toContain("Tuesday");
  });

  it("en ingles usa title_en y textos en ingles", () => {
    const m = digestEmail({ lang: "en", prompts, unsubscribeUrl: unsub });
    expect(m.html).toContain('lang="en"');
    expect(m.html).toContain("Write a 60-Second Script");
    expect(m.html).not.toContain("Escribe un guion");
    expect(m.html).toContain("Graphic Design");
    expect(m.html).toContain("/en/prompts/VD-0001?");
    expect(m.text).toContain("Unsubscribe: ");
  });

  it("no lleva secciones internas ni emojis", () => {
    for (const lang of ["es", "en"] as const) {
      const m = digestEmail({ lang, prompts, unsubscribeUrl: unsub });
      for (const s of [m.html, m.text, m.subject]) {
        expect(s).not.toMatch(/Gap/);
        expect(s).not.toMatch(/similarity/i);
        expect(s).not.toMatch(/Top searches/i);
        expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(s).not.toContain("—");
      }
    }
  });

  it("si falta el titulo en el idioma usa el otro", () => {
    const m = digestEmail({ lang: "es", prompts: [{ id: "X-1", title_es: "", title_en: "Only English", category: "otra_cosa", tier: "free" }], unsubscribeUrl: unsub });
    expect(m.html).toContain("Only English");
    expect(m.html).toContain("otra cosa");
  });

  it("digestUrl codifica el contenido", () => {
    expect(digestUrl("/prompts", "es", "a b")).toMatch(/\/es\/prompts\?utm_source=email&utm_medium=email&utm_campaign=digest&utm_content=a%20b$/);
  });
});
