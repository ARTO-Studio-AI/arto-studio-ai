import { afterEach, describe, expect, it, vi } from "vitest";
import { EDIT_BUNDLE_FREE_UNTIL, downloadAccess } from "@/lib/edit-bundle/access";
import { accessFor, priceLabelFor, promoFor } from "./access";
import realCatalog from "./skills.json";
import * as real from "./skills";
import { ALL_MODS, MODS, parseMods } from "@/lib/mods";

/* Manifiesto del catalogo (2026-11-05): lo que el sitio lee de skills.json y mods.json.
 * Los estados se prueban con un manifiesto falso (vi.doMock del JSON). */

/* Los dos lados del corte salen de la constante: si se amplia otra vez la promo, estas pruebas no se rompen. */
const AFTER = new Date(EDIT_BUNDLE_FREE_UNTIL);
const BEFORE = new Date(AFTER.getTime() - 1000);

const EB_SLUGS = [
  "arto-edit-cortes",
  "arto-edit-subtitulos",
  "arto-edit-letras-detras",
  "arto-edit-recuadros",
  "arto-edit-titulares",
  "arto-edit-color",
  "arto-edit-zooms",
  "arto-edit-sonido",
  "arto-edit-director",
];

describe("catalogo real", () => {
  it("el bundle sigue igual: 9 skills publicados en su orden, su categoria primero, el bundle publicado", () => {
    expect(real.PUBLIC_SKILLS.filter((s) => s.category === "edicion-de-video").map((s) => s.slug)).toEqual(EB_SLUGS);
    expect(real.ALL_SKILLS.filter((s) => s.slug !== "arto-anima").every((s) => s.status === "published")).toBe(true);
    expect(real.publicCategories().map((c) => c.category.slug)).toEqual(["edicion-de-video", "estrategia-y-negocio"]);
    expect(real.getCategory("edicion-de-video")?.access).toBe("edit-bundle-1");
    expect(real.getDownloadItem("arto-edit-bundle-1")).toEqual({
      slug: "arto-edit-bundle-1",
      file: "arto-edit-bundle-1.zip",
      downloadName: "arto-edit-bundle-1 - V1.0.zip",
      pagePath: "/edit-bundle-1",
      access: "edit-bundle-1",
    });
  });

  it("cada skill del bundle tiene paquete y demo en assets.json", () => {
    for (const slug of [...EB_SLUGS, "arto-edit-bundle-1"]) expect(real.packageAvailable(slug), slug).toBe(true);
    for (const slug of EB_SLUGS) expect(real.demoOf(slug).video).toBe(`/skills/demos/${slug}.mp4`);
  });

  // Victor dio el cierre el 2026-11-05 («Publicar los dos») y eligio la regla «Solo Pro».
  it("los dos skills de Estrategia y negocio estan publicados con la regla pro", () => {
    expect(real.getCategory("estrategia-y-negocio")?.access).toBe("pro");
    for (const slug of ["arto-arranque-negocio-local", "arto-cotizacion-creativa"]) {
      expect(real.getSkill(slug)?.status, slug).toBe("published");
      expect(real.packageAvailable(slug), slug).toBe(true);
      expect(real.getDownloadItem(slug)?.access, slug).toBe("pro");
    }
  });

  // Pedido de la Bitacora del 6 nov: ARTO Anima sube oculto, en su categoria con la regla cuenta.
  it("ARTO Anima entra oculto, con paquete y demo, en Graficos animados con la regla cuenta", () => {
    const anima = real.ALL_SKILLS.find((s) => s.slug === "arto-anima");
    expect(anima?.status).toBe("hidden");
    expect(anima?.category).toBe("graficos-animados");
    expect(real.getCategory("graficos-animados")?.access).toBe("cuenta");
    expect(real.getSkill("arto-anima")).toBeNull();
    expect(real.getDownloadItem("arto-anima")).toBeNull();
    expect(real.packageAvailable("arto-anima")).toBe(true);
    expect(real.demoOf("arto-anima").video).toBe("/skills/demos/arto-anima.mp4");
  });
});

describe("parseCatalog", () => {
  const base = () => structuredClone(realCatalog) as { categories: unknown[]; bundles: unknown[]; skills: { slug: string; status: string; ficha: Record<string, unknown> }[] };

  it("truena con estado invalido, categoria inexistente o slug repetido", () => {
    const a = base();
    a.skills[0].status = "publicado";
    expect(() => real.parseCatalog(a)).toThrow(/estado invalido/);
    const b = base();
    b.skills[0].ficha.category = "no-existe";
    expect(() => real.parseCatalog(b)).toThrow(/categoria que no existe/);
    const c = base();
    c.skills.push(structuredClone(c.skills[0]));
    expect(() => real.parseCatalog(c)).toThrow(/repetidos/);
    const d = base();
    (d.categories[0] as { access: string }).access = "gratis";
    expect(() => real.parseCatalog(d)).toThrow(/access/);
  });
});

