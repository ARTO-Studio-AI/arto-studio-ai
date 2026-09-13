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

/* Como postgres-js: las filas van en el array y las filas afectadas en `.count`. */
const fakeSql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
  fakeSql.calls.push({ text: strings.join("$"), values });
  if (fakeSql.fail) throw new Error("db down");
  const rows = [{ count: fakeSql.nextCount }] as unknown[] & { count?: number };
  rows.count = fakeSql.nextCount;
  return rows;
}) as FakeSql;
fakeSql.calls = [];
fakeSql.nextCount = 1;
fakeSql.fail = false;

vi.mock("postgres", () => ({ default: () => fakeSql }));
process.env.DATABASE_URL = "postgres://test:test@localhost/test";

const { checkRateLimit, getClientIp, purgeOldRateLimits } = await import("./rate-limit");

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

describe("purgeOldRateLimits (H-40)", () => {
  beforeEach(() => {
    fakeSql.calls = [];
    fakeSql.fail = false;
  });

  it("borra las ventanas mas viejas que N dias y regresa el conteo", async () => {
    fakeSql.nextCount = 11;
    expect(await purgeOldRateLimits(7)).toBe(11);
    const text = fakeSql.calls[0].text.replace(/\s+/g, " ");
    expect(text).toContain("DELETE FROM rate_limits");
    expect(text).toContain("window_start < now() - make_interval(days => $");
    expect(fakeSql.calls[0].values).toEqual([7]);
  });

  it("el default es 7 dias", async () => {
    fakeSql.nextCount = 0;
    expect(await purgeOldRateLimits()).toBe(0);
    expect(fakeSql.calls[0].values).toEqual([7]);
  });

  it("si la base falla, lanza (el cron responde 500)", async () => {
    fakeSql.fail = true;
    await expect(purgeOldRateLimits()).rejects.toThrow(/db down/);
  });
});
