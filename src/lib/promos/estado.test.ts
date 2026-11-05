import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakePromosDb, promoRow, type FakePromosDb } from "../../../tests/helpers/fake-promos-db";

/* Lectura de promotions con cache de 60 s y respaldo (5 nov 2026): sin tabla, sin base y
 * con la base vacia sale la promo de STRIPE_PROMO_COUPON_24H. */

let fake: FakePromosDb;
const createAdminClient = vi.fn(() => fake.client);
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

const { getSitePromos, loadPromoState, invalidatePromos, __resetPromoCache, PROMOS_TTL_MS } = await import("./estado");
const { LEGACY_PROMO_ID } = await import("./tipos");

const env = { coupon: process.env.STRIPE_PROMO_COUPON_24H, secret: process.env.PROMO_SIGNING_SECRET };

beforeEach(() => {
  __resetPromoCache();
  createAdminClient.mockClear();
  fake = fakePromosDb({ promotions: [promoRow()] });
  process.env.STRIPE_PROMO_COUPON_24H = "coupon_env";
  process.env.PROMO_SIGNING_SECRET = "s";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const [k, v] of [["STRIPE_PROMO_COUPON_24H", env.coupon], ["PROMO_SIGNING_SECRET", env.secret]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("de donde salen las promos", () => {
  it("con filas en la base: las de la base y la variable no cuenta", async () => {
    const s = await getSitePromos();
    expect(s.source).toBe("db");
    expect(s.promos.map((p) => p.id)).toEqual(["promo-a"]);
  });

  it("base vacia: la de la variable, igual que el PR 123", async () => {
    fake.db.promotions = [];
    const s = await getSitePromos();
    expect(s).toMatchObject({ source: "env", degraded: false });
    expect(s.promos[0]).toMatchObject({ id: LEGACY_PROMO_ID, couponId: "coupon_env", percentOff: 50, clockHours: 24, audience: "anon" });
  });

  it("sin la tabla: la de la variable y el estado dice que falta la migracion", async () => {
    fake.missingTable = true;
    const s = await getSitePromos();
    expect(s).toMatchObject({ source: "env", degraded: true });
    const st = await loadPromoState();
    expect(st).toMatchObject({ ok: false, missing: true });
  });

  it("sin tabla y sin variable: nada", async () => {
    fake.missingTable = true;
    delete process.env.STRIPE_PROMO_COUPON_24H;
    expect(await getSitePromos()).toMatchObject({ source: "none", promos: [] });
  });

  it("sin variables de Supabase no truena", async () => {
    createAdminClient.mockImplementationOnce(() => {
      throw new Error("Missing Supabase env vars");
    });
    expect((await getSitePromos()).source).toBe("env");
  });

  it("una fila rota no tumba nada: se ignora y se avisa", async () => {
    fake.db.promotions = [promoRow(), promoRow({ id: "rota", percent_off: 500 })];
    const st = await loadPromoState();
    expect(st.promos.map((p) => p.id)).toEqual(["promo-a"]);
    expect(st.issues.map((i) => i.id)).toEqual(["rota"]);
  });
});

describe("cache y ultimo estado bueno", () => {
  it("guarda 60 s y despues vuelve a leer", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    await loadPromoState();
    await loadPromoState();
    expect(fake.reads).toBe(1);
    vi.setSystemTime(new Date(Date.now() + PROMOS_TTL_MS + 1));
    await loadPromoState();
    expect(fake.reads).toBe(2);
  });

  it("fresh e invalidate leen al momento (lo usa /admin)", async () => {
    await loadPromoState();
    fake.db.promotions = [];
    expect((await getSitePromos()).source).toBe("db");
    invalidatePromos();
    expect((await getSitePromos()).source).toBe("env");
    fake.db.promotions = [promoRow()];
    expect((await getSitePromos({ fresh: true })).source).toBe("db");
  });

  it("si la base cae despues, sirve el ultimo estado bueno", async () => {
    await loadPromoState();
    fake.failReads = true;
    const s = await getSitePromos({ fresh: true });
    expect(s.source).toBe("db");
    expect(s.promos.map((p) => p.id)).toEqual(["promo-a"]);
    expect((await loadPromoState()).ok).toBe(false);
  });
});
