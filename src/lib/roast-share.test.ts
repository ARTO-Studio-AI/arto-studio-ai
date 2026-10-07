import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readShareParams, signShare, verifyShare } from "@/lib/roast-share";

/* Firma de enlaces compartidos del roast (H-60, 2026-10-07). */

const base = { brand: "Practica", score: "4.6", s: "5", c: "5", n: "4", d: "4", h: "Una frase del roast", lang: "es" };

describe("roast-share", () => {
  const prev = process.env.ARTO_API_KEY_SALT;
  beforeAll(() => {
    process.env.ARTO_API_KEY_SALT = "test-salt";
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.ARTO_API_KEY_SALT;
    else process.env.ARTO_API_KEY_SALT = prev;
  });

  it("firma y verifica", () => {
    const sig = signShare(base);
    expect(sig).toHaveLength(22);
    expect(verifyShare(base, sig)).toBe(true);
  });

  it("rechaza cualquier cambio en frase, marca o score", () => {
    const sig = signShare(base);
    expect(verifyShare({ ...base, h: "Frase ofensiva" }, sig)).toBe(false);
    expect(verifyShare({ ...base, brand: "Competidor" }, sig)).toBe(false);
    expect(verifyShare({ ...base, score: "9.9" }, sig)).toBe(false);
    expect(verifyShare(base, "x".repeat(22))).toBe(false);
    expect(verifyShare(base, undefined)).toBe(false);
  });

  it("readShareParams quita la frase sin firma valida y valida rangos", () => {
    const sig = signShare(base)!;
    const q = new URLSearchParams({ ...base, sig });
    expect(readShareParams((k) => q.get(k))?.h).toBe(base.h);
    q.set("sig", "mala");
    const forged = readShareParams((k) => q.get(k));
    expect(forged?.h).toBe("");
    expect(forged?.score).toBe("4.6");
    for (const bad of ["11", "0x9", "1e1", "9." + "9".repeat(50), "-1", "4.66"]) {
      q.set("score", bad);
      expect(readShareParams((k) => q.get(k)), bad).toBeNull();
    }
  });

  it("insertar | en la frase rompe la firma", () => {
    const sig = signShare(base);
    expect(verifyShare({ ...base, h: "Una fra|se del roast" }, sig)).toBe(false);
  });

  it("sin lang usa el idioma de la ruta", () => {
    const en = { ...base, lang: "en" };
    const sig = signShare(en)!;
    const q = new URLSearchParams({ ...en, sig });
    q.delete("lang");
    expect(readShareParams((k) => q.get(k), "en")?.h).toBe(base.h);
  });

  it("sin clave no firma", () => {
    const saved = process.env.ARTO_API_KEY_SALT;
    delete process.env.ARTO_API_KEY_SALT;
    expect(signShare(base)).toBeNull();
    process.env.ARTO_API_KEY_SALT = saved;
  });
});
