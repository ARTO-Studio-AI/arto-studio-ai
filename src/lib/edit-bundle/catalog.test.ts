import { describe, expect, it } from "vitest";
import { EDIT_BUNDLE_SLUG, EDIT_SKILLS, EDIT_SKILL_SLUGS, getDownloadItem, getEditSkill, parseFicha } from "./catalog";

const FORBIDDEN = [
  "leverage", "empower", "revolutionize", "seamless", "robust", "holistic", "cutting-edge",
  "next-generation", "ecosystem", "disruptive", "synergy", "scalable", "optimize", "elevate",
  "delve", "foster", "paradigm shift", "game-changer", "actionable insights",
];

describe("catalogo del ARTO Edit Bundle #1", () => {
  it("trae los 9 skills en el orden de Victor", () => {
    expect(EDIT_SKILLS.map((s) => s.slug)).toEqual([...EDIT_SKILL_SLUGS]);
    expect(EDIT_SKILLS.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(EDIT_SKILLS.every((s) => s.category === "edicion-de-video")).toBe(true);
  });

  it("los textos no llevan em dashes ni palabras prohibidas", () => {
    const text = JSON.stringify(EDIT_SKILLS).toLowerCase();
    expect(text).not.toContain("\u2014");
    for (const w of FORBIDDEN) expect(text, w).not.toContain(w);
  });

  it("una ficha rota truena con el campo que falla", () => {
    expect(() => parseFicha("arto-edit-color", { slug: "arto-edit-color" })).toThrow(/order/);
    expect(() => parseFicha("arto-edit-color", { slug: "otro" })).toThrow(/slug/);
  });

  it("getEditSkill solo acepta slugs del catalogo", () => {
    expect(getEditSkill("arto-edit-zooms")?.name.es).toBe("Zooms");
    expect(getEditSkill("nada")).toBeNull();
    expect(getEditSkill("../../.env")).toBeNull();
  });
});

describe("getDownloadItem", () => {
  it("el archivo sale del catalogo, nunca de la peticion", () => {
    expect(getDownloadItem("arto-edit-subtitulos")).toEqual({
      slug: "arto-edit-subtitulos",
      file: "arto-edit-subtitulos.skill",
      downloadName: "arto-edit-subtitulos - SKILL - V1.0.skill",
      pagePath: "/skills/arto-edit-subtitulos",
    });
    expect(getDownloadItem(EDIT_BUNDLE_SLUG)?.file).toBe("arto-edit-bundle-1.zip");
    expect(getDownloadItem(EDIT_BUNDLE_SLUG)?.pagePath).toBe("/edit-bundle-1");
  });

  it("rechaza slugs desconocidos y rutas", () => {
    for (const s of ["", "x", "..", "../private/skills/arto-edit-color.skill", "arto-edit-color.skill", "ARTO-EDIT-COLOR"]) {
      expect(getDownloadItem(s), s).toBeNull();
    }
  });
});
