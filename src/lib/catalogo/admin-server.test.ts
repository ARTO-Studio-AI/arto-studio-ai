import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type FakeSupabase } from "../../../tests/helpers/fake-supabase";
import { skillPackage } from "../../../tests/helpers/zip";
import realCatalog from "./skills.json";
import { ALL_MODS } from "@/lib/mods";

/* Escrituras de /admin/skills (2026-11-05): estado, subida y registro, con Supabase falso. */

let fake: FakeSupabase;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const { setCatalogStatus, uploadSkill, uploadMod, AdminCatalogError } = await import("./admin-server");
const { getCatalog, __resetCatalogCache } = await import("./efectivo");

const ficha = (slug: string, over: Record<string, unknown> = {}) => ({ ...structuredClone(realCatalog.skills[0].ficha), slug, order: 9, category: "estrategia-y-negocio", ...over });

beforeEach(() => {
  __resetCatalogCache();
  fake = fakeSupabase({ catalog_overrides: [], catalog_items: [], catalog_status_log: [] });
});

async function rejects(p: Promise<unknown>, status: number, msg?: RegExp) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(AdminCatalogError);
  expect(err.status).toBe(status);
  if (msg) expect(err.message).toMatch(msg);
  return err;
}

describe("estado", () => {
  it("desactiva un skill del repo, lo registra y se ve al instante", async () => {
    expect(await setCatalogStatus({ kind: "skill", slug: "arto-edit-color", status: "hidden", actor: "victor@arto" })).toEqual({ changed: true, from: "published", to: "hidden" });
    expect(fake.db.catalog_overrides).toEqual([expect.objectContaining({ kind: "skill", slug: "arto-edit-color", status: "hidden", updated_by: "victor@arto" })]);
    expect(fake.db.catalog_status_log).toEqual([
      expect.objectContaining({ kind: "skill", slug: "arto-edit-color", action: "status", from_status: "published", to_status: "hidden", changed_by: "victor@arto" }),
    ]);
    expect((await getCatalog()).getSkill("arto-edit-color")).toBeNull();
  });

  it("mismo estado: no escribe nada", async () => {
    expect(await setCatalogStatus({ kind: "mod", slug: "auto-handoff", status: "coming_soon", actor: "v" })).toMatchObject({ changed: false });
    expect(fake.db.catalog_status_log).toHaveLength(0);
  });

  it("rechaza tipo, estado o slug invalidos sin escribir", async () => {
    await rejects(setCatalogStatus({ kind: "prompt", slug: "x", status: "hidden", actor: "v" }), 400);
    await rejects(setCatalogStatus({ kind: "skill", slug: "arto-edit-color", status: "borrado", actor: "v" }), 400);
    await rejects(setCatalogStatus({ kind: "skill", slug: "no-existe", status: "hidden", actor: "v" }), 404);
    expect(fake.db.catalog_overrides).toHaveLength(0);
  });

  it("si no puede leer la base no escribe (503)", async () => {
    fake.failReads = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await rejects(setCatalogStatus({ kind: "skill", slug: "arto-edit-color", status: "hidden", actor: "v" }), 503);
    expect(fake.db.catalog_overrides).toHaveLength(0);
  });
});

