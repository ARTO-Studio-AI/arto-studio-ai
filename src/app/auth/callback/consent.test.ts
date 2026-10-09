import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/* Registro free (2026-10-06): solo quien marco la casilla entra a la audiencia de Resend;
 * el consentimiento queda en user_metadata (Google) y en attribution_events; el destino
 * puede llegar por la cookie asai_next, validada como cualquier next (H-46). */

const state = vi.hoisted(() => ({
  meta: {} as Record<string, unknown>,
  provider: "email",
  inserts: [] as unknown[],
  updateUser: vi.fn(async (_id: string, _attrs: unknown) => ({ error: null })),
  upsert: vi.fn(async (_c: unknown) => ({ ok: true, newlyActive: true, unsubscribeToken: "tok" })),
  welcome: vi.fn(async (..._a: unknown[]) => true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async () => ({ error: null }),
      getUser: async () => ({
        data: {
          user: {
            id: "u1",
            email: "ana@example.com",
            created_at: new Date().toISOString(),
            app_metadata: { provider: state.provider },
            user_metadata: state.meta,
          },
        },
      }),
    },
  }),
}));

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "limit", "update"]) c[m] = () => c;
  c.maybeSingle = async () => ({ data: null });
  c.insert = async (row: unknown) => {
    state.inserts.push(row);
    return { error: null };
  };
  c.then = (resolve: (v: unknown) => void) => resolve({ error: null });
  return c;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => chain(),
    auth: { admin: { updateUserById: state.updateUser } },
  }),
}));
vi.mock("@/lib/mailer", () => ({ sendWelcome: state.welcome }));
vi.mock("@/lib/prompt-limit", () => ({ adoptOpens: vi.fn() }));
vi.mock("@/lib/analytics-server", () => ({ captureServer: vi.fn() }));
vi.mock("@/lib/resend-audience", () => ({ splitName: () => ({}) }));
vi.mock("@/lib/marketing-list", () => ({ addToMarketingList: state.upsert }));

const SITE = "https://creative.artostudio.ai";
process.env.NEXT_PUBLIC_SITE_URL = SITE;

async function run(cookie = ""): Promise<Response> {
  const { GET } = await import("./route");
  return GET(
    new NextRequest("http://127.0.0.1:3000/auth/callback?code=valido", {
      headers: cookie ? { cookie } : {},
    }),
  );
}

describe("callback: consentimiento de correos", () => {
  beforeEach(() => {
    state.meta = {};
    state.provider = "email";
    state.inserts = [];
    state.updateUser.mockClear();
    state.upsert.mockClear();
    state.welcome.mockClear();
  });

  it("magic link con casilla marcada: entra a la audiencia y no reescribe metadata", async () => {
    state.meta = { marketing_opt_in: "yes" };
    await run();
    expect(state.upsert).toHaveBeenCalledTimes(1);
    expect(state.welcome).toHaveBeenCalledWith("ana@example.com", "en", "tok");
    expect(state.updateUser).not.toHaveBeenCalled();
    expect(JSON.stringify(state.inserts)).toContain('"marketing_opt_in":"yes"');
  });

  it("la fila de signup lleva el usuario en user_id, nunca en target_id (H-61)", async () => {
    state.meta = { marketing_opt_in: "yes" };
    await run();
    const row = state.inserts[0] as Record<string, unknown>;
    expect(row.user_id).toBe("u1");
    expect(row).not.toHaveProperty("target_id");
  });

  it("magic link sin casilla: no entra a la audiencia", async () => {
    state.meta = { marketing_opt_in: "no" };
    await run();
    expect(state.upsert).not.toHaveBeenCalled();
    expect(state.welcome).not.toHaveBeenCalled();
  });

  it("Google con cookie marketing=yes: guarda el consentimiento y entra a la audiencia", async () => {
    state.provider = "google";
    const signup = encodeURIComponent(JSON.stringify({ marketing: "yes", locale: "es" }));
    await run(`asai_signup=${signup}`);
    expect(state.updateUser).toHaveBeenCalledTimes(1);
    const attrs = state.updateUser.mock.calls[0][1] as { user_metadata: Record<string, unknown> };
    expect(attrs.user_metadata.marketing_opt_in).toBe("yes");
    expect(attrs.user_metadata.marketing_consent_version).toBe("v1-2026-10-06");
    expect(state.upsert).toHaveBeenCalledTimes(1);
  });

  it("sin respuesta (usuario viejo o cookie perdida): cuenta como no", async () => {
    state.provider = "google";
    await run();
    const attrs = state.updateUser.mock.calls[0][1] as { user_metadata: Record<string, unknown> };
    expect(attrs.user_metadata.marketing_opt_in).toBe("no");
    expect(state.upsert).not.toHaveBeenCalled();
  });
});

describe("callback: destino en la cookie asai_next", () => {
  it("respeta una ruta interna y borra la cookie", async () => {
    const res = await run(`asai_next=${encodeURIComponent("/es/prompts/BR-0001")}`);
    expect(res.headers.get("location")).toBe(`${SITE}/es/prompts/BR-0001`);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/asai_next=;/);
  });

  it.each(["//evil.com", "@evil.com", "https://evil.com"])("rechaza %j", async (bad) => {
    const res = await run(`asai_next=${encodeURIComponent(bad)}`);
    expect(res.headers.get("location")).toBe(`${SITE}/`);
  });
});
