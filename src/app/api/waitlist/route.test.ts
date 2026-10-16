import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/* Lista de espera del Pack (2026-10-16): la fila de waitlist se guarda siempre con el
 * primer toque; solo con la casilla entra a la lista con doble opt-in; un fallo de base
 * responde error y no ok. Postgres va mockeado: no toca ninguna base. */

type ListResult = { ok: boolean; newlyActive: boolean; needsConfirmation: boolean; unsubscribeToken: string | null };

const state = vi.hoisted(() => ({
  queries: [] as { text: string; values: unknown[] }[],
  dbFails: false,
  list: vi.fn<(input: unknown) => Promise<ListResult>>(async () => ({ ok: true, newlyActive: false, needsConfirmation: true, unsubscribeToken: "tok" })),
  confirm: vi.fn<(...a: unknown[]) => Promise<boolean>>(async () => true),
  limited: false,
}));

vi.mock("dotenv", () => ({ config: () => ({}) }));
vi.mock("postgres", () => ({
  default: () =>
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      state.queries.push({ text: strings.join("?"), values });
      if (state.dbFails) throw new Error("conexion rechazada");
      return [];
    },
}));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "1.2.3.4",
  checkRateLimit: async () => ({ limited: state.limited, count: 1, limit: 10, retryAfterSec: 60 }),
}));
vi.mock("@/lib/marketing-list", () => ({ addToMarketingList: state.list }));
vi.mock("@/lib/mailer", () => ({ sendListConfirmation: state.confirm }));

process.env.DATABASE_URL = "postgres://falsa@localhost/nada";

async function post(body: unknown, cookie = ""): Promise<Response> {
  const { POST } = await import("./route");
  return POST(
    new NextRequest("http://127.0.0.1:3000/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

function insertValues(): unknown[] {
  const q = state.queries.find((x) => x.text.includes("INSERT INTO waitlist"));
  expect(q).toBeDefined();
  return q!.values;
}

describe("/api/waitlist", () => {
  beforeEach(() => {
    state.queries = [];
    state.dbFails = false;
    state.limited = false;
    state.list.mockClear();
    state.confirm.mockClear();
  });

  it("rechaza un correo invalido", async () => {
    const res = await post({ email: "no-es-correo", source: "skills" });
    expect(res.status).toBe(400);
    expect(state.queries).toHaveLength(0);
  });

  it("sin la casilla guarda la fila y no toca la lista", async () => {
    const res = await post({ email: "Ana@Example.com ", source: "skills", lang: "es" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, marketing: false, confirmation_failed: false });
    const v = insertValues();
    expect(v.slice(0, 7)).toEqual(["ana@example.com", "skills", "skills", "es", false, null, null]);
    expect(state.list).not.toHaveBeenCalled();
    expect(state.confirm).not.toHaveBeenCalled();
  });

  it("con la casilla da de alta con doble opt-in y fuente pack_waitlist", async () => {
    const res = await post({ email: "ana@example.com", source: "skills", lang: "en", marketing: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, marketing: true, confirmation_failed: false });
    const v = insertValues();
    expect(v[4]).toBe(true);
    expect(v[5]).toBe("v1-2026-10-16");
    expect(typeof v[6]).toBe("string");
    expect(state.list).toHaveBeenCalledWith({ email: "ana@example.com", source: "pack_waitlist", requireConfirm: true });
    expect(state.confirm).toHaveBeenCalledWith("ana@example.com", "en", "tok", "pack_waitlist");
  });

  it("solo acepta true como casilla marcada", async () => {
    await post({ email: "ana@example.com", source: "skills", marketing: "true" });
    expect(insertValues()[4]).toBe(false);
    expect(state.list).not.toHaveBeenCalled();
  });

  it("si ya estaba activa no reenvia y responde igual que a una nueva (sin oraculo)", async () => {
    state.list.mockResolvedValueOnce({ ok: true, newlyActive: false, needsConfirmation: false, unsubscribeToken: "tok" });
    const res = await post({ email: "ana@example.com", source: "skills", marketing: true });
    expect(await res.json()).toEqual({ ok: true, marketing: true, confirmation_failed: false });
    expect(state.confirm).not.toHaveBeenCalled();
  });

  it("avisa si no se pudo mandar la confirmacion", async () => {
    state.confirm.mockResolvedValueOnce(false);
    const res = await post({ email: "ana@example.com", source: "agents", marketing: true });
    expect(await res.json()).toEqual({ ok: true, marketing: true, confirmation_failed: true });
    expect(state.list).toHaveBeenCalledWith({ email: "ana@example.com", source: "agents_waitlist", requireConfirm: true });
  });

  it("no responde con CORS abierto", async () => {
    const res = await post({ email: "ana@example.com", source: "skills" });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("guarda el primer toque de la cookie asai_utm", async () => {
    const ft = { utm_source: "instagram", utm_medium: "social", utm_campaign: "lz01", landing_path: "/es/skills", ts: "2026-10-16T10:00:00.000Z" };
    await post({ email: "ana@example.com", source: "skills" }, `asai_utm=${encodeURIComponent(JSON.stringify(ft))}`);
    const v = insertValues();
    expect(v.slice(7)).toEqual(["instagram", "social", "lz01", null, null, null, "/es/skills", "2026-10-16T10:00:00.000Z"]);
  });

  it("si el ts de la cookie no sirve no guarda nada del primer toque", async () => {
    const ft = { utm_source: "instagram", utm_campaign: "lz01", ts: "no-es-fecha" };
    await post({ email: "ana@example.com", source: "skills" }, `asai_utm=${encodeURIComponent(JSON.stringify(ft))}`);
    expect(insertValues().slice(7)).toEqual([null, null, null, null, null, null, null, null]);
  });

  it("una fuente desconocida cae en general", async () => {
    await post({ email: "ana@example.com", source: "<script>" });
    expect(insertValues()[1]).toBe("general");
  });

  it("un fallo de base responde 500, no ok", async () => {
    state.dbFails = true;
    const res = await post({ email: "ana@example.com", source: "skills", marketing: true });
    expect(res.status).toBe(500);
    expect(state.list).not.toHaveBeenCalled();
  });

  it("un fallo de la lista responde 500", async () => {
    state.list.mockResolvedValueOnce({ ok: false, newlyActive: false, needsConfirmation: false, unsubscribeToken: null });
    const res = await post({ email: "ana@example.com", source: "skills", marketing: true });
    expect(res.status).toBe(500);
    expect(state.confirm).not.toHaveBeenCalled();
  });

  it("respeta el limite", async () => {
    state.limited = true;
    const res = await post({ email: "ana@example.com", source: "skills" });
    expect(res.status).toBe(429);
    expect(state.queries).toHaveLength(0);
  });
});
