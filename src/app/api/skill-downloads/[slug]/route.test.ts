import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import realCatalog from "@/lib/catalogo/skills.json";
import { EDIT_BUNDLE_FREE_UNTIL } from "@/lib/edit-bundle/access";
import { fakeSupabase, type FakeSupabase } from "../../../../../tests/helpers/fake-supabase";

/* GET /api/skill-downloads/[slug] (Victor, 27 oct 2026): sesion, regla de fecha o Pro, y el archivo.
 * La sesion, el plan, el disco y PostHog se mockean; la regla de fecha es la real. */

const getViewer = vi.fn();
vi.mock("@/lib/edit-bundle/viewer", () => ({ getViewer: () => getViewer() }));

const readFile = vi.fn();
vi.mock("fs/promises", () => ({ readFile: (p: string) => readFile(p), default: { readFile: (p: string) => readFile(p) } }));

const captureServer = vi.fn(async () => true);
vi.mock("@/lib/analytics-server", () => ({ captureServer: (...a: unknown[]) => captureServer(...(a as [])) }));

const afterTasks: Array<() => unknown> = [];
vi.mock("next/server", async (orig) => {
  const real = await orig<typeof import("next/server")>();
  return { ...real, after: (fn: () => unknown) => afterTasks.push(fn) };
});

/* Estado de /admin/skills (catalog_overrides y catalog_items) en un Supabase falso: las
 * pruebas nunca leen la base real aunque .env.local traiga las llaves. */
let fake: FakeSupabase;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const { GET } = await import("./route");
const { __resetCatalogCache } = await import("@/lib/catalogo/efectivo");

/* Los dos lados del corte salen de la constante: si se amplia otra vez la promo, estas pruebas no se rompen. */
const AFTER = new Date(EDIT_BUNDLE_FREE_UNTIL);
const BEFORE = new Date(AFTER.getTime() - 1000);
const ZIP = Buffer.from("PK\u0003\u0004fake");

function req(slug: string, cookies: Record<string, string> = {}) {
  const r = new NextRequest(`https://preview.example.com/api/skill-downloads/${slug}`);
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return GET(r, { params: Promise.resolve({ slug }) });
}

