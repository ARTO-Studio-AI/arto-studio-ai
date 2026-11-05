import { describe, expect, it } from "vitest";
import realCatalog from "./skills.json";
import { buildCatalog, MANIFEST_ONLY, type CatalogState, type OverrideRow, type UploadedRow } from "./estado";
import * as repo from "./skills";
import { ALL_MODS } from "@/lib/mods";

/* Estado efectivo (2026-11-05): manifiesto del repo + catalog_overrides + catalog_items. */

const H = "a".repeat(64);
const at = "2026-11-05T12:00:00Z";
const ov = (kind: OverrideRow["kind"], slug: string, status: string): OverrideRow => ({ kind, slug, status, updated_by: "victor@arto", updated_at: at });

function fichaFor(slug: string, category = "estrategia-y-negocio", over: Record<string, unknown> = {}) {
  return { ...structuredClone(realCatalog.skills[0].ficha), slug, order: 50, category, ...over };
}
const uploaded = (slug: string, ficha: unknown = fichaFor(slug)): UploadedRow => ({
  kind: "skill",
  slug,
  ficha,
  storage_path: `skills/${slug}/${H}.skill`,
  bytes: 1234,
  sha256: H,
  uploaded_by: "victor@arto",
  updated_at: at,
});
const state = (overrides: OverrideRow[] = [], items: UploadedRow[] = []): CatalogState => ({ overrides, items, ok: true });

describe("sin nada en la base", () => {
  it("es exactamente el manifiesto del repo", () => {
    const c = buildCatalog(MANIFEST_ONLY);
    expect(c.skills.map((s) => [s.slug, s.status])).toEqual(repo.ALL_SKILLS.map((s) => [s.slug, s.status]));
    expect(c.publicCategories().map((x) => x.category.slug)).toEqual(repo.publicCategories().map((x) => x.category.slug));
    for (const s of [...repo.ALL_SKILLS.map((x) => x.slug), "arto-edit-bundle-1", "nada"]) {
      expect(c.getDownloadItem(s), s).toEqual(repo.getDownloadItem(s));
      expect(c.packageAvailable(s), s).toBe(repo.packageAvailable(s));
      expect(c.accessOf(s), s).toBe(repo.accessOf(s));
    }
    expect(c.publicMods().map((m) => m.slug)).toEqual(ALL_MODS.filter((m) => m.status !== "hidden").map((m) => m.slug));
    expect(c.issues).toEqual([]);
  });
});

describe("activar y desactivar (catalog_overrides)", () => {
  it("oculto: un skill publicado del repo deja de salir y no se descarga", () => {
    const c = buildCatalog(state([ov("skill", "arto-edit-color", "hidden")]));
    expect(c.getSkill("arto-edit-color")).toBeNull();
    expect(c.getDownloadItem("arto-edit-color")).toBeNull();
    expect(c.publicCategories()[0].skills.some((s) => s.slug === "arto-edit-color")).toBe(false);
    const s = c.find("skill", "arto-edit-color")!;
    expect(s).toMatchObject({ status: "hidden", source: "repo", repoStatus: "published" });
  });

  it("muy pronto: tiene pagina pero no se descarga", () => {
    const c = buildCatalog(state([ov("skill", "arto-cotizacion-creativa", "coming_soon")]));
    expect(c.getSkill("arto-cotizacion-creativa")?.status).toBe("coming_soon");
    expect(c.getDownloadItem("arto-cotizacion-creativa")).toBeNull();
  });

  it("el bundle y los mods tambien se desactivan", () => {
    const c = buildCatalog(state([ov("bundle", "arto-edit-bundle-1", "hidden"), ov("mod", "auto-handoff", "hidden")]));
    expect(c.getBundle("arto-edit-bundle-1")).toBeNull();
    expect(c.getDownloadItem("arto-edit-bundle-1")).toBeNull();
    expect(c.publicMods().some((m) => m.slug === "auto-handoff")).toBe(false);
  });

  it("no cambia la regla de descarga: la sigue dando la categoria", () => {
    const c = buildCatalog(state([ov("skill", "arto-edit-zooms", "published")]));
    expect(c.getDownloadItem("arto-edit-zooms")?.access).toBe("edit-bundle-1");
    expect(c.getDownloadItem("arto-arranque-negocio-local")?.access).toBe("pro");
  });

  it("ignora overrides de slugs que no existen o con estado invalido", () => {
    const c = buildCatalog(state([ov("skill", "no-existe", "hidden"), ov("skill", "arto-edit-cortes", "borrado")]));
    expect(c.getSkill("arto-edit-cortes")?.status).toBe("published");
    expect(c.find("skill", "no-existe")).toBeNull();
  });
});

