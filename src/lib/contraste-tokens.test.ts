import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Contraste del acento (decision de Victor, 5 nov 2026). Lee los tokens de
// globals.css y mide con la formula de WCAG 2.x, para que un cambio de color no
// rompa AA sin que nadie se entere.
// - --accent-ink (texto naranja, botones naranjas con letra blanca): >= 4.5:1.
// - --accent (decoraciones y texto grande >= 24 px): >= 3:1 sobre blanco y --bg.

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

describe("contraste de los tokens de acento", () => {
  const white = "#ffffff";
  const accent = token("accent");
  const ink = token("accent-ink");

  it("la formula coincide con valores conocidos", () => {
    expect(contrast("#000000", white)).toBeCloseTo(21, 5);
    expect(contrast("#ff4d00", white)).toBeCloseTo(3.33, 2);
  });

  it("--accent-ink pasa AA (4.5:1) sobre blanco, --surface, --bg y el crema --paper", () => {
    for (const bg of [white, token("surface"), token("bg"), token("paper")]) {
      expect(contrast(ink, bg), `${ink} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("--accent-ink con letra blanca encima pasa AA", () => {
    expect(contrast(white, ink)).toBeGreaterThanOrEqual(4.5);
  });

  it("--accent pasa 3:1 (texto grande y graficos) sobre blanco y --bg", () => {
    for (const bg of [white, token("surface"), token("bg")]) {
      expect(contrast(accent, bg), `${accent} sobre ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("--accent sigue pasando AA sobre zinc-900 (tarjetas oscuras)", () => {
    expect(contrast(accent, "#18181b")).toBeGreaterThanOrEqual(4.5);
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
