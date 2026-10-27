import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

const { GET } = await import("./route");

const BEFORE = new Date("2026-11-03T05:59:59Z");
const AFTER = new Date("2026-11-03T06:00:00Z");
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

  it("si el paquete aun no se sincroniza responde 404 not_available", async () => {
    vi.setSystemTime(BEFORE);
    getViewer.mockResolvedValue({ signedIn: true, userId: "u1", tier: "free" });
    readFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    const res = await req("arto-edit-sonido");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_available" });
  });
});