async function flushAfter() {
  while (afterTasks.length) await afterTasks.shift()!();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  getViewer.mockReset();
  readFile.mockReset();
  captureServer.mockClear();
  afterTasks.length = 0;
  readFile.mockResolvedValue(ZIP);
  __resetCatalogCache();
  fake = fakeSupabase({ catalog_overrides: [], catalog_items: [] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("slug", () => {
  it("404 sin mirar la sesion si el slug no esta en el catalogo", async () => {
    for (const slug of ["nada", "..", "..%2F..%2F.env", "arto-edit-color.skill"]) {
      const res = await req(slug);
      expect(res.status, slug).toBe(404);
    }
    expect(getViewer).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe("sin sesion", () => {
  it("redirige a entrar y regresa a la pagina del skill, sin entregar nada", async () => {
    vi.setSystemTime(BEFORE);
    getViewer.mockResolvedValue({ signedIn: false });
    const res = await req("arto-edit-subtitulos", { NEXT_LOCALE: "es" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://preview.example.com/es/login?next=%2Fes%2Fskills%2Farto-edit-subtitulos",
    );
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(readFile).not.toHaveBeenCalled();
  });

  it("el bundle regresa a su landing", async () => {
    vi.setSystemTime(BEFORE);
    getViewer.mockResolvedValue({ signedIn: false });
    const res = await req("arto-edit-bundle-1");
    expect(res.headers.get("location")).toBe("https://preview.example.com/en/login?next=%2Fen%2Fedit-bundle-1");
  });
});

describe("cuenta gratis", () => {
  it("en promocion descarga el archivo y lo registra", async () => {
    vi.setSystemTime(BEFORE);
    getViewer.mockResolvedValue({ signedIn: true, userId: "u1", tier: "free" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await req("arto-edit-subtitulos", { asai_consent: "all.v3-2026-10-22" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain('filename="arto-edit-subtitulos - SKILL - V1.0.skill"');
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await res.arrayBuffer()).equals(ZIP)).toBe(true);
    expect(String(readFile.mock.calls[0][0])).toMatch(/private[/\\]skills[/\\]arto-edit-subtitulos\.skill$/);
    await flushAfter();
    const line = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
    expect(line).toMatchObject({ event: "skill_download", slug: "arto-edit-subtitulos", user_id: "u1", tier: "free", promo: true });
    expect(captureServer).toHaveBeenCalledWith(
      "u1",
      "skill_downloaded",
      expect.objectContaining({ skill: "arto-edit-subtitulos", tier: "free", promo: true }),
    );
    log.mockRestore();
  });

  it("despues del corte va a pricing y no lee el archivo", async () => {
    vi.setSystemTime(AFTER);
    getViewer.mockResolvedValue({ signedIn: true, userId: "u1", tier: "free" });
    const res = await req("arto-edit-color", { NEXT_LOCALE: "es" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://preview.example.com/es/pricing?from=arto-edit-color");
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe("Pro", () => {
  it("descarga despues del corte, el bundle tambien", async () => {
    vi.setSystemTime(AFTER);
    getViewer.mockResolvedValue({ signedIn: true, userId: "u2", tier: "pro" });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await req("arto-edit-bundle-1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain('filename="arto-edit-bundle-1 - V1.0.zip"');
    expect(String(readFile.mock.calls[0][0])).toMatch(/arto-edit-bundle-1\.zip$/);
  });
});

describe("registro y archivo", () => {
  it("sin consentimiento de analitica no manda nada a PostHog", async () => {
    vi.setSystemTime(BEFORE);
    getViewer.mockResolvedValue({ signedIn: true, userId: "u1", tier: "free" });
    vi.spyOn(console, "log").mockImplementation(() => {});
    await req("arto-edit-zooms", { asai_consent: "essential.v3-2026-10-22" });
    await flushAfter();
    expect(captureServer).not.toHaveBeenCalled();
  });

  it("un paquete de mas de 4.4 MB responde 503 en vez de romper la funcion", async () => {
    vi.setSystemTime(BEFORE);
    getViewer.mockResolvedValue({ signedIn: true, userId: "u1", tier: "free" });
    readFile.mockResolvedValue(Buffer.alloc(Math.floor(4.4 * 1024 * 1024) + 1));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await req("arto-edit-director");
    expect(res.status).toBe(503);
  });

  it("si el paquete aun no se sincroniza responde 404 not_available", async () => {
    vi.setSystemTime(BEFORE);
    getViewer.mockResolvedValue({ signedIn: true, userId: "u1", tier: "free" });
    readFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    const res = await req("arto-edit-sonido");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_available" });
  });
});

/* Gestion desde /admin/skills (2026-11-05): el estado efectivo manda sobre el del repo. */
describe("estado de /admin", () => {
  const H = "b".repeat(64);
  const ov = (kind: string, slug: string, status: string) => ({ kind, slug, status, updated_by: "v", updated_at: "2026-11-05T12:00:00Z" });
  const pro = { signedIn: true, userId: "u2", tier: "pro" };

  it("oculto o muy pronto desde /admin: 404 sin mirar la sesion ni leer el archivo", async () => {
    fake.db.catalog_overrides = [ov("skill", "arto-edit-color", "hidden"), ov("skill", "arto-edit-zooms", "coming_soon"), ov("bundle", "arto-edit-bundle-1", "hidden")];
    for (const slug of ["arto-edit-color", "arto-edit-zooms", "arto-edit-bundle-1"]) {
      const res = await req(slug);
      expect(res.status, slug).toBe(404);
    }
    expect(getViewer).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  const uploaded = () => ({
    kind: "skill",
    slug: "arto-subido",
    ficha: { ...structuredClone(realCatalog.skills[0].ficha), slug: "arto-subido", category: "estrategia-y-negocio" },
    storage_path: `skills/arto-subido/${H}.skill`,
    bytes: 100,
    sha256: H,
    uploaded_by: "v",
    updated_at: "2026-11-05T12:00:00Z",
  });

  it("subido por admin y oculto (como entra): 404", async () => {
    fake.db.catalog_items = [uploaded()];
    expect((await req("arto-subido")).status).toBe(404);
    expect(fake.calls.signed).toEqual([]);
  });

  it("subido y publicado: regla pro de su categoria, y solo despues la URL firmada de corta vida", async () => {
    vi.setSystemTime(BEFORE);
    fake.db.catalog_items = [uploaded()];
    fake.db.catalog_overrides = [ov("skill", "arto-subido", "published")];

    getViewer.mockResolvedValue({ signedIn: false });
    let res = await req("arto-subido", { NEXT_LOCALE: "es" });
    expect(res.headers.get("location")).toBe("https://preview.example.com/es/login?next=%2Fes%2Fskills%2Farto-subido");

    getViewer.mockResolvedValue({ signedIn: true, userId: "u1", tier: "free" });
    res = await req("arto-subido", { NEXT_LOCALE: "es" });
    expect(res.headers.get("location")).toBe("https://preview.example.com/es/pricing?from=arto-subido");
    expect(fake.calls.signed).toEqual([]);

    getViewer.mockResolvedValue(pro);
    vi.spyOn(console, "log").mockImplementation(() => {});
    res = await req("arto-subido");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`https://storage.example.com/sign/skills/arto-subido/${H}.skill?token=t`);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(fake.calls.signed).toEqual([{ path: `skills/arto-subido/${H}.skill`, seconds: 60, download: "arto-subido - SKILL - V1.0.skill" }]);
    expect(readFile).not.toHaveBeenCalled();
    await flushAfter();
  });

  it("si la base no responde, sirve lo del repo (falla al manifiesto)", async () => {
    vi.setSystemTime(BEFORE);
    fake.failReads = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    getViewer.mockResolvedValue(pro);
    expect((await req("arto-edit-color")).status).toBe(200);
    expect((await req("arto-subido")).status).toBe(404);
  });
});
