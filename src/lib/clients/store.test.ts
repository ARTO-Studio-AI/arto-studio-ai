import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * consumeTrialCall: el check y el increment del trial viven en un solo UPDATE.
 * Se mockea `postgres` con un tag que captura el SQL y regresa lo que cada caso
 * necesite; no hay base de datos en estas pruebas.
 */

type FakeSql = ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>) & {
  json: (v: unknown) => unknown;
  calls: { text: string; values: unknown[] }[];
  nextRows: unknown[];
  fail: boolean;
};

const fakeSql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
  fakeSql.calls.push({ text: strings.join("$"), values });
  if (fakeSql.fail) throw new Error("boom");
  return fakeSql.nextRows;
}) as FakeSql;
fakeSql.json = (v: unknown) => v;
fakeSql.calls = [];
fakeSql.nextRows = [];
fakeSql.fail = false;

vi.mock("postgres", () => ({ default: () => fakeSql }));

process.env.DATABASE_URL = "postgres://test:test@localhost/test";
process.env.ARTO_API_KEY_SALT = "test-salt";

const { consumeTrialCall, verifyApiKey } = await import("./store");

describe("ARTO_API_KEY_SALT fail-closed", () => {
  const saved = { salt: process.env.ARTO_API_KEY_SALT, vercel: process.env.VERCEL_ENV };
  beforeEach(() => {
    process.env.ARTO_API_KEY_SALT = saved.salt;
    process.env.VERCEL_ENV = saved.vercel;
    fakeSql.calls = [];
    fakeSql.nextRows = [];
  });

  it("en produccion sin salt lanza antes de tocar la base", async () => {
    delete process.env.ARTO_API_KEY_SALT;
    process.env.VERCEL_ENV = "production";
    await expect(verifyApiKey("arto_live_abc")).rejects.toThrow(/ARTO_API_KEY_SALT/);
    expect(fakeSql.calls).toHaveLength(0);
  });

  it("fuera de produccion sin salt usa el default con warning y sigue", async () => {
    delete process.env.ARTO_API_KEY_SALT;
    delete process.env.VERCEL_ENV;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fakeSql.nextRows = [];
    await expect(verifyApiKey("arto_live_abc")).resolves.toBeNull();
    expect(fakeSql.calls).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });
});

describe("consumeTrialCall", () => {
  beforeEach(() => {
    fakeSql.calls = [];
    fakeSql.nextRows = [];
    fakeSql.fail = false;
  });

  it("hace check e increment en un solo UPDATE condicionado", async () => {
    fakeSql.nextRows = [{ trial_calls_used: 3, trial_calls_limit: 5 }];
    const result = await consumeTrialCall("client-1");

    expect(result).toEqual({ ok: true, used: 3, limit: 5 });
    expect(fakeSql.calls).toHaveLength(1);
    const text = fakeSql.calls[0].text.replace(/\s+/g, " ");
    expect(text).toContain("UPDATE clients");
    expect(text).toContain("trial_calls_used = trial_calls_used + 1");
    expect(text).toContain("trial_calls_limit IS NULL OR trial_calls_used < trial_calls_limit");
    expect(text).toContain("RETURNING trial_calls_used");
    expect(fakeSql.calls[0].values).toEqual(["client-1"]);
  });

  it("reporta exhausted cuando el WHERE no deja pasar la fila", async () => {
    fakeSql.nextRows = [];
    expect(await consumeTrialCall("client-1")).toEqual({ ok: false, reason: "exhausted" });
  });

  it("regresa limit null para clientes sin tope", async () => {
    fakeSql.nextRows = [{ trial_calls_used: 41, trial_calls_limit: null }];
    expect(await consumeTrialCall("client-2")).toEqual({ ok: true, used: 41, limit: null });
  });

  it("reporta unavailable si la base falla, sin lanzar", async () => {
    fakeSql.fail = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await consumeTrialCall("client-1")).toEqual({ ok: false, reason: "unavailable" });
  });
});
