import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/* Candado de las rutas de /admin/promociones (5 nov 2026): el mismo que el Catalogo
 * (catalogAdmin). Sin sesion de admin, o con el Bearer de ADMIN_API_KEY, 401 y no se toca
 * nada (ni la base ni Stripe). */

const requireAdminSession = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAdminSession: (...a: unknown[]) => requireAdminSession(...a) }));

const savePromo = vi.fn(async () => ({ id: "promo-a", created: true, enabled: false, verification: null, warnings: [] }));
const setPromoEnabled = vi.fn(async () => ({ id: "promo-a", changed: true, enabled: true, verification: null, warnings: [] }));
const verifyOnly = vi.fn(async () => ({ ok: true, checks: [], warnings: [], snapshot: null }));
vi.mock("@/lib/promos/admin-server", async (orig) => {
  const real = await orig<typeof import("@/lib/promos/admin-server")>();
  return {
    PromoAdminError: real.PromoAdminError,
    savePromo: (...a: unknown[]) => savePromo(...(a as [])),
    setPromoEnabled: (...a: unknown[]) => setPromoEnabled(...(a as [])),
    verifyOnly: (...a: unknown[]) => verifyOnly(...(a as [])),
  };
});

const guardar = await import("./guardar/route");
const estado = await import("./estado/route");
const verificar = await import("./verificar/route");
const { PromoAdminError } = await import("@/lib/promos/admin-server");

const req = (path: string, body: unknown, bearer = true) =>
  new NextRequest(`https://preview.example.com/api/admin/promociones/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: "Bearer clave" } : {}) },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  requireAdminSession.mockReset();
  savePromo.mockClear();
  setPromoEnabled.mockClear();
  verifyOnly.mockClear();
});

describe("sin admin", () => {
  for (const [label, auth] of [
    ["sin sesion", { ok: false, reason: "unauthenticated" }],
    ["con sesion que no es admin", { ok: false, reason: "not_admin" }],
    ["con el Bearer de ADMIN_API_KEY", { ok: true, email: "bearer", userId: "bearer", via: "bearer" }],
  ] as const) {
    it(`${label}: 401 y no escribe ni lee Stripe`, async () => {
      requireAdminSession.mockResolvedValue(auth);
      expect((await guardar.POST(req("guardar", { promo: {}, enable: true, isNew: true }))).status).toBe(401);
      expect((await estado.POST(req("estado", { id: "promo-a", enabled: true }))).status).toBe(401);
      expect((await verificar.POST(req("verificar", { promo: {} }))).status).toBe(401);
      expect(savePromo).not.toHaveBeenCalled();
      expect(setPromoEnabled).not.toHaveBeenCalled();
      expect(verifyOnly).not.toHaveBeenCalled();
    });
  }
});

describe("con sesion de admin", () => {
  beforeEach(() => requireAdminSession.mockResolvedValue({ ok: true, email: "victor@arto", userId: "u", via: "session" }));

  it("pasa el correo de la sesion como autor y enable solo con true literal", async () => {
    expect((await guardar.POST(req("guardar", { promo: { id: "promo-a" }, enable: "true", isNew: true }, false))).status).toBe(200);
    expect(savePromo).toHaveBeenCalledWith({ raw: { id: "promo-a" }, enable: false, isNew: true, actor: "victor@arto" });
    await estado.POST(req("estado", { id: "promo-a", enabled: true }, false));
    expect(setPromoEnabled).toHaveBeenCalledWith({ id: "promo-a", enabled: true, actor: "victor@arto" });
  });

  it("los errores esperados salen con su estado y detalle", async () => {
    setPromoEnabled.mockRejectedValueOnce(new PromoAdminError("El cupón no coincide", 409, [], { ok: false, checks: [], warnings: [], snapshot: null }));
    const res = await estado.POST(req("estado", { id: "promo-a", enabled: true }, false));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "El cupón no coincide", verification: { ok: false } });
  });

  it("cuerpo roto: 400", async () => {
    const bad = new NextRequest("https://preview.example.com/api/admin/promociones/guardar", { method: "POST", body: "{roto" });
    expect((await guardar.POST(bad)).status).toBe(400);
    expect(savePromo).not.toHaveBeenCalled();
  });
});
