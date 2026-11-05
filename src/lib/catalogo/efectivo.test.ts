import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type FakeSupabase } from "../../../tests/helpers/fake-supabase";

/* Lectura del estado de la base con cache de 60 s y caida al manifiesto (2026-11-05). */

let fake: FakeSupabase;
const createAdminClient = vi.fn(() => fake.client);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

const { getCatalog, loadCatalogState, invalidateCatalog, __resetCatalogCache, CATALOG_TTL_MS } = await import("./efectivo");

const hide = (slug: string) => ({ kind: "skill", slug, status: "hidden", updated_by: "v", updated_at: "2026-11-05T12:00:00Z" });

beforeEach(() => {
  __resetCatalogCache();
  createAdminClient.mockClear();
  fake = fakeSupabase({ catalog_overrides: [hide("arto-edit-color")], catalog_items: [] });
  vi.useRealTimers();
});

describe("estado efectivo", () => {
  it("aplica lo de la base encima del manifiesto", async () => {
    const c = await getCatalog();
    expect(c.dbOk).toBe(true);
    expect(c.getSkill("arto-edit-color")).toBeNull();
    expect(c.getSkill("arto-edit-cortes")?.status).toBe("published");
  });

  it("guarda 60 s y despues vuelve a leer", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    await loadCatalogState();
    await loadCatalogState();
    expect(createAdminClient).toHaveBeenCalledTimes(1);
    fake.db.catalog_overrides = [];
    vi.setSystemTime(new Date(Date.now() + CATALOG_TTL_MS + 1));
    const c = await getCatalog();
    expect(createAdminClient).toHaveBeenCalledTimes(2);
    expect(c.getSkill("arto-edit-color")?.status).toBe("published");
  });

  it("fresh e invalidate leen al momento (lo usa /admin)", async () => {
    await loadCatalogState();
    fake.db.catalog_overrides = [];
    expect((await getCatalog()).getSkill("arto-edit-color")).toBeNull();
    expect((await getCatalog({ fresh: true })).getSkill("arto-edit-color")?.status).toBe("published");
    fake.db.catalog_overrides = [hide("arto-edit-color")];
    invalidateCatalog();
    expect((await getCatalog()).getSkill("arto-edit-color")).toBeNull();
  });

  it("si la base falla desde el inicio, sirve el manifiesto tal cual", async () => {
    fake.failReads = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = await getCatalog();
    expect(c.dbOk).toBe(false);
    expect(c.getSkill("arto-edit-color")?.status).toBe("published");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("si la base falla despues, sirve el ultimo estado bueno", async () => {
    await loadCatalogState();
    fake.failReads = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = await getCatalog({ fresh: true });
    expect(c.dbOk).toBe(false);
    expect(c.getSkill("arto-edit-color")).toBeNull();
    err.mockRestore();
  });

  it("sin variables de Supabase no truena: manifiesto", async () => {
    createAdminClient.mockImplementationOnce(() => {
      throw new Error("Missing Supabase env vars");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await getCatalog()).dbOk).toBe(false);
    err.mockRestore();
  });
});
