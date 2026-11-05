import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PROMO_COOKIE,
  PROMO_DURATION_MS,
  barMode,
  formatCountdown,
  isPromoModalExcluded,
  promoHref,
  toPromoState,
} from "./promo";
import {
  couponForCheckout,
  promoCheckoutExpiresAt,
  promoConfigured,
  promoWindow,
  signPromoStart,
  verifyPromoCookie,
} from "./promo-server";
import PromoPrice from "@/app/[locale]/(marketing)/pricing/PromoPrice";
import { POST } from "@/app/api/promo/route";

/* Promo de 24 h (5 nov 2026): firma de la cookie, decision del cupon y que sin
 * STRIPE_PROMO_COUPON_24H no se pinte nada. tests/setup.ts carga .env.local, asi que
 * cada prueba fija sus propias variables. */

const KEYS = ["PROMO_SIGNING_SECRET", "ARTO_API_KEY_SALT", "STRIPE_PROMO_COUPON_24H"] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.PROMO_SIGNING_SECRET = "test-secret-promo";
  delete process.env.ARTO_API_KEY_SALT;
  process.env.STRIPE_PROMO_COUPON_24H = "coupon_test_50";
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const T0 = Date.UTC(2026, 10, 5, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

describe("cookie firmada", () => {
  it("vigente: la firma vale y la ventana sigue abierta", () => {
    const raw = signPromoStart(T0)!;
    expect(raw).toMatch(/^v1\.\d{13}\.[A-Za-z0-9_-]{43}$/);
    const start = verifyPromoCookie(raw, T0 + 3 * HOUR);
    expect(start).toBe(T0);
    expect(promoWindow(start, T0 + 3 * HOUR)).toEqual({ active: true, expired: false, endsAt: T0 + PROMO_DURATION_MS });
  });

  it("vencida: la firma vale pero ya no esta activa", () => {
    const raw = signPromoStart(T0)!;
    const now = T0 + PROMO_DURATION_MS + 1;
    expect(verifyPromoCookie(raw, now)).toBe(T0);
    expect(promoWindow(T0, now)).toMatchObject({ active: false, expired: true });
  });

  it("alterada: otra fecha, otra firma o basura no valen", () => {
    const raw = signPromoStart(T0)!;
    const [, , sig] = raw.split(".");
    // Mover el inicio para alargar el reloj con la firma vieja.
    expect(verifyPromoCookie(`v1.${T0 + 20 * HOUR}.${sig}`, T0 + 21 * HOUR)).toBeNull();
    // Cambiar un caracter de la firma.
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verifyPromoCookie(`v1.${T0}.${flipped}`, T0 + HOUR)).toBeNull();
    expect(verifyPromoCookie("v1.abc.def", T0)).toBeNull();
    expect(verifyPromoCookie("", T0)).toBeNull();
    expect(verifyPromoCookie(undefined, T0)).toBeNull();
  });

  it("firmada con otro secreto no vale", () => {
    const raw = signPromoStart(T0)!;
    process.env.PROMO_SIGNING_SECRET = "otro-secreto";
    expect(verifyPromoCookie(raw, T0 + HOUR)).toBeNull();
  });

  it("un inicio en el futuro no vale", () => {
    const raw = signPromoStart(T0 + 2 * HOUR)!;
    expect(verifyPromoCookie(raw, T0)).toBeNull();
  });

  it("sin secreto no se firma ni se verifica", () => {
    const raw = signPromoStart(T0)!;
    delete process.env.PROMO_SIGNING_SECRET;
    expect(signPromoStart(T0)).toBeNull();
    expect(verifyPromoCookie(raw, T0 + HOUR)).toBeNull();
  });

  it("usa ARTO_API_KEY_SALT si no hay PROMO_SIGNING_SECRET", () => {
    delete process.env.PROMO_SIGNING_SECRET;
    process.env.ARTO_API_KEY_SALT = "salt-de-prueba";
    const raw = signPromoStart(T0)!;
    expect(verifyPromoCookie(raw, T0 + HOUR)).toBe(T0);
  });
});

