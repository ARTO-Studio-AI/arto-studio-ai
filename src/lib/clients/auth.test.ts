import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Client } from "./store";

/**
 * requireClientAuth: el trial se consume de forma atomica al autenticar.
 * store.ts se mockea por completo (no hay base de datos en estas pruebas).
 */

const verifyApiKey = vi.fn<(key: string) => Promise<Client | null>>();
const consumeTrialCall = vi.fn();

vi.mock("./store", () => ({
  verifyApiKey: (key: string) => verifyApiKey(key),
  consumeTrialCall: (id: string) => consumeTrialCall(id),
}));

const checkRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string, limit: number) => checkRateLimit(key, limit),
}));

const { requireClientAuth } = await import("./auth");

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "c-" + Math.random().toString(36).slice(2),
    name: "Test",
    email: "test@example.com",
    api_key_prefix: "arto_live_test",
    tier: "trial",
    allowed_skills: ["brand-positioning"],
    rate_limit_per_hour: 100,
    trial_calls_limit: 5,
    trial_calls_used: 0,
    active: true,
    notes: null,
    ...overrides,
  };
}

function request(key = "arto_live_abc") {
  return new NextRequest("http://localhost/api/skills/brand-positioning", {
    method: "POST",
    headers: { "x-arto-api-key": key },
  });
}

describe("requireClientAuth", () => {
  beforeEach(() => {
    verifyApiKey.mockReset();
    consumeTrialCall.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({ limited: false, count: 1, limit: 100, retryAfterSec: 10 });
  });

  it("usa el rate limit persistente con la key client:<id> y el limite del cliente", async () => {
    const c = client({ rate_limit_per_hour: 7 });
    verifyApiKey.mockResolvedValue(c);
    consumeTrialCall.mockResolvedValue({ ok: true, used: 1, limit: 5 });

    await requireClientAuth(request(), "brand-positioning");

    expect(checkRateLimit).toHaveBeenCalledWith(`client:${c.id}`, 7);
  });

  it("un 429 por hora no gasta una llamada del trial", async () => {
    verifyApiKey.mockResolvedValue(client());
    checkRateLimit.mockResolvedValue({ limited: true, count: 101, limit: 100, retryAfterSec: 10 });

    const result = await requireClientAuth(request(), "brand-positioning");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.error).toMatch(/Rate limit exceeded/);
      expect(result.upgrade_url).toBeUndefined();
    }
    expect(consumeTrialCall).not.toHaveBeenCalled();
  });

  it("consume una llamada y regresa el contador actualizado", async () => {
    verifyApiKey.mockResolvedValue(client({ trial_calls_used: 2 }));
    consumeTrialCall.mockResolvedValue({ ok: true, used: 3, limit: 5 });

    const result = await requireClientAuth(request(), "brand-positioning");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.client.trial_calls_used).toBe(3);
    expect(consumeTrialCall).toHaveBeenCalledTimes(1);
  });

  it("no consume si la fila leida ya marca el trial agotado", async () => {
    verifyApiKey.mockResolvedValue(client({ trial_calls_used: 5 }));

    const result = await requireClientAuth(request(), "brand-positioning");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.upgrade_url).toContain("/upgrade?client_id=");
    }
    expect(consumeTrialCall).not.toHaveBeenCalled();
  });

  it("cierra la carrera: si el UPDATE no deja pasar, responde 429 aunque la fila leida dijera que quedaba una", async () => {
    verifyApiKey.mockResolvedValue(client({ trial_calls_used: 4 }));
    consumeTrialCall.mockResolvedValue({ ok: false, reason: "exhausted" });

    const result = await requireClientAuth(request(), "brand-positioning");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.error).toMatch(/Trial exhausted/);
    }
  });

  it("responde 503 si la base no pudo registrar la llamada", async () => {
    verifyApiKey.mockResolvedValue(client());
    consumeTrialCall.mockResolvedValue({ ok: false, reason: "unavailable" });

    const result = await requireClientAuth(request(), "brand-positioning");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });

  it("no consume cuando falta la key, la key es invalida o el skill no esta permitido", async () => {
    expect((await requireClientAuth(request(""), "brand-positioning")).ok).toBe(false);

    verifyApiKey.mockResolvedValue(null);
    expect((await requireClientAuth(request(), "brand-positioning")).ok).toBe(false);

    verifyApiKey.mockResolvedValue(client({ allowed_skills: ["otro"] }));
    const denied = await requireClientAuth(request(), "brand-positioning");
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.status).toBe(403);

    expect(consumeTrialCall).not.toHaveBeenCalled();
  });
});
