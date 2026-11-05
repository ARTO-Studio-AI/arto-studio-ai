import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fakePromosDb, promoRow, type FakePromosDb } from "../../../../../../tests/helpers/fake-promos-db";

/* Checkout de Pro con promociones (5 nov 2026), con Supabase y Stripe simulados. Lo que se
 * comprueba es lo que se le manda a Stripe: el descuento solo lo decide el servidor con la
 * cookie firmada (ligada a la promo), precio y metadatos de siempre, sin
 * allow_promotion_codes con promo, y si Stripe rechaza no se cobra precio normal. */

let fake: FakePromosDb;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1", email: "a@b.mx" } } }) } }),
}));

const { GET } = await import("./route");
const { PROMO_COOKIE } = await import("@/lib/promo");
const { signPromoStart, writePromoCookie } = await import("@/lib/promo-server");
const { __resetPromoCache } = await import("@/lib/promos/estado");

const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID_PRO", "NEXT_PUBLIC_SITE_URL", "PROMO_SIGNING_SECRET", "ARTO_API_KEY_SALT", "STRIPE_PROMO_COUPON_24H"] as const;
const saved: Record<string, string | undefined> = {};
const H = 3_600_000;
const D = 24 * H;

let sessions: URLSearchParams[] = [];
let reject = false;

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_PRICE_ID_PRO = "price_pro";
  process.env.NEXT_PUBLIC_SITE_URL = "https://creative.artostudio.ai";
  process.env.PROMO_SIGNING_SECRET = "test-secret";
  delete process.env.ARTO_API_KEY_SALT;
  process.env.STRIPE_PROMO_COUPON_24H = "coupon_env_50";
  __resetPromoCache();
  fake = fakePromosDb({
    profiles: [{ id: "u1", email: "a@b.mx", stripe_customer_id: "cus_1", tier: "free", stripe_subscription_id: null, subscription_status: "inactive" }],
    promotions: [],
  });
  sessions = [];
  reject = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url === "https://api.stripe.com/v1/checkout/sessions" && init.method === "POST") {
        sessions.push(new URLSearchParams(String(init.body)));
        if (reject) return new Response(JSON.stringify({ error: { message: "No such coupon", code: "resource_missing", param: "discounts[0][coupon]" } }), { status: 400 });
        return new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" }), { status: 200 });
      }
      throw new Error(`fetch inesperado: ${init.method} ${url}`);
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const checkout = (cookie?: string) =>
  GET(new NextRequest("https://creative.artostudio.ai/api/stripe/checkout/pro", { headers: cookie ? { cookie: `${PROMO_COOKIE}=${cookie}` } : {} }));

const live = (over: Record<string, unknown> = {}) =>
  promoRow({ starts_at: new Date(Date.now() - D).toISOString(), ends_at: new Date(Date.now() + 30 * D).toISOString(), ...over });

function expectBase(p: URLSearchParams) {
  expect(p.get("mode")).toBe("subscription");
  expect(p.get("customer")).toBe("cus_1");
  expect(p.get("line_items[0][price]")).toBe("price_pro");
  expect(p.get("metadata[user_id]")).toBe("u1");
  expect(p.get("metadata[tier]")).toBe("pro");
  expect(p.get("subscription_data[metadata][user_id]")).toBe("u1");
  expect(p.get("subscription_data[metadata][tier]")).toBe("pro");
}

