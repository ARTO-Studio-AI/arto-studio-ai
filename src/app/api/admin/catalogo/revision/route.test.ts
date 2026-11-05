import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/* POST /api/admin/catalogo/revision (2026-11-05): mismo candado que el Catalogo (sesion de
 * admin, nunca el Bearer) y las acciones. La sesion y la base se mockean. */

const { requireAdminSession, approvePrompts, unpublishPrompts } = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  approvePrompts: vi.fn(),
  unpublishPrompts: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAdminSession: (...a: unknown[]) => requireAdminSession(...a) }));
vi.mock("@/lib/review-server", () => ({
  approvePrompts: (...a: unknown[]) => approvePrompts(...a),
  unpublishPrompts: (...a: unknown[]) => unpublishPrompts(...a),
}));

const { POST } = await import("./route");

const req = (body: unknown) =>
  POST(new NextRequest("https://preview.example.com/api/admin/catalogo/revision", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

const ADMIN = { ok: true, email: "victor@artogroup.com", userId: "u1", via: "session" };

beforeEach(() => {
  requireAdminSession.mockReset();
  approvePrompts.mockReset().mockResolvedValue({ done: 1, missing: [], batchId: null });
  unpublishPrompts.mockReset().mockResolvedValue({ done: 2, missing: [], batchId: "b-1" });
});

describe("candado", () => {
  it("401 sin sesion y no toca nada", async () => {
    requireAdminSession.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    const res = await req({ action: "approve", ids: ["AR-0251"] });
    expect(res.status).toBe(401);
    expect(approvePrompts).not.toHaveBeenCalled();
  });

  it("401 con sesion que no es de admin", async () => {
    requireAdminSession.mockResolvedValue({ ok: false, reason: "not_admin" });
    expect((await req({ action: "unpublish", ids: ["AR-0251"] })).status).toBe(401);
    expect(unpublishPrompts).not.toHaveBeenCalled();
  });

  it("401 con el Bearer de ADMIN_API_KEY: el catalogo solo se cambia con sesion", async () => {
    requireAdminSession.mockResolvedValue({ ok: true, email: "bearer", userId: "bearer", via: "bearer" });
    expect((await req({ action: "unpublish", ids: ["AR-0251"] })).status).toBe(401);
    expect(unpublishPrompts).not.toHaveBeenCalled();
  });
});

describe("acciones", () => {
  beforeEach(() => requireAdminSession.mockResolvedValue(ADMIN));

  it("aprueba con el correo de la sesion", async () => {
    const res = await req({ action: "approve", ids: ["AR-0251"] });
    expect(res.status).toBe(200);
    expect(approvePrompts).toHaveBeenCalledWith(["AR-0251"], "victor@artogroup.com", null);
    expect(unpublishPrompts).not.toHaveBeenCalled();
  });

  it("despublica uno sin confirmacion y devuelve el lote para deshacer", async () => {
    const res = await req({ action: "unpublish", ids: ["AR-0251"] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ done: 2, missing: [], batchId: "b-1" });
    expect(unpublishPrompts).toHaveBeenCalledWith(["AR-0251"], "victor@artogroup.com", null);
  });

  it("despublicar un lote sin el numero de confirmacion responde 409 y no toca nada", async () => {
    const res = await req({ action: "unpublish", ids: ["AR-0251", "BR-0252"], confirm: "1" });
    expect(res.status).toBe(409);
    expect(unpublishPrompts).not.toHaveBeenCalled();
    expect((await req({ action: "unpublish", ids: ["AR-0251", "BR-0252"], confirm: "2" })).status).toBe(200);
    expect(unpublishPrompts).toHaveBeenCalledTimes(1);
  });

  it("400 con un cuerpo no valido", async () => {
    expect((await req({ action: "approve", ids: ["../../etc"] })).status).toBe(400);
    expect((await req({ action: "publish", ids: ["AR-0251"] })).status).toBe(400);
    expect(approvePrompts).not.toHaveBeenCalled();
  });

  it("500 con el mensaje si la base falla", async () => {
    approvePrompts.mockRejectedValue(new Error("relation prompt_reviews does not exist"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await req({ action: "approve", ids: ["AR-0251"] });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("prompt_reviews");
  });
});
