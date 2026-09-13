import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * POST /api/skills/[slug] (H-39): la llamada del trial se cobra al autenticar; si el
 * engine cae a fallback, la ruta la devuelve solo a clientes con tope. Todo lo que
 * toca base o Claude se mockea.
 */

vi.mock("@/lib/skills", () => ({}));

const getSkill = vi.fn();
vi.mock("@/lib/skills/registry", () => ({ getSkill: (slug: string) => getSkill(slug) }));

const runSkill = vi.fn();
vi.mock("@/lib/skills/engine", () => ({
  runSkill: (...args: unknown[]) => runSkill(...args),
  SkillNotFoundError: class extends Error {},
  SkillExecutionError: class extends Error {},
}));

const requireClientAuth = vi.fn();
vi.mock("@/lib/clients/auth", () => ({
  requireClientAuth: (...args: unknown[]) => requireClientAuth(...args),
}));

const refundTrialCall = vi.fn();
vi.mock("@/lib/clients/store", () => ({
  refundTrialCall: (id: string) => refundTrialCall(id),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ limited: false, count: 1, limit: 10, retryAfterSec: 10 }),
  getClientIp: () => "1.2.3.4",
}));

const { POST } = await import("./route");

const gatedSkill = {
  slug: "brand-positioning",
  public: false,
  inputValidator: (body: unknown) => ({ valid: true, data: body }),
};

function client(trial_calls_limit: number | null) {
  return {
    id: "client-1",
    name: "Test",
    email: "t@example.com",
    api_key_prefix: "arto_live_test",
    tier: "trial",
    allowed_skills: ["*"],
    rate_limit_per_hour: 100,
    trial_calls_limit,
    trial_calls_used: 1,
    active: true,
    notes: null,
  };
}

function post() {
  const request = new NextRequest("http://localhost/api/skills/brand-positioning", {
    method: "POST",
    headers: { "content-type": "application/json", "x-arto-api-key": "arto_live_abc" },
    body: JSON.stringify({ brand: "x" }),
  });
  return POST(request, { params: Promise.resolve({ slug: "brand-positioning" }) });
}

describe("POST /api/skills/[slug] devolucion del trial en fallback (H-39)", () => {
  beforeEach(() => {
    getSkill.mockReset();
    runSkill.mockReset();
    requireClientAuth.mockReset();
    refundTrialCall.mockReset();
    getSkill.mockReturnValue(gatedSkill);
    refundTrialCall.mockResolvedValue(0);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("fallback con cliente de trial: devuelve exactamente una llamada", async () => {
    requireClientAuth.mockResolvedValue({ ok: true, client: client(2) });
    runSkill.mockResolvedValue({ skill: "brand-positioning", source: "fallback", output: {}, latencyMs: 1, model: "ai-error" });
    const res = await post();
    expect(res.status).toBe(200);
    expect(refundTrialCall).toHaveBeenCalledTimes(1);
    expect(refundTrialCall).toHaveBeenCalledWith("client-1");
  });

  it("source ai: no devuelve nada", async () => {
    requireClientAuth.mockResolvedValue({ ok: true, client: client(2) });
    runSkill.mockResolvedValue({ skill: "brand-positioning", source: "ai", output: {}, latencyMs: 1, model: "claude-sonnet-5" });
    const res = await post();
    expect(res.status).toBe(200);
    expect(refundTrialCall).not.toHaveBeenCalled();
  });

  it("cliente sin tope (trial_calls_limit null) en fallback: no devuelve nada", async () => {
    requireClientAuth.mockResolvedValue({ ok: true, client: client(null) });
    runSkill.mockResolvedValue({ skill: "brand-positioning", source: "fallback", output: {}, latencyMs: 1, model: "ai-error" });
    const res = await post();
    expect(res.status).toBe(200);
    expect(refundTrialCall).not.toHaveBeenCalled();
  });

  it("skill publico en fallback: no hay cliente ni devolucion", async () => {
    getSkill.mockReturnValue({ ...gatedSkill, slug: "brand-roast", public: true });
    runSkill.mockResolvedValue({ skill: "brand-roast", source: "fallback", output: {}, latencyMs: 1, model: "ai-error" });
    const res = await post();
    expect(res.status).toBe(200);
    expect(requireClientAuth).not.toHaveBeenCalled();
    expect(refundTrialCall).not.toHaveBeenCalled();
  });

  it("auth rechazada: no corre el skill ni devuelve", async () => {
    requireClientAuth.mockResolvedValue({ ok: false, status: 429, error: "Trial exhausted" });
    const res = await post();
    expect(res.status).toBe(429);
    expect(runSkill).not.toHaveBeenCalled();
    expect(refundTrialCall).not.toHaveBeenCalled();
  });
});
