import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";
import {
  TUTORIAL_PROMPTS,
  TUTORIAL_TOOLS,
  filterTutorials,
  getAllTutorials,
  getTutorial,
  hasProPrompt,
  isTutorialTool,
  toolsInUse,
  tutorialPromptIds,
  videoEmbedUrl,
} from "@/lib/tutorials";

/* Libreria de tutoriales (2026-11-05). Cuida que cada tutorial este completo en los dos
 * idiomas, que solo cite prompts verificados y que el copy respete las reglas de escritura. */

const BANNED = [
  "—",
  "leverage", "empower", "revolutionize", "seamless", "robust", "holistic", "cutting-edge",
  "ecosystem", "disruptive", "synergy", "scalable", "optimize", "elevate", "delve", "foster",
  "robusto", "holístico", "ecosistema", "escalable", "optimizar", "elevar", "sinergia", "disruptivo",
];

describe("tutoriales", () => {
  const all = getAllTutorials();

  it("hay al menos tres tutoriales con slug y code unicos", () => {
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(new Set(all.map((t) => t.slug)).size).toBe(all.length);
    expect(new Set(all.map((t) => t.code)).size).toBe(all.length);
    for (const t of all) expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("cada tutorial tiene copy completo en ES y EN, con los mismos pasos", () => {
    for (const t of all) {
      for (const l of LOCALES) {
        const c = t.copy[l];
        expect(c.title.length, `${t.slug} ${l} title`).toBeGreaterThan(10);
        expect(c.summary.length).toBeGreaterThan(40);
        expect(c.audience.length).toBeGreaterThan(40);
        expect(c.outcome.length).toBeGreaterThanOrEqual(3);
        expect(c.closing.length).toBeGreaterThan(20);
        for (const step of t.steps) {
          expect(step.copy[l].title.length).toBeGreaterThan(5);
          expect(step.copy[l].body.length).toBeGreaterThan(20);
        }
      }
      for (const step of t.steps) {
        expect(step.copy.es.data?.length ?? 0).toBe(step.copy.en.data?.length ?? 0);
        expect(!!step.copy.es.expect).toBe(!!step.copy.en.expect);
        expect(!!step.copy.es.tip).toBe(!!step.copy.en.tip);
        if (step.promptId) {
          expect(step.copy.es.data?.length ?? 0, `${t.slug} ${step.promptId} sin datos`).toBeGreaterThan(0);
          expect(step.copy.es.expect, `${t.slug} ${step.promptId} sin expect`).toBeTruthy();
        }
      }
    }
  });

  it("solo cita prompts registrados, con ID valido", () => {
    for (const t of all) {
      const ids = tutorialPromptIds(t);
      expect(ids.length).toBeGreaterThanOrEqual(3);
      for (const id of ids) {
        expect(id).toMatch(/^[A-Z]{2}-\d{4}$/);
        expect(TUTORIAL_PROMPTS[id], `${id} no esta en TUTORIAL_PROMPTS`).toBeDefined();
      }
    }
  });

  it("las herramientas existen y el filtro las respeta", () => {
    for (const t of all) for (const tool of t.tools) expect(isTutorialTool(tool)).toBe(true);
    expect(filterTutorials(all, "notion").every((t) => t.tools.includes("notion"))).toBe(true);
    expect(filterTutorials(all, "midjourney").length).toBeGreaterThan(0);
    expect(filterTutorials(all, "nada")).toEqual(all);
    expect(filterTutorials(all, undefined)).toEqual(all);
    expect(filterTutorials(all, "__proto__")).toEqual(all);
    expect(toolsInUse(all).every((tool) => tool in TUTORIAL_TOOLS)).toBe(true);
  });

  it("getTutorial y hasProPrompt", () => {
    expect(getTutorial(all[0].slug)?.code).toBe(all[0].code);
    expect(getTutorial("no-existe")).toBeNull();
    const t02 = all.find((t) => t.code === "T02");
    expect(t02 && hasProPrompt(t02)).toBe(true);
  });

  it("el copy no lleva em dashes ni palabras prohibidas", () => {
    const text = JSON.stringify({ all, TUTORIAL_PROMPTS }).toLowerCase();
    for (const word of BANNED) expect(text.includes(word), `aparece «${word}»`).toBe(false);
  });
});

describe("videoEmbedUrl", () => {
  it("convierte YouTube y Vimeo a su URL embebible", () => {
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    expect(videoEmbedUrl("https://player.vimeo.com/video/123456789")).toBe("https://player.vimeo.com/video/123456789");
  });

  it("rechaza lo que no reconoce", () => {
    expect(videoEmbedUrl(undefined)).toBeNull();
    expect(videoEmbedUrl("")).toBeNull();
    expect(videoEmbedUrl("no es url")).toBeNull();
    expect(videoEmbedUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbedUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=corto")).toBeNull();
    expect(videoEmbedUrl("javascript:alert(1)")).toBeNull();
  });
});
