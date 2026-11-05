import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/* Candado de las rutas de /admin/skills (2026-11-05): el mismo que el Catalogo de prompts
 * (catalogAdmin). Sin sesion de admin, o con el Bearer, 401 y no se toca nada. */

const requireAdminSession = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAdminSession: (...a: unknown[]) => requireAdminSession(...a) }));

const setCatalogStatus = vi.fn(async () => ({ changed: true, from: "published", to: "hidden" }));
const uploadSkill = vi.fn(async () => ({ slug: "arto-x", created: true }));
const uploadMod = vi.fn(async () => ({ slug: "mod-x", created: true }));
vi.mock("@/lib/catalogo/admin-server", async (orig) => {
  const real = await orig<typeof import("@/lib/catalogo/admin-server")>();
  return {
    AdminCatalogError: real.AdminCatalogError,
    setCatalogStatus: (...a: unknown[]) => setCatalogStatus(...(a as [])),
    uploadSkill: (...a: unknown[]) => uploadSkill(...(a as [])),
    uploadMod: (...a: unknown[]) => uploadMod(...(a as [])),
  };
});

const estado = await import("./estado/route");
const subir = await import("./subir/route");

const estadoReq = () =>
  new NextRequest("https://preview.example.com/api/admin/skills/estado", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer clave" },
    body: JSON.stringify({ kind: "skill", slug: "arto-edit-color", status: "hidden" }),
  });
function subirReq(fields: Record<string, string | Blob> = { kind: "skill", ficha: "{}" }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new NextRequest("https://preview.example.com/api/admin/skills/subir", { method: "POST", body: fd });
}

beforeEach(() => {
  requireAdminSession.mockReset();
  setCatalogStatus.mockClear();
  uploadSkill.mockClear();
  uploadMod.mockClear();
});

describe("sin admin", () => {
  for (const [label, auth] of [
    ["sin sesion", { ok: false, reason: "unauthenticated" }],
    ["con sesion que no es admin", { ok: false, reason: "not_admin" }],
    ["con el Bearer de ADMIN_API_KEY", { ok: true, email: "bearer", userId: "bearer", via: "bearer" }],
  ] as const) {
    it(`${label}: 401 y no escribe`, async () => {
      requireAdminSession.mockResolvedValue(auth);
      expect((await estado.POST(estadoReq())).status).toBe(401);
      expect((await subir.POST(subirReq())).status).toBe(401);
      expect(setCatalogStatus).not.toHaveBeenCalled();
      expect(uploadSkill).not.toHaveBeenCalled();
      expect(uploadMod).not.toHaveBeenCalled();
    });
  }
});

describe("con sesion de admin", () => {
  beforeEach(() => requireAdminSession.mockResolvedValue({ ok: true, email: "victor@arto", userId: "u", via: "session" }));

  it("estado: pasa el correo de la sesion como autor", async () => {
    const res = await estado.POST(estadoReq());
    expect(res.status).toBe(200);
    expect(setCatalogStatus).toHaveBeenCalledWith({ kind: "skill", slug: "arto-edit-color", status: "hidden", actor: "victor@arto" });
  });

  it("subir: lee la ficha (archivo o texto) y el paquete", async () => {
    const pkg = new File([Buffer.from("PK")], "x.skill", { type: "application/zip" });
    const res = await subir.POST(subirReq({ kind: "skill", ficha: new File(['{"slug":"arto-x"}'], "ficha.json"), paquete: pkg }));
    expect(res.status).toBe(200);
    expect(uploadSkill).toHaveBeenCalledWith({ ficha: { slug: "arto-x" }, pkg: Buffer.from("PK"), actor: "victor@arto" });
    await subir.POST(subirReq({ kind: "mod", ficha: '{"slug":"mod-x"}' }));
    expect(uploadMod).toHaveBeenCalledWith({ mod: { slug: "mod-x" }, file: null, actor: "victor@arto" });
  });

  it("subir: JSON roto, tipo invalido o archivo de mas de 4.4 MB no llegan a guardar", async () => {
    expect((await subir.POST(subirReq({ kind: "skill", ficha: "{roto" }))).status).toBe(400);
    expect((await subir.POST(subirReq({ kind: "prompt", ficha: "{}" }))).status).toBe(400);
    const big = new File([Buffer.alloc(Math.floor(4.4 * 1024 * 1024) + 1)], "x.skill");
    expect((await subir.POST(subirReq({ kind: "skill", ficha: "{}", paquete: big }))).status).toBe(413);
    expect(uploadSkill).not.toHaveBeenCalled();
  });
});