describe("couponForCheckout", () => {
  const base = {
    couponId: "coupon_test_50",
    start: T0,
    now: T0 + HOUR,
    priceId: "price_pro",
    proMonthlyPriceId: "price_pro",
    profile: { tier: "free", stripe_subscription_id: null, subscription_status: "inactive" },
  };

  it("aplica el cupon dentro de las 24 h a quien nunca se suscribio", () => {
    expect(couponForCheckout(base)).toBe("coupon_test_50");
    expect(couponForCheckout({ ...base, profile: null })).toBe("coupon_test_50");
  });

  it("variable ausente: nunca", () => {
    expect(couponForCheckout({ ...base, couponId: null })).toBeNull();
  });

  it("vencido o sin cookie valida: nunca", () => {
    expect(couponForCheckout({ ...base, now: T0 + PROMO_DURATION_MS })).toBeNull();
    expect(couponForCheckout({ ...base, start: null })).toBeNull();
  });

  it("ya suscrito o con suscripcion pasada: nunca", () => {
    expect(couponForCheckout({ ...base, profile: { ...base.profile, stripe_subscription_id: "sub_123" } })).toBeNull();
    expect(couponForCheckout({ ...base, profile: { ...base.profile, subscription_status: "canceled" } })).toBeNull();
    expect(couponForCheckout({ ...base, profile: { ...base.profile, subscription_status: "past_due" } })).toBeNull();
    expect(couponForCheckout({ ...base, profile: { ...base.profile, tier: "pro" } })).toBeNull();
  });

  it("otro precio que no sea Pro mensual: nunca", () => {
    expect(couponForCheckout({ ...base, priceId: "price_starter" })).toBeNull();
    expect(couponForCheckout({ ...base, proMonthlyPriceId: "" })).toBeNull();
  });

  it("la sesion con descuento vence con las 24 h, dentro de los limites de Stripe", () => {
    expect(promoCheckoutExpiresAt(T0, T0 + HOUR)).toBe(Math.floor((T0 + PROMO_DURATION_MS) / 1000));
    // A 5 minutos del final, Stripe pide al menos 30 min.
    const late = T0 + PROMO_DURATION_MS - 5 * 60 * 1000;
    expect(promoCheckoutExpiresAt(T0, late)).toBe(Math.floor((late + 31 * 60 * 1000) / 1000));
    expect(promoCheckoutExpiresAt(T0, T0 + PROMO_DURATION_MS)).toBeNull();
  });
});

describe("sin STRIPE_PROMO_COUPON_24H la promo no existe", () => {
  it("promoConfigured es false sin cupon o sin secreto", () => {
    expect(promoConfigured()).toBe(true);
    delete process.env.STRIPE_PROMO_COUPON_24H;
    expect(promoConfigured()).toBe(false);
    process.env.STRIPE_PROMO_COUPON_24H = "   ";
    expect(promoConfigured()).toBe(false);
    process.env.STRIPE_PROMO_COUPON_24H = "coupon_test_50";
    delete process.env.PROMO_SIGNING_SECRET;
    expect(promoConfigured()).toBe(false);
  });

  it("la barra nunca pasa a modo promo", () => {
    const promo = { active: true, expired: false, endsAt: T0 + HOUR };
    expect(barMode({ promoEnabled: false, promo, signupTriggered: false })).toBe("off");
    expect(barMode({ promoEnabled: false, promo, signupTriggered: true })).toBe("signup");
    expect(barMode({ promoEnabled: true, promo, signupTriggered: false })).toBe("promo");
    expect(barMode({ promoEnabled: true, promo: { active: false, expired: true, endsAt: null }, signupTriggered: true })).toBe("signup");
  });

  it("/pricing pinta el precio normal, sin reloj ni descuento", () => {
    const html = renderToStaticMarkup(
      createElement(PromoPrice, { copy: null }, createElement("span", null, "$9")),
    );
    expect(html).toBe("<span>$9</span>");
    expect(html).not.toContain("4.50");
    expect(html).not.toContain("timer");
  });

  it("POST /api/promo responde apagado y no escribe cookie", async () => {
    delete process.env.STRIPE_PROMO_COUPON_24H;
    const res = await POST(new NextRequest("https://creative.artostudio.ai/api/promo", { method: "POST" }));
    expect(await res.json()).toEqual({ enabled: false });
    expect(res.cookies.get(PROMO_COOKIE)).toBeUndefined();
  });
});

