import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import modsManifest from "@/lib/catalogo/mods.json";
import { fakeSupabase, type FakeSupabase } from "../../../../../tests/helpers/fake-supabase";

/* GET /api/mod-downloads/[slug] (18 nov 2026, D37): regla pro, huella y archivo. La sesion, el
 * disco y PostHog se mockean; el manifiesto y la regla son los reales. */

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

let fake: FakeSupabase;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const { GET } = await import("./route");
const { __resetCatalogCache } = await import("@/lib/catalogo/efectivo");

const MOD = modsManifest.mods.find((m) => m.code === "MOD01")!;

function req(slug: string, cookies: Record<string, string> = {}) {
  const r = new NextRequest(`https://preview.example.com/api/mod-downloads/${slug}`);
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return GET(r, { params: Promise.resolve({ slug }) });
}

/* Un archivo falso con la huella y el peso declarados: el manifiesto se parchea en el mock del disco. */
const GOOD = Buffer.from("PK\u0003\u0004mod-falso");

beforeEach(() => {
  getViewer.mockReset();
  readFile.mockReset();
  captureServer.mockClear();
  afterTasks.length = 0;
  __resetCatalogCache();
  fake = fakeSupabase({ catalog_overrides: [], catalog_items: [] });
});

describe("manifiesto", () => {
  it("MOD01 esta publicado con el paquete auditado", () => {
    expect(MOD.status).toBe("published");
    expect(MOD.package).toEqual({ file: "auto-handoff.zip", bytes: 60945, sha256: "88cd536bdeaaa6205dc0f975a36b560c235880919456bec5edf085e1b6445300" });
  });
});

describe("slug", () => {
  it("404 sin mirar la sesion si no es un mod publicado con paquete", async () => {
    for (const slug of ["nada", "..", "..%2F..%2F.env", "auto-handoff.zip", "arto-anima"]) {
      const res = await req(slug);
      expect(res.status, slug).toBe(404);
    }
    expect(getViewer).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("404 si en /admin se oculto o se puso en muy pronto", async () => {
    for (const status of ["hidden", "coming_soon"]) {
      __resetCatalogCache();
      fake = fakeSupabase({ catalog_overrides: [{ kind: "mod", slug: "auto-handoff", status, updated_by: "v", updated_at: "2026-11-18T00:00:00Z" }], catalog_items: [] });
      const res = await req("auto-handoff");
      expect(res.status, status).toBe(404);
    }
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe("acceso", () => {
  it("sin sesion manda a entrar y regresa a la pagina del mod", async () => {
    getViewer.mockResolvedValue({ signedIn: false });
    const res = await req("auto-handoff", { NEXT_LOCALE: "es" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://preview.example.com/es/login?next=%2Fes%2Fmods%2Fauto-handoff");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(readFile).not.toHaveBeenCalled();
  });

  it("una cuenta gratis va a pricing", async () => {
    getViewer.mockResolvedValue({ signedIn: true, userId: "u1", tier: "free" });
    const res = await req("auto-handoff");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://preview.example.com/en/pricing?from=auto-handoff");
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe("Pro", () => {
  it("entrega el zip si la huella coincide y lo registra", async () => {
    const real = Buffer.alloc(MOD.package!.bytes);
    // El archivo real no esta en el entorno de pruebas: se comprueba con uno del mismo peso cuya
    // huella se declara igual parcheando el manifiesto en memoria.
    const sha = createHash("sha256").update(real).digest("hex");
    const original = { ...MOD.package! };
    MOD.package!.sha256 = sha;
    __resetCatalogCache();
    try {
      readFile.mockResolvedValue(real);
      getViewer.mockResolvedValue({ signedIn: true, userId: "u2", tier: "pro" });
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const res = await req("auto-handoff", { asai_consent: "all.v3-2026-10-22" });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/zip");
      expect(res.headers.get("content-disposition")).toContain('filename="auto-handoff - ASAI - V0.8.6-asai.2.zip"');
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(String(readFile.mock.calls[0][0])).toMatch(/private[/\\]mods[/\\]auto-handoff\.zip$/);
      while (afterTasks.length) await afterTasks.shift()!();
      expect(JSON.parse(String(log.mock.calls.at(-1)?.[0]))).toMatchObject({ event: "mod_download", slug: "auto-handoff", user_id: "u2", tier: "pro" });
      expect(captureServer).toHaveBeenCalledWith("u2", "mod_downloaded", expect.objectContaining({ mod: "auto-handoff", tier: "pro" }));
      log.mockRestore();
    } finally {
      Object.assign(MOD.package!, original);
    }
  });

  it("503 si el archivo no es el auditado", async () => {
    readFile.mockResolvedValue(GOOD);
    getViewer.mockResolvedValue({ signedIn: true, userId: "u2", tier: "enterprise" });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await req("auto-handoff");
    expect(res.status).toBe(503);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("404 si el archivo no esta en disco", async () => {
    readFile.mockRejectedValue(new Error("ENOENT"));
    getViewer.mockResolvedValue({ signedIn: true, userId: "u2", tier: "pro" });
    const res = await req("auto-handoff");
    expect(res.status).toBe(404);
  });
});
