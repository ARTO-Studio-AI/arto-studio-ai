import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * checkRateLimit: cuenta en Postgres via bump_rate_limit y compara con el limite.
 * `postgres` se mockea; el contador lo decide cada caso.
 */

type FakeSql = ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>) & {
  calls: { text: string; values: unknown[] }[];
  nextCount: number;
  fail: boolean;
};

const fakeSql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
  fakeSql.calls.push({ text: strings.join("$"), values });
  if (fakeSql.fail) throw new Error("db down");
  return [{ count: fakeSql.nextCount }];
}) as FakeSql;
fakeSql.calls = [];
fakeSql.nextCount = 1;
fakeSql.fail = false;

vi.mock("postgres", () => ({ default: () => fakeSql }));
process.env.DATABASE_URL = "postgres://test:test@localhost/test";

const { checkRateLimit, getClientIp } = await import("./rate-limit");

describe("checkRateLimit", () => {
  beforeEach(() => {
    fakeSql.calls = [];
    fakeSql.fail = false;
  });

  it("llama a bump_rate_limit con la key y permite hasta el limite", async () => {
    fakeSql.nextCount = 10;
    const r = await checkRateLimit("roast:ip:1.2.3.4", 10);
    expect(r.limited).toBe(false);
    expect(r.count).toBe(10);
    expect(fakeSql.calls[0].text).toMatch(/bump_rate_limit/);
    expect(fakeSql.calls[0].values).toEqual(["roast:ip:1.2.3.4"]);
  });

  it("la llamada limite+1 sale limitada con Retry-After hasta la siguiente hora", async () => {
    fakeSql.nextCount = 11;
    const r = await checkRateLimit("roast:ip:1.2.3.4", 10);
    expect(r.limited).toBe(true);
    expect(r.retryAfterSec).toBeGreaterThan(0);
    expect(r.retryAfterSec).toBeLessThanOrEqual(3600);
  });

  it("fail-open: si la base falla deja pasar y loguea", async () => {
    fakeSql.fail = true;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await checkRateLimit("signup:ip:1.2.3.4", 3);
    expect(r.limited).toBe(false);
    expect(err).toHaveBeenCalled();
  });
});

describe("getClientIp", () => {
  const req = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n] ?? null } });

  it("toma la primera IP de x-forwarded-for", () => {
    expect(getClientIp(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("cae a x-real-ip y luego a unknown", () => {
    expect(getClientIp(req({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(getClientIp(req({}))).toBe("unknown");
  });
});