describe("checkout de Pro con promos de la base", () => {
  it("con el reloj firmado de la promo A: cupon de A, promo_id, expires_at y sin promotion codes", async () => {
    fake.db.promotions = [live()];
    const res = await checkout(writePromoCookie(new Map([["promo-a", Date.now() - H]]))!);
    expect(res.status).toBe(303);
    const p = sessions[0];
    expectBase(p);
    expect(p.get("discounts[0][coupon]")).toBe("COUPON_A");
    expect(p.get("metadata[promo_coupon]")).toBe("COUPON_A");
    expect(p.get("metadata[promo_id]")).toBe("promo-a");
    expect(p.has("allow_promotion_codes")).toBe(false);
    const exp = Number(p.get("expires_at"));
    expect(exp * 1000).toBeLessThanOrEqual(Date.now() + 47 * H + 1000);
    expect(exp * 1000).toBeGreaterThan(Date.now() + 30 * 60 * 1000);
  });

  it("una cookie de A no da el descuento de B: precio normal con promotion codes", async () => {
    fake.db.promotions = [live({ id: "promo-b", stripe_coupon_id: "COUPON_B" })];
    await checkout(writePromoCookie(new Map([["promo-a", Date.now() - H]]))!);
    const p = sessions[0];
    expectBase(p);
    expect(p.has("discounts[0][coupon]")).toBe(false);
    expect(p.has("metadata[promo_id]")).toBe(false);
    expect(p.get("allow_promotion_codes")).toBe("true");
  });

  it("promo apagada desde el admin: ya no hay descuento", async () => {
    fake.db.promotions = [live({ enabled: false })];
    await checkout(writePromoCookie(new Map([["promo-a", Date.now() - H]]))!);
    expect(sessions[0].has("discounts[0][coupon]")).toBe(false);
  });

  it("prueba gratis: trial_period_days, sin cupon y sin promotion codes", async () => {
    fake.db.promotions = [live({ id: "prueba-7", kind: "trial", percent_off: null, duration_months: null, stripe_coupon_id: null, trial_days: 7 })];
    await checkout(writePromoCookie(new Map([["prueba-7", Date.now() - H]]))!);
    const p = sessions[0];
    expectBase(p);
    expect(p.get("subscription_data[trial_period_days]")).toBe("7");
    expect(p.get("metadata[promo_id]")).toBe("prueba-7");
    expect(p.has("discounts[0][coupon]")).toBe(false);
    expect(p.has("allow_promotion_codes")).toBe(false);
  });

  it("quien ya tuvo suscripcion no recibe promo", async () => {
    fake.db.promotions = [live()];
    fake.db.profiles[0].stripe_subscription_id = "sub_old";
    fake.db.profiles[0].subscription_status = "canceled";
    await checkout(writePromoCookie(new Map([["promo-a", Date.now() - H]]))!);
    expect(sessions[0].has("discounts[0][coupon]")).toBe(false);
  });

  it("si Stripe rechaza el cupon: /pricing?error=promo_unavailable y no se reintenta a precio normal", async () => {
    fake.db.promotions = [live()];
    reject = true;
    const res = await checkout(writePromoCookie(new Map([["promo-a", Date.now() - H]]))!);
    expect(res.headers.get("location")).toBe("https://creative.artostudio.ai/pricing?error=promo_unavailable");
    expect(sessions).toHaveLength(1);
  });
});

describe("respaldo: la promo de la variable", () => {
  it("sin la tabla, la cookie v1 del PR 123 sigue dando el cupon de la variable", async () => {
    fake.missingTable = true;
    await checkout(signPromoStart(Date.now() - H)!);
    const p = sessions[0];
    expectBase(p);
    expect(p.get("discounts[0][coupon]")).toBe("coupon_env_50");
    expect(p.has("allow_promotion_codes")).toBe(false);
  });

  it("con la base caida y el reloj de una promo de la base: no se cobra precio normal en silencio", async () => {
    fake.failReads = ["promotions"];
    const res = await checkout(writePromoCookie(new Map([["promo-a", Date.now() - H]]))!);
    expect(res.headers.get("location")).toBe("https://creative.artostudio.ai/pricing?error=promo_unavailable");
    expect(sessions).toHaveLength(0);
  });

  it("sin cookie: precio normal, como siempre", async () => {
    await checkout();
    expect(sessions[0].get("allow_promotion_codes")).toBe("true");
    expect(sessions[0].has("discounts[0][coupon]")).toBe(false);
  });
});
