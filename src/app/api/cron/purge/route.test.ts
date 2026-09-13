import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/cron/purge (H-40): 401 antes de tocar nada si falta o no coincide el
 * secreto; 200 con el conteo borrado cuando coincide. La purga se mockea.
 */

const purgeOldRateLimits = vi.fn<(days?: number) => Promise<number>>();
vi.mock("@/lib/rate-limit", () => ({
  purgeOldRateLimits: (days?: number) => purgeOldRateLimits(days),
}));

const { GET } = await import("./route");

function get(authorization?: string) {
  return GET(
    new NextRequest("http://localhost/api/cron/purge", {
      headers: authorization ? { authorization } : {},
    })
  );
}

describe("GET /api/cron/purge", () => {
  const savedSecret = process.env.CRON_SECRET;
  beforeEach(() => {
    purgeOldRateLimits.mockReset();
    purgeOldRateLimits.mockResolvedValue(11);
    process.env.CRON_SECRET = "secreto-de-prueba";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    if (savedSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedSecret;
  });

  it("401 sin cabecera Authorization, sin tocar la base", async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(purgeOldRateLimits).not.toHaveBeenCalled();
  });

  it("401 con secreto incorrecto", async () => {
    const res = await get("Bearer otro");
    expect(res.status).toBe(401);
    expect(purgeOldRateLimits).not.toHaveBeenCalled();
  });

  it("401 fail-closed si CRON_SECRET no esta configurado, aunque manden Bearer", async () => {
    delete process.env.CRON_SECRET;
    const res = await get("Bearer ");
    expect(res.status).toBe(401);
    expect(purgeOldRateLimits).not.toHaveBeenCalled();
  });

  it("200 con el conteo borrado cuando el secreto coincide", async () => {
    const res = await get("Bearer secreto-de-prueba");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, days: 7, deleted: 11 });
    expect(purgeOldRateLimits).toHaveBeenCalledWith(7);
  });

  it("500 si la purga falla", async () => {
    purgeOldRateLimits.mockRejectedValue(new Error("db down"));
    const res = await get("Bearer secreto-de-prueba");
    expect(res.status).toBe(500);
  });
});