describe("POST /api/promo con la promo encendida", () => {
  it("arranca el reloj en la primera visita y no lo reinicia despues", async () => {
    const first = await POST(new NextRequest("https://creative.artostudio.ai/api/promo", { method: "POST" }));
    const body = await first.json();
    expect(body).toMatchObject({ enabled: true, active: true, expired: false });
    const cookie = first.cookies.get(PROMO_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value).toMatch(/^v1\./);

    const again = await POST(
      new NextRequest("https://creative.artostudio.ai/api/promo", {
        method: "POST",
        headers: { cookie: `${PROMO_COOKIE}=${cookie!.value}` },
      }),
    );
    const body2 = await again.json();
    expect(body2.endsAt).toBe(body.endsAt);
    expect(again.cookies.get(PROMO_COOKIE)).toBeUndefined();
  });

  it("una cookie vencida se respeta: no hay reloj nuevo", async () => {
    const old = signPromoStart(Date.now() - PROMO_DURATION_MS - HOUR)!;
    const res = await POST(
      new NextRequest("https://creative.artostudio.ai/api/promo", { method: "POST", headers: { cookie: `${PROMO_COOKIE}=${old}` } }),
    );
    expect(await res.json()).toMatchObject({ enabled: true, active: false, expired: true });
    expect(res.cookies.get(PROMO_COOKIE)).toBeUndefined();
  });

  it("con sesion y sin cookie no arranca la promo", async () => {
    const res = await POST(
      new NextRequest("https://creative.artostudio.ai/api/promo", {
        method: "POST",
        headers: { cookie: "sb-abcd-auth-token=base64-xyz" },
      }),
    );
    expect(await res.json()).toMatchObject({ enabled: true, active: false, expired: false, endsAt: null });
    expect(res.cookies.get(PROMO_COOKIE)).toBeUndefined();
  });
});

describe("ayudas del navegador", () => {
  it("formatCountdown da HH:MM:SS y nunca negativo", () => {
    expect(formatCountdown(PROMO_DURATION_MS)).toBe("24:00:00");
    expect(formatCountdown(3 * HOUR + 4 * 60 * 1000 + 5999)).toBe("03:04:05");
    expect(formatCountdown(-10)).toBe("00:00:00");
  });

  it("toPromoState pasa el fin al reloj local", () => {
    const st = toPromoState({ enabled: true, active: true, expired: false, endsAt: 10_000, serverNow: 4_000 }, 100_000);
    expect(st).toEqual({ active: true, expired: false, endsAt: 106_000 });
    expect(toPromoState({ enabled: false }, 0)).toBeNull();
    expect(toPromoState(null, 0)).toBeNull();
    expect(toPromoState({ enabled: true, active: false, expired: true, endsAt: 1, serverNow: 2 }, 5)).toMatchObject({
      active: false,
      expired: true,
    });
  });

  it("enlaces y rutas", () => {
    expect(promoHref("es")).toBe("/es/login?next=%2Fes%2Fpricing");
    expect(isPromoModalExcluded("/es/pricing")).toBe(true);
    expect(isPromoModalExcluded("/en/login")).toBe(true);
    expect(isPromoModalExcluded("/es/prompts")).toBe(false);
  });
});