describe("estados", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/catalogo/skills.json");
    vi.resetModules();
  });

  async function withCatalog() {
    const cat = structuredClone(realCatalog) as unknown as { categories: Record<string, unknown>[]; skills: Record<string, unknown>[] };
    cat.categories.push({
      slug: "estrategia",
      order: 99,
      access: "pro",
      bundle: null,
      kicker: { es: "Marca", en: "Brand" },
      name: { es: "Estrategia", en: "Strategy" },
      body: { es: "Skills de marca.", en: "Brand skills." },
    });
    const mk = (slug: string, status: string, order: number) => ({
      slug,
      status,
      ficha: { ...structuredClone(realCatalog.skills[0].ficha), slug, order, category: "estrategia" },
    });
    cat.skills.push(mk("arto-oculto", "hidden", 1), mk("arto-pronto", "coming_soon", 2), mk("arto-pro", "published", 3));
    vi.resetModules();
    vi.doMock("@/lib/catalogo/skills.json", () => ({ default: cat }));
    return import("./skills");
  }

  it("hidden: no sale, no tiene pagina ni descarga", async () => {
    const m = await withCatalog();
    expect(m.getSkill("arto-oculto")).toBeNull();
    expect(m.getDownloadItem("arto-oculto")).toBeNull();
    expect(m.PUBLIC_SKILLS.some((s) => s.slug === "arto-oculto")).toBe(false);
    expect(m.ALL_SKILLS.some((s) => s.slug === "arto-oculto")).toBe(true);
  });

  it("coming_soon: sale y tiene pagina, pero no se descarga", async () => {
    const m = await withCatalog();
    expect(m.getSkill("arto-pronto")?.status).toBe("coming_soon");
    expect(m.getDownloadItem("arto-pronto")).toBeNull();
  });

  it("published en una categoria nueva: se descarga con la regla pro", async () => {
    const m = await withCatalog();
    expect(m.getDownloadItem("arto-pro")).toMatchObject({ file: "arto-pro.skill", access: "pro", pagePath: "/skills/arto-pro" });
    const cats = m.publicCategories();
    expect(cats.map((c) => c.category.slug)).toEqual(["edicion-de-video", "estrategia-y-negocio", "estrategia"]);
    expect(cats[2].skills.map((s) => s.slug)).toEqual(["arto-pronto", "arto-pro"]);
  });
});

describe("reglas de descarga", () => {
  const anon = { signedIn: false } as const;
  const free = { signedIn: true, userId: "u", tier: "free" } as const;
  const pro = { signedIn: true, userId: "u", tier: "pro" } as const;
  const ent = { signedIn: true, userId: "u", tier: "enterprise" } as const;

  it("edit-bundle-1 es exactamente la regla de access.ts, antes y despues del corte", () => {
    for (const now of [BEFORE, AFTER]) {
      for (const v of [anon, free, pro, ent]) expect(accessFor("edit-bundle-1", v, now)).toBe(downloadAccess(v, now));
    }
    expect(priceLabelFor("edit-bundle-1", BEFORE)).toBe("free");
    expect(priceLabelFor("edit-bundle-1", AFTER)).toBe("pro");
    expect(promoFor("edit-bundle-1", BEFORE)).toBe(true);
  });

  it("pro: nunca gratis, ni siquiera en la promocion del bundle", () => {
    expect(accessFor("pro", anon, BEFORE)).toBe("signin");
    expect(accessFor("pro", free, BEFORE)).toBe("upgrade");
    expect(accessFor("pro", pro, BEFORE)).toBe("download");
    expect(accessFor("pro", ent, AFTER)).toBe("download");
    expect(priceLabelFor("pro", BEFORE)).toBe("pro");
    expect(promoFor("pro", BEFORE)).toBe(false);
  });

  it("cuenta: cualquier cuenta con sesion descarga siempre; sin sesion pide entrar", () => {
    const far = new Date("2030-01-01T00:00:00Z");
    for (const now of [BEFORE, AFTER, far]) {
      expect(accessFor("cuenta", anon, now)).toBe("signin");
      for (const v of [free, pro, ent]) expect(accessFor("cuenta", v, now)).toBe("download");
      expect(accessFor("cuenta", { signedIn: true, userId: "u", tier: "" }, now)).toBe("download");
      expect(priceLabelFor("cuenta", now)).toBe("account");
      expect(promoFor("cuenta", now)).toBe(false);
    }
  });
});

describe("mods", () => {
  it("MOD01 sigue saliendo como proximo el 9 nov", () => {
    expect(MODS.map((m) => [m.code, m.status, m.releaseDate])).toEqual([["MOD01", "coming_soon", "2026-11-09"]]);
  });

  it("hidden no sale en /mods y los repetidos truenan", () => {
    const m = structuredClone(ALL_MODS[0]);
    expect(parseMods({ mods: [{ ...m, status: "hidden" }] })[0].status).toBe("hidden");
    expect(() => parseMods({ mods: [m, { ...m, slug: "otro" }] })).toThrow(/codigos repetidos/);
    expect(() => parseMods({ mods: [{ ...m, status: "upcoming" }] })).toThrow(/status/);
  });
});
