import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Contraste de los tokens (marca ASAI v2.0, 11 nov 2026). Lee los tokens de globals.css y
// mide con la formula de WCAG 2.x, para que un cambio de color no rompa AA sin que nadie se
// entere. La revision por pagina (texto real contra fondo real) vive en scripts/contraste.mjs.

const CSS = readFileSync(join(__dirname, "../app/globals.css"), "utf8");

function token(name: string): string {
  const m = CSS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!m) throw new Error(`No encontre --${name} en globals.css`);
  return m[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Marca ASAI v2.0 (decision de Victor, 11 nov 2026). Reglas del manual que no se negocian.
describe("contraste de la marca ASAI v2.0", () => {
  const white = "#ffffff";
  const black = "#000000";
  const lime = token("bg");
  const blue = token("accent");
  const pink = token("pink");

  it("la formula coincide con valores conocidos", () => {
    expect(contrast(black, white)).toBeCloseTo(21, 5);
    expect(contrast("#1e00ff", white)).toBeCloseTo(8.4, 1);
  });

  it("los tokens son los de tokens.json (grupo ASAI)", () => {
    expect(lime).toBe("#daf700");
    expect(blue).toBe("#1e00ff");
    expect(pink).toBe("#ff3fa4");
    expect(token("ink")).toBe("#000000");
    expect(token("ink-2")).toBe("#3d4500");
    expect(token("ink-3")).toBe("#5a6600");
  });

  it("sobre lima: negro, oliva, oliva 2 y azul pasan AA", () => {
    for (const fg of [black, token("ink-2"), token("ink-3"), token("accent-ink")]) {
      expect(contrast(fg, lime), `${fg} sobre lima`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("sobre lima: la letra blanca y la rosa NO pasan (por eso estan prohibidas)", () => {
    expect(contrast(white, lime)).toBeLessThan(3);
    expect(contrast(pink, lime)).toBeLessThan(3);
  });

  it("sobre blanco: negro, oliva y azul pasan AA", () => {
    for (const fg of [black, token("ink-2"), token("ink-3"), token("accent-ink")]) {
      expect(contrast(fg, white), `${fg} sobre blanco`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("sobre azul: solo letra blanca pasa AA; lima y negro no", () => {
    expect(contrast(white, blue)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(white, token("accent-hover"))).toBeGreaterThanOrEqual(4.5);
  });

  it("sobre negro: blanco y lima pasan AA; azul no (2.5:1)", () => {
    expect(contrast(white, token("dark"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lime, token("dark"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(blue, token("dark"))).toBeLessThan(3);
  });

  it("marcatexto rosa: letra negra encima pasa AA", () => {
    expect(contrast(black, pink)).toBeGreaterThanOrEqual(4.5);
  });

  it("botones lima: letra negra pasa AA en reposo y en hover", () => {
    expect(contrast(black, token("lime-hover"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("no quedan colores de la marca vieja en los componentes base (fase 1)", () => {
  const base = [
    "../components/ui/Button.tsx",
    "../components/ui/Card.tsx",
    "../components/ui/Badge.tsx",
    "../components/Nav.tsx",
    "../components/Footer.tsx",
    "../components/SignupBarClient.tsx",
    "../components/ProUnlockBanner.tsx",
    "../components/PromptQuota.tsx",
    "../components/DifficultyChip.tsx",
    "../components/promo/PromoViews.tsx",
  ];
  it("sin naranja, indigo ni verde agua", () => {
    for (const f of base) {
      const src = readFileSync(join(__dirname, f), "utf8");
      expect(src, f).not.toMatch(/#ff4d00|#c93800|#121936|#42d7b9|--indigo|--aqua|--paper|--sand/i);
    }
  });
  it("sin letra blanca sobre lima en una misma clase", () => {
    for (const f of base) {
      const src = readFileSync(join(__dirname, f), "utf8");
      expect(src, f).not.toMatch(/bg-\[var\(--(lime|bg)\)\][^"`]*text-white|text-white[^"`]*bg-\[var\(--(lime|bg)\)\]/);
    }
  });
});

// Fase 3: en todo src/ ya no queda la marca vieja. Desde el 13 nov tambien los correos
// (src/lib/email-templates/) y el banner nuevo (header-v2-*.png).
describe("no quedan colores de la marca vieja en src (fase 3)", () => {
  it("sin #ff4d00, #c93800, #121936, #42d7b9 ni tokens viejos", () => {
    const root = join(__dirname, "..");
    const files: string[] = [];
    const visit = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          visit(p);
        } else if (/\.(tsx?|css)$/.test(p) && !p.endsWith("contraste-tokens.test.ts")) files.push(p);
      }
    };
    visit(root);
    const bad = files.filter((f) =>
      /#ff4d00|#c93800|#121936|#42d7b9|var\(--(indigo|aqua|paper|sand|accent-soft)\b/i.test(readFileSync(f, "utf8")),
    );
    expect(bad).toEqual([]);
  });

  it("los correos usan el banner v2 y nunca letra blanca sobre lima", () => {
    const dir = join(__dirname, "email-templates");
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.includes(".test."))) {
      const src = readFileSync(join(dir, name), "utf8");
      expect(src, name).not.toMatch(/"\/email\/header-(es|en)\.png"|\/email\/header-\$\{opts\.lang\}\.png/);
      expect(src, name).not.toMatch(/background:\$\{C\.(lime|paper)\};color:\$\{C\.white\}/);
    }
  });

  it("el boton lima de los correos lleva letra negra y el azul nunca va sobre negro", async () => {
    const { button, C } = await import("./email-templates/layout");
    const html = button("Ir", "https://x", "accent");
    expect(html).toContain(`background:${C.lime}`);
    expect(html).toContain(`color:${C.ink}`);
    expect(button("Ir", "https://x", "dark")).toContain(`color:${C.white}`);
  });
});

// Guarda: las etiquetas (text-eyebrow, 11.5 px) no pueden ir en --accent sobre
// fondo claro. Si una etiqueta va sobre fondo oscuro, que use una condicion
// explicita como en ProductCard de (marketing)/page.tsx.
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("uso del acento en texto chico", () => {
  it('ningun "text-eyebrow text-[var(--accent)]" literal en src', () => {
    const offenders = walk(join(__dirname, ".."))
      .filter((f) => /text-eyebrow text-\[var\(--accent\)\]/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