describe("subidos por admin (catalog_items)", () => {
  it("entran ocultos: sin override no salen ni se descargan", () => {
    const c = buildCatalog(state([], [uploaded("arto-nuevo")]));
    expect(c.find("skill", "arto-nuevo")).toMatchObject({ status: "hidden", source: "admin", uploadedBy: "victor@arto" });
    expect(c.getSkill("arto-nuevo")).toBeNull();
    expect(c.getDownloadItem("arto-nuevo")).toBeNull();
  });

  it("publicado: sale en su categoria y se descarga de Storage con la regla de la categoria", () => {
    const c = buildCatalog(state([ov("skill", "arto-nuevo", "published")], [uploaded("arto-nuevo")]));
    expect(c.publicCategories().find((x) => x.category.slug === "estrategia-y-negocio")!.skills.map((s) => s.slug)).toContain("arto-nuevo");
    expect(c.getDownloadItem("arto-nuevo")).toEqual({
      slug: "arto-nuevo",
      file: "arto-nuevo.skill",
      downloadName: "arto-nuevo - SKILL - V1.0.skill",
      pagePath: "/skills/arto-nuevo",
      access: "pro",
      storagePath: `skills/arto-nuevo/${H}.skill`,
    });
    expect(c.packageAvailable("arto-nuevo")).toBe(true);
  });

  it("en la categoria del bundle usa la regla del bundle (no la cambia)", () => {
    const c = buildCatalog(state([ov("skill", "arto-edit-extra", "published")], [uploaded("arto-edit-extra", fichaFor("arto-edit-extra", "edicion-de-video"))]));
    expect(c.getDownloadItem("arto-edit-extra")?.access).toBe("edit-bundle-1");
  });

  it("si el slug existe en el repo gana el del repo y se avisa", () => {
    const c = buildCatalog(state([], [uploaded("arto-edit-color", fichaFor("arto-edit-color", "estrategia-y-negocio", { name: { es: "Otro", en: "Other" } }))]));
    const s = c.find("skill", "arto-edit-color")!;
    expect(s).toMatchObject({ source: "repo", category: "edicion-de-video" });
    expect(c.skills.filter((x) => x.slug === "arto-edit-color")).toHaveLength(1);
    expect(c.issues).toEqual([expect.objectContaining({ kind: "skill", slug: "arto-edit-color" })]);
  });

  it("una fila rota o en una categoria que no existe se ignora y se avisa, sin tumbar el catalogo", () => {
    const c = buildCatalog(
      state([ov("skill", "arto-roto", "published")], [uploaded("arto-roto", { slug: "arto-roto" }), uploaded("arto-sin-cat", fichaFor("arto-sin-cat", "inventada"))]),
    );
    expect(c.find("skill", "arto-roto")).toBeNull();
    expect(c.find("skill", "arto-sin-cat")).toBeNull();
    expect(c.issues.map((i) => i.slug).sort()).toEqual(["arto-roto", "arto-sin-cat"]);
    expect(c.skills.length).toBe(repo.ALL_SKILLS.length);
  });

  it("mods: se suman, entran ocultos y el repo gana por slug o codigo", () => {
    const base = structuredClone(ALL_MODS[0]) as unknown as Record<string, unknown>;
    delete base.status;
    const mod = (slug: string, code: string): UploadedRow => ({ kind: "mod", slug, ficha: { ...base, slug, code }, storage_path: null, bytes: null, sha256: null, uploaded_by: "v", updated_at: at });
    const c = buildCatalog(state([ov("mod", "mod-nuevo", "coming_soon")], [mod("mod-nuevo", "MOD02"), mod("mod-oculto", "MOD03"), mod("otro-slug", "MOD01")]));
    expect(c.publicMods().map((m) => m.slug)).toEqual(["auto-handoff", "mod-nuevo"]);
    expect(c.find("mod", "mod-oculto")?.status).toBe("hidden");
    expect(c.find("mod", "otro-slug")).toBeNull();
    expect(c.issues).toEqual([expect.objectContaining({ kind: "mod", slug: "otro-slug" })]);
  });
});