describe("subir un skill", () => {
  it("valida, guarda el paquete en Storage, registra y queda oculto", async () => {
    const pkg = skillPackage("arto-nuevo");
    const res = await uploadSkill({ ficha: ficha("arto-nuevo"), pkg, actor: "victor@arto" });
    expect(res).toMatchObject({ slug: "arto-nuevo", created: true, bytes: pkg.length });
    expect(fake.calls.uploads).toEqual([`skills/arto-nuevo/${res.sha256}.skill`]);
    expect(fake.db.catalog_items[0]).toMatchObject({ kind: "skill", slug: "arto-nuevo", storage_path: `skills/arto-nuevo/${res.sha256}.skill`, sha256: res.sha256 });
    expect(fake.db.catalog_overrides[0]).toMatchObject({ slug: "arto-nuevo", status: "hidden" });
    expect(fake.db.catalog_status_log[0]).toMatchObject({ action: "upload", from_status: null, to_status: "hidden" });
    const c = await getCatalog();
    expect(c.find("skill", "arto-nuevo")).toMatchObject({ status: "hidden", source: "admin" });
    expect(c.getSkill("arto-nuevo")).toBeNull();

    await setCatalogStatus({ kind: "skill", slug: "arto-nuevo", status: "published", actor: "victor@arto" });
    expect((await getCatalog()).getDownloadItem("arto-nuevo")).toMatchObject({ access: "pro", storagePath: `skills/arto-nuevo/${res.sha256}.skill` });
  });

  it("una version nueva reemplaza el paquete, borra el viejo y vuelve a oculto", async () => {
    const first = await uploadSkill({ ficha: ficha("arto-nuevo"), pkg: skillPackage("arto-nuevo"), actor: "v" });
    await setCatalogStatus({ kind: "skill", slug: "arto-nuevo", status: "published", actor: "v" });
    const second = await uploadSkill({ ficha: ficha("arto-nuevo", { version: "1.1" }), pkg: skillPackage("arto-nuevo", { deflate: true }), actor: "v" });
    expect(second.created).toBe(false);
    expect(fake.calls.removes).toEqual([`skills/arto-nuevo/${first.sha256}.skill`]);
    expect(fake.db.catalog_items).toHaveLength(1);
    expect(fake.db.catalog_status_log.at(-1)).toMatchObject({ action: "upload", from_status: "published", to_status: "hidden" });
  });

  it("no sube nada si no pasa la validacion compartida", async () => {
    const err = await rejects(uploadSkill({ ficha: ficha("arto-nuevo"), pkg: skillPackage("arto-nuevo", { name: "otro" }), actor: "v" }), 400);
    expect(err.errors.join(" ")).toMatch(/no coincide con el slug/);
    expect(fake.calls.uploads).toEqual([]);
    expect(fake.db.catalog_items).toHaveLength(0);
  });

  it("si el slug ya esta en el repo, gana el del repo y no se sube", async () => {
    await rejects(uploadSkill({ ficha: ficha("arto-edit-color"), pkg: skillPackage("arto-edit-color"), actor: "v" }), 409, /ya existe en el repo/);
    await rejects(uploadSkill({ ficha: ficha("arto-edit-bundle-1"), pkg: skillPackage("arto-edit-bundle-1"), actor: "v" }), 409);
    expect(fake.calls.uploads).toEqual([]);
  });

  it("si falla la base despues de subir el archivo, lo quita", async () => {
    await getCatalog({ fresh: true });
    const pkg = skillPackage("arto-nuevo");
    fake.failWrites = false;
    const orig = (fake.client as { from: (t: string) => { upsert: unknown } }).from;
    (fake.client as { from: unknown }).from = (t: string) => {
      const q = orig(t);
      if (t === "catalog_items") q.upsert = async () => ({ error: { message: "violacion" } });
      return q;
    };
    await expect(uploadSkill({ ficha: ficha("arto-nuevo"), pkg, actor: "v" })).rejects.toThrow(/catalog_items/);
    expect(fake.calls.uploads).toHaveLength(1);
    expect(fake.calls.removes).toEqual(fake.calls.uploads);
  });
});

describe("subir un mod", () => {
  const base = () => {
    const m = structuredClone(ALL_MODS[0]) as unknown as Record<string, unknown>;
    return { ...m, code: "MOD02", slug: "mod-nuevo" };
  };

  it("entra oculto y el estado no se guarda en la ficha", async () => {
    await uploadMod({ mod: { ...base(), status: "published" }, file: null, actor: "v" });
    expect(fake.db.catalog_items[0].ficha).not.toHaveProperty("status");
    expect(fake.db.catalog_items[0].storage_path).toBeNull();
    expect((await getCatalog()).find("mod", "mod-nuevo")?.status).toBe("hidden");
  });

  it("no pisa un mod del repo ni repite codigo", async () => {
    await rejects(uploadMod({ mod: { ...base(), code: "MOD01" }, file: null, actor: "v" }), 409, /repo/);
    await rejects(uploadMod({ mod: { ...base(), slug: "auto-handoff" }, file: null, actor: "v" }), 409, /repo/);
    await uploadMod({ mod: base(), file: null, actor: "v" });
    await rejects(uploadMod({ mod: { ...base(), slug: "otro-mod" }, file: null, actor: "v" }), 409, /MOD02/);
  });
});
