import { describe, expect, it } from "vitest";
import { selectDigestPrompts, type DigestCandidate } from "@/lib/digest-selection";

/* Seleccion del resumen semanal (2026-10-16): primero lo nuevo, luego al azar por
 * verticales distintas, nunca repetido. */

const c = (id: string, category: string, created_at: string | null = "2026-01-01T00:00:00Z", tier = "free"): DigestCandidate => ({ id, category, tier, created_at });

// Generador fijo para que el sorteo sea reproducible.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("selectDigestPrompts", () => {
  it("los recientes van primero, del mas nuevo al mas viejo", () => {
    const recent = [c("A", "branding", "2026-10-14T00:00:00Z"), c("B", "video", "2026-10-16T00:00:00Z")];
    const pool = [...recent, c("C", "music"), c("D", "fashion"), c("E", "marketing"), c("F", "ux_ui")];
    const out = selectDigestPrompts({ recent, pool, random: seeded(1) });
    expect(out.slice(0, 2).map((p) => p.id)).toEqual(["B", "A"]);
    expect(out).toHaveLength(5);
  });

  it("si hay mas de 5 recientes solo van los 5 mas nuevos", () => {
    const recent = Array.from({ length: 7 }, (_, i) => c(`R${i}`, "branding", `2026-10-1${i}T00:00:00Z`));
    const out = selectDigestPrompts({ recent, pool: recent, random: seeded(2) });
    expect(out.map((p) => p.id)).toEqual(["R6", "R5", "R4", "R3", "R2"]);
  });

  it("completa al azar sin repetir vertical mientras se pueda", () => {
    const pool = [c("a1", "branding"), c("a2", "branding"), c("a3", "branding"), c("b1", "video"), c("c1", "music"), c("d1", "fashion"), c("e1", "ux_ui")];
    for (let seed = 1; seed < 30; seed++) {
      const out = selectDigestPrompts({ recent: [], pool, random: seeded(seed) });
      expect(new Set(out.map((p) => p.category)).size).toBe(5);
    }
  });

  it("si no alcanzan las verticales, repite vertical antes que quedarse corto", () => {
    const pool = [c("a1", "branding"), c("a2", "branding"), c("a3", "branding"), c("b1", "video")];
    const out = selectDigestPrompts({ recent: [], pool, random: seeded(3) });
    expect(out).toHaveLength(4);
    expect(new Set(out.map((p) => p.id)).size).toBe(4);
  });

  it("no duplica un reciente que tambien esta en el pool", () => {
    const recent = [c("A", "branding", "2026-10-15T00:00:00Z")];
    const pool = [recent[0], c("B", "video"), c("C", "music")];
    const out = selectDigestPrompts({ recent, pool, random: seeded(4) });
    expect(out.map((p) => p.id).filter((id) => id === "A")).toHaveLength(1);
  });

  it("el gancho de los mas usados entra despues de lo nuevo y antes del azar", () => {
    const recent = [c("N", "branding", "2026-10-15T00:00:00Z")];
    const mostUsed = [c("U", "video")];
    const pool = [c("X", "music"), c("Y", "fashion"), c("Z", "ux_ui"), c("W", "marketing")];
    const out = selectDigestPrompts({ recent, mostUsed, pool, random: seeded(5) });
    expect(out.slice(0, 2).map((p) => p.id)).toEqual(["N", "U"]);
  });

  it("con el mismo sorteo da lo mismo", () => {
    const pool = Array.from({ length: 40 }, (_, i) => c(`P${i}`, ["branding", "video", "music", "fashion", "ux_ui", "marketing"][i % 6]));
    const a = selectDigestPrompts({ recent: [], pool, random: seeded(9) });
    const b = selectDigestPrompts({ recent: [], pool, random: seeded(9) });
    expect(a).toEqual(b);
  });
});
