import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareCoupon, verifyPromoInStripe, type StripeCoupon, type StripePrice } from "./stripe-cupon";

/* Validacion del cupon contra lo configurado, con Stripe simulado (5 nov 2026). La regla
 * dura: solo GET. Ninguna prueba deja pasar un POST, DELETE ni nada que escriba. */

const price: StripePrice = { id: "price_pro", product: "prod_pro", currency: "usd", unit_amount: 900, recurring: { interval: "month" }, active: true };
const coupon = (over: Partial<StripeCoupon> = {}): StripeCoupon => ({
  id: "HALF",
  valid: true,
  percent_off: 50,
  amount_off: null,
  currency: null,
  duration: "once",
  duration_in_months: null,
  redeem_by: null,
  max_redemptions: null,
  times_redeemed: 0,
  applies_to: { products: ["prod_pro"] },
  ...over,
});
const promo = { kind: "percent" as const, percentOff: 50, amountOffCents: null, currency: null, months: 1, trialDays: null, couponId: "HALF", endsAt: "2026-12-01T00:00:00Z" };

describe("compareCoupon", () => {
  it("coincide: porcentaje, once, solo Pro y vigente", () => {
    const v = compareCoupon(promo, coupon(), price);
    expect(v.ok).toBe(true);
    expect(v.checks.every((c) => c.ok)).toBe(true);
    expect(v.snapshot).toMatchObject({ id: "HALF", percent_off: 50, products: ["prod_pro"], price_product: "prod_pro" });
  });

  const failsOn = (label: string, c: StripeCoupon, p: object = promo) => {
    const v = compareCoupon(p as typeof promo, c, price);
    expect(v.ok).toBe(false);
    expect(v.checks.find((x) => x.label === label)?.ok).toBe(false);
  };

  it("cada diferencia lo frena", () => {
    failsOn("Cupón vigente", coupon({ valid: false }));
    failsOn("Porcentaje", coupon({ percent_off: 40 }));
    failsOn("Porcentaje", coupon({ percent_off: null, amount_off: 450, currency: "usd" }));
    failsOn("Duración", coupon({ duration: "forever" }));
    failsOn("Duración", coupon({ duration: "repeating", duration_in_months: 3 }));
    failsOn("Solo para Pro", coupon({ applies_to: { products: ["prod_otro"] } }));
    failsOn("Solo para Pro", coupon({ applies_to: null }));
  });

  it("varios meses pide repeating con esos meses; 1 mes acepta repeating de 1", () => {
    expect(compareCoupon({ ...promo, months: 3 }, coupon({ duration: "repeating", duration_in_months: 3 }), price).ok).toBe(true);
    expect(compareCoupon(promo, coupon({ duration: "repeating", duration_in_months: 1 }), price).ok).toBe(true);
    failsOn("Duración", coupon(), { ...promo, months: 3 });
  });

  it("monto fijo: mismo monto y misma moneda que el price de Pro", () => {
    const amount = { ...promo, kind: "amount" as const, percentOff: null, amountOffCents: 450, currency: "usd" };
    const c = coupon({ percent_off: null, amount_off: 450, currency: "usd" });
    expect(compareCoupon(amount, c, price).ok).toBe(true);
    failsOn("Monto", coupon({ percent_off: null, amount_off: 500, currency: "usd" }), amount);
    failsOn("Moneda", coupon({ percent_off: null, amount_off: 450, currency: "mxn" }), { ...amount, currency: "mxn" });
  });

  it("avisa (sin frenar) si el cupon deja de canjearse antes del fin o tiene tope", () => {
    const v = compareCoupon(promo, coupon({ redeem_by: Date.parse("2026-11-20T00:00:00Z") / 1000, max_redemptions: 100 }), price);
    expect(v.ok).toBe(true);
    expect(v.warnings).toHaveLength(2);
  });
});

describe("verifyPromoInStripe (Stripe simulado)", () => {
  const saved = { key: process.env.STRIPE_SECRET_KEY, price: process.env.STRIPE_PRICE_ID_PRO };
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_PRICE_ID_PRO = "price_pro";
  });
  afterEach(() => {
    for (const [k, v] of [["STRIPE_SECRET_KEY", saved.key], ["STRIPE_PRICE_ID_PRO", saved.price]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function stripe(responses: Record<string, { status: number; body: unknown }>) {
    const calls: { url: string; method: string; auth: string | null }[] = [];
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      calls.push({ url, method: init.method ?? "GET", auth: headers.get("authorization") });
      const key = Object.keys(responses).find((k) => url.includes(k));
      const r = key ? responses[key] : { status: 404, body: { error: { message: "No such" } } };
      return new Response(JSON.stringify(r.body), { status: r.status });
    });
    return { fetcher, calls };
  }

  it("solo hace GET al cupon (con applies_to expandido) y al price de Pro", async () => {
    const s = stripe({ "/prices/price_pro": { status: 200, body: price }, "/coupons/HALF": { status: 200, body: coupon() } });
    const v = await verifyPromoInStripe(promo, s.fetcher);
    expect(v.ok).toBe(true);
    expect(s.calls.map((c) => c.method)).toEqual(["GET", "GET"]);
    expect(s.calls.every((c) => c.auth === "Bearer sk_test_fake")).toBe(true);
    expect(s.calls[1].url).toBe("https://api.stripe.com/v1/coupons/HALF?expand%5B%5D=applies_to");
  });

  it("cupon que no existe: dice por que y no prende", async () => {
    const s = stripe({ "/prices/price_pro": { status: 200, body: price } });
    const v = await verifyPromoInStripe(promo, s.fetcher);
    expect(v.ok).toBe(false);
    expect(v.checks[0].detail).toMatch(/No existe el cupón/);
  });

  it("Stripe caido o sin llave: no prende", async () => {
    const down = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    expect((await verifyPromoInStripe(promo, down)).ok).toBe(false);
    delete process.env.STRIPE_SECRET_KEY;
    const s = stripe({});
    expect((await verifyPromoInStripe(promo, s.fetcher)).ok).toBe(false);
    expect(s.calls).toHaveLength(0);
  });

  it("prueba gratis: no busca cupon, solo el price", async () => {
    const s = stripe({ "/prices/price_pro": { status: 200, body: price } });
    const v = await verifyPromoInStripe({ ...promo, kind: "trial", couponId: null, months: null, percentOff: null, trialDays: 7 }, s.fetcher);
    expect(v.ok).toBe(true);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].url).toContain("/prices/price_pro");
  });

  it("un id de cupon con caracteres raros no llega a Stripe", async () => {
    const s = stripe({ "/prices/price_pro": { status: 200, body: price } });
    expect((await verifyPromoInStripe({ ...promo, couponId: "../customers" }, s.fetcher)).ok).toBe(false);
    expect(s.calls.some((c) => c.url.includes("customers"))).toBe(false);
  });
});
