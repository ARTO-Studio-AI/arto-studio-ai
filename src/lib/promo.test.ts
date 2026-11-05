import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakePromosDb, promoRow, type FakePromosDb } from "../../tests/helpers/fake-promos-db";

/* Promos (5 nov 2026): la de 24 h del PR 123 (variable STRIPE_PROMO_COUPON_24H) como
 * respaldo, y las de /admin/promociones. Firma de la cookie ligada a la promo, decision del
 * checkout y POST /api/promo. tests/setup.ts carga .env.local, asi que cada prueba fija sus
 * propias variables; la base es siempre falsa (fake-promos-db). */

let fake: FakePromosDb;
const getUser = vi.fn(async () => ({ data: { user: null as { id: string } | null } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));

const { PROMO_COOKIE, PROMO_DURATION_MS, barMode, formatCountdown, isPromoModalExcluded, promoHref, toPromoState } = await import("./promo");
const server = await import("./promo-server");
const { checkoutExpiresAt, promoCheckoutExpiresAt, promoConfigured, promoForCheckout, promoWindow, readPromoCookie, signPromoStart, verifyPromoCookie, writePromoCookie, envPromo, MAX_ENTRIES } = server;
const { __resetPromoCache } = await import("./promos/estado");
const { rowToPromo } = await import("./promos/estado");
const { LEGACY_PROMO_ID } = await import("./promos/tipos");
const PromoPrice = (await import("@/app/[locale]/(marketing)/pricing/PromoPrice")).default;
const { POST } = await import("@/app/api/promo/route");

const KEYS = ["PROMO_SIGNING_SECRET", "ARTO_API_KEY_SALT", "STRIPE_PROMO_COUPON_24H"] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.PROMO_SIGNING_SECRET = "test-secret-promo";
  delete process.env.ARTO_API_KEY_SALT;
  process.env.STRIPE_PROMO_COUPON_24H = "coupon_test_50";
  __resetPromoCache();
  // Por defecto, sin la tabla (migracion 0022 sin aplicar): sale la promo de la variable.
  fake = fakePromosDb();
  fake.missingTable = true;
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: null } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

const T0 = Date.UTC(2026, 10, 5, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const promoReq = (cookie?: string, body: unknown = { locale: "es" }) =>
  new NextRequest("https://creative.artostudio.ai/api/promo", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const live = (over: Record<string, unknown> = {}) =>
  promoRow({ starts_at: new Date(Date.now() - DAY).toISOString(), ends_at: new Date(Date.now() + 30 * DAY).toISOString(), ...over });

const def = (over: Record<string, unknown> = {}) => rowToPromo(promoRow(over) as never).promo!;

describe("cookie v1 (PR 123)", () => {
  it("vigente: la firma vale y la ventana sigue abierta", () => {
    const raw = signPromoStart(T0)!;
    expect(raw).toMatch(/^v1\.\d{13}\.[A-Za-z0-9_-]{43}$/);
    const start = verifyPromoCookie(raw, T0 + 3 * HOUR);
    expect(start).toBe(T0);
    expect(promoWindow(start, T0 + 3 * HOUR)).toEqual({ active: true, expired: false, endsAt: T0 + PROMO_DURATION_MS });
  });

  it("alterada, de otro secreto o del futuro no vale", () => {
    const raw = signPromoStart(T0)!;
    const [, , sig] = raw.split(".");
    expect(verifyPromoCookie(`v1.${T0 + 20 * HOUR}.${sig}`, T0 + 21 * HOUR)).toBeNull();
    expect(verifyPromoCookie("v1.abc.def", T0)).toBeNull();
    expect(verifyPromoCookie(undefined, T0)).toBeNull();
    expect(verifyPromoCookie(signPromoStart(T0 + 2 * HOUR)!, T0)).toBeNull();
    process.env.PROMO_SIGNING_SECRET = "otro-secreto";
    expect(verifyPromoCookie(raw, T0 + HOUR)).toBeNull();
  });

  it("usa ARTO_API_KEY_SALT si no hay PROMO_SIGNING_SECRET; sin ninguno no hay nada", () => {
    delete process.env.PROMO_SIGNING_SECRET;
    process.env.ARTO_API_KEY_SALT = "salt-de-prueba";
    expect(verifyPromoCookie(signPromoStart(T0)!, T0 + HOUR)).toBe(T0);
    delete process.env.ARTO_API_KEY_SALT;
    expect(signPromoStart(T0)).toBeNull();
    expect(writePromoCookie(new Map([["promo-a", T0]]))).toBeNull();
  });

  it("una cookie v1 cuenta solo como de la promo de la variable", () => {
    expect([...readPromoCookie(signPromoStart(T0), T0 + HOUR)]).toEqual([[LEGACY_PROMO_ID, T0]]);
  });
});

describe("cookie v2 ligada a la promo", () => {
  it("guarda varios relojes con su id y los lee igual", () => {
    const raw = writePromoCookie(new Map([["promo-a", T0], ["promo-b", T0 + HOUR]]))!;
    expect(raw).toMatch(/^v2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    expect(readPromoCookie(raw, T0 + 2 * HOUR)).toEqual(new Map([["promo-b", T0 + HOUR], ["promo-a", T0]]));
  });

  it("cambiar el id o el inicio rompe la firma: una cookie de A no sirve para B", () => {
    const raw = writePromoCookie(new Map([["promo-a", T0]]))!;
    const [, data, sig] = raw.split(".");
    const forged = Buffer.from(JSON.stringify([["promo-b", T0]])).toString("base64url");
    expect(readPromoCookie(`v2.${forged}.${sig}`, T0 + HOUR).size).toBe(0);
    const later = Buffer.from(JSON.stringify([["promo-a", T0 + 10 * HOUR]])).toString("base64url");
    expect(readPromoCookie(`v2.${later}.${sig}`, T0 + 11 * HOUR).size).toBe(0);
    expect(readPromoCookie(`v2.${data}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`, T0 + HOUR).size).toBe(0);
  });

  it("descarta relojes del futuro y se queda con los mas recientes", () => {
    const many = new Map(Array.from({ length: MAX_ENTRIES + 3 }, (_, i) => [`promo-${i}`, T0 + i * HOUR] as [string, number]));
    const raw = writePromoCookie(many)!;
    const read = readPromoCookie(raw, T0 + 100 * HOUR);
    expect(read.size).toBe(MAX_ENTRIES);
    expect(read.has("promo-0")).toBe(false);
    expect(readPromoCookie(writePromoCookie(new Map([["promo-a", T0 + 2 * HOUR]])), T0).size).toBe(0);
  });
});

describe("promoForCheckout", () => {
  const A = def({ id: "promo-a", clock_hours: 48 });
  const B = def({ id: "promo-b", stripe_coupon_id: "COUPON_B", audience: "free_never_pro" });
  const now = Date.parse("2026-11-05T12:00:00Z");
  const base = {
    promos: [A, B],
    starts: new Map([["promo-a", now - HOUR]]),
    now,
    priceId: "price_pro",
    proMonthlyPriceId: "price_pro",
    profile: { tier: "free", stripe_subscription_id: null, subscription_status: "inactive" },
  };

  it("aplica la promo del reloj firmado, con su cupon y el fin de su reloj", () => {
    const r = promoForCheckout(base)!;
    expect(r.promo.id).toBe("promo-a");
    expect(r.promo.couponId).toBe("COUPON_A");
    expect(r.endsAt).toBe(now - HOUR + 48 * HOUR);
    expect(promoForCheckout({ ...base, profile: null })?.promo.id).toBe("promo-a");
  });

  it("una cookie de A nunca da el descuento de B", () => {
    expect(promoForCheckout({ ...base, promos: [B] })).toBeNull();
  });

  it("vencida, apagada, fuera de fechas o sin cookie: nunca", () => {
    expect(promoForCheckout({ ...base, now: now - HOUR + 48 * HOUR })).toBeNull();
    expect(promoForCheckout({ ...base, promos: [{ ...A, enabled: false }] })).toBeNull();
    expect(promoForCheckout({ ...base, promos: [{ ...A, endsAt: now }] })).toBeNull();
    expect(promoForCheckout({ ...base, starts: new Map() })).toBeNull();
  });

  it("el reloj se corta al fin de la promo", () => {
    expect(promoForCheckout({ ...base, promos: [{ ...A, endsAt: now + HOUR }] })!.endsAt).toBe(now + HOUR);
  });

  it("ya suscrito o con suscripcion pasada, u otro precio: nunca", () => {
    for (const profile of [
      { ...base.profile, stripe_subscription_id: "sub_123" },
      { ...base.profile, subscription_status: "canceled" },
      { ...base.profile, subscription_status: "past_due" },
      { ...base.profile, tier: "pro" },
    ]) {
      expect(promoForCheckout({ ...base, profile })).toBeNull();
    }
    expect(promoForCheckout({ ...base, priceId: "price_starter" })).toBeNull();
    expect(promoForCheckout({ ...base, proMonthlyPriceId: "" })).toBeNull();
  });

  it("la de la variable sigue funcionando con la cookie v1", () => {
    const env = envPromo()!;
    const r = promoForCheckout({ ...base, promos: [env], starts: readPromoCookie(signPromoStart(now - HOUR), now) })!;
    expect(r.promo.couponId).toBe("coupon_test_50");
    expect(r.endsAt).toBe(now - HOUR + PROMO_DURATION_MS);
  });

  it("expires_at sigue el fin del reloj dentro de los limites de Stripe", () => {
    expect(checkoutExpiresAt(now + 5 * HOUR, now)).toBe(Math.floor((now + 5 * HOUR) / 1000));
    expect(checkoutExpiresAt(now + 5 * 60 * 1000, now)).toBe(Math.floor((now + 31 * 60 * 1000) / 1000));
    expect(checkoutExpiresAt(now + 3 * DAY, now)).toBe(Math.floor((now + 23 * HOUR + 59 * 60 * 1000) / 1000));
    expect(checkoutExpiresAt(now, now)).toBeNull();
    expect(promoCheckoutExpiresAt(T0, T0 + HOUR)).toBe(Math.floor((T0 + PROMO_DURATION_MS) / 1000));
  });
});

describe("sin promos la promo no existe", () => {
  it("promoConfigured es false sin cupon o sin secreto", () => {
    expect(promoConfigured()).toBe(true);
    process.env.STRIPE_PROMO_COUPON_24H = "   ";
    expect(promoConfigured()).toBe(false);
    process.env.STRIPE_PROMO_COUPON_24H = "coupon_test_50";
    delete process.env.PROMO_SIGNING_SECRET;
    expect(promoConfigured()).toBe(false);
  });

  it("la barra nunca pasa a modo promo", () => {
    const offer = { id: "promo-a", audience: "anon" } as never;
    const promo = { active: true, expired: false, endsAt: T0 + HOUR, promoId: "promo-a", offer };
    expect(barMode({ promoEnabled: false, promo, signupTriggered: false })).toBe("off");
    expect(barMode({ promoEnabled: false, promo, signupTriggered: true })).toBe("signup");
    expect(barMode({ promoEnabled: true, promo, signupTriggered: false })).toBe("promo");
    expect(barMode({ promoEnabled: true, promo: { ...promo, active: false, expired: true }, signupTriggered: true })).toBe("signup");
  });

  it("con sesion: solo las promos para cuentas sacan la barra", () => {
    const promo = (audience: string) => ({ active: true, expired: false, endsAt: T0 + HOUR, promoId: "x", offer: { id: "x", audience } as never });
    expect(barMode({ promoEnabled: true, promo: promo("anon"), signupTriggered: true, signedIn: true })).toBe("off");
    expect(barMode({ promoEnabled: true, promo: promo("free_never_pro"), signupTriggered: false, signedIn: true })).toBe("promo");
    expect(barMode({ promoEnabled: true, promo: promo("utm"), signupTriggered: false, signedIn: true })).toBe("promo");
  });

  it("/pricing pinta el precio normal, sin reloj ni descuento", () => {
    const html = renderToStaticMarkup(createElement(PromoPrice, { copy: null }, createElement("span", null, "$9")));
    expect(html).toBe("<span>$9</span>");
  });

  it("POST /api/promo responde apagado y no escribe cookie", async () => {
    delete process.env.STRIPE_PROMO_COUPON_24H;
    const res = await POST(promoReq());
    expect(await res.json()).toEqual({ enabled: false });
    expect(res.cookies.get(PROMO_COOKIE)).toBeUndefined();
  });

  it("sin secreto de firma tampoco, aunque haya promos en la base", async () => {
    delete process.env.PROMO_SIGNING_SECRET;
    fake.missingTable = false;
    fake.db.promotions = [live()];
    const res = await POST(promoReq());
    expect(await res.json()).toEqual({ enabled: false });
  });
});

describe("POST /api/promo con la promo de la variable (sin tabla o tabla vacia)", () => {
  it("arranca el reloj en la primera visita y no lo reinicia despues", async () => {
    const first = await POST(promoReq());
    const body = await first.json();
    expect(body).toMatchObject({ enabled: true, active: true, expired: false, promoId: LEGACY_PROMO_ID });
    expect(body.offer).toMatchObject({ id: LEGACY_PROMO_ID, kind: "percent", percentOff: 50, months: 1, clockHours: 24 });
    expect(body.offer.copy.title).toBe("Tu primer mes de Pro al 50%");
    expect(body.endsAt - body.serverNow).toBe(PROMO_DURATION_MS);
    const cookie = first.cookies.get(PROMO_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(readPromoCookie(cookie!.value, Date.now()).has(LEGACY_PROMO_ID)).toBe(true);

    const again = await POST(promoReq(`${PROMO_COOKIE}=${cookie!.value}`));
    expect((await again.json()).endsAt).toBe(body.endsAt);
    expect(again.cookies.get(PROMO_COOKIE)).toBeUndefined();
  });

  it("textos en ingles si se piden", async () => {
    const body = await (await POST(promoReq(undefined, { locale: "en" }))).json();
    expect(body.offer.copy.title).toBe("Your first month of Pro at 50% off");
  });

  it("una cookie v1 vigente sigue valiendo; una vencida se respeta sin reloj nuevo", async () => {
    const running = signPromoStart(Date.now() - HOUR)!;
    const r1 = await (await POST(promoReq(`${PROMO_COOKIE}=${running}`))).json();
    expect(r1).toMatchObject({ active: true, promoId: LEGACY_PROMO_ID });
    const old = signPromoStart(Date.now() - PROMO_DURATION_MS - HOUR)!;
    const res = await POST(promoReq(`${PROMO_COOKIE}=${old}`));
    expect(await res.json()).toMatchObject({ enabled: true, active: false, expired: true });
    expect(res.cookies.get(PROMO_COOKIE)).toBeUndefined();
  });

  it("con sesion y sin cookie no arranca la promo", async () => {
    const res = await POST(promoReq("sb-abcd-auth-token=base64-xyz"));
    expect(await res.json()).toMatchObject({ enabled: true, active: false, expired: false, endsAt: null });
    expect(res.cookies.get(PROMO_COOKIE)).toBeUndefined();
  });

  it("con la tabla vacia es lo mismo", async () => {
    fake.missingTable = false;
    fake.db.promotions = [];
    expect(await (await POST(promoReq())).json()).toMatchObject({ active: true, promoId: LEGACY_PROMO_ID });
  });

  it("con la base caida desde el arranque, tambien", async () => {
    fake.missingTable = false;
    fake.failReads = true;
    expect(await (await POST(promoReq())).json()).toMatchObject({ active: true, promoId: LEGACY_PROMO_ID });
  });
});

describe("POST /api/promo con promos en la base", () => {
  beforeEach(() => {
    fake.missingTable = false;
  });

  it("con una fila en la base la variable ya no cuenta, aunque la fila este apagada", async () => {
    fake.db.promotions = [live({ enabled: false })];
    const res = await POST(promoReq());
    expect(await res.json()).toEqual({ enabled: false });
    expect(res.cookies.get(PROMO_COOKIE)).toBeUndefined();
  });

  it("sin cuenta: arranca el reloj de la promo con su id, sus textos y sus horas", async () => {
    fake.db.promotions = [live()];
    const res = await POST(promoReq());
    const body = await res.json();
    expect(body).toMatchObject({ active: true, promoId: "promo-a", offer: { id: "promo-a", percentOff: 30, clockHours: 48, copy: { title: "Promo A" } } });
    expect(body.endsAt - body.serverNow).toBe(48 * HOUR);
    expect([...readPromoCookie(res.cookies.get(PROMO_COOKIE)!.value, Date.now()).keys()]).toEqual(["promo-a"]);
  });

  it("el reloj nunca pasa del fin de la promo", async () => {
    fake.db.promotions = [live({ ends_at: new Date(Date.now() + 2 * HOUR).toISOString() })];
    const body = await (await POST(promoReq())).json();
    expect(body.endsAt - body.serverNow).toBeLessThanOrEqual(2 * HOUR);
  });

  it("una cookie de otra promo no reinicia ni presta su reloj: la nueva empieza aparte", async () => {
    fake.db.promotions = [live({ id: "promo-b", stripe_coupon_id: "COUPON_B" })];
    const oldA = writePromoCookie(new Map([["promo-a", Date.now() - 100 * HOUR]]))!;
    const res = await POST(promoReq(`${PROMO_COOKIE}=${oldA}`));
    expect(await res.json()).toMatchObject({ active: true, promoId: "promo-b" });
    const keys = [...readPromoCookie(res.cookies.get(PROMO_COOKIE)!.value, Date.now()).keys()];
    expect(keys.sort()).toEqual(["promo-a", "promo-b"]);
  });

  it("campana: con el utm_campaign de asai_utm gana la de la campana", async () => {
    fake.db.promotions = [live(), live({ id: "promo-utm", audience: "utm", utm_campaign: "Buen-Fin", stripe_coupon_id: "COUPON_U" })];
    const utm = encodeURIComponent(JSON.stringify({ utm_campaign: "buen-fin", ts: "2026-11-05T00:00:00Z" }));
    expect(await (await POST(promoReq(`asai_utm=${utm}`))).json()).toMatchObject({ active: true, promoId: "promo-utm" });
    __resetPromoCache();
    expect(await (await POST(promoReq())).json()).toMatchObject({ active: true, promoId: "promo-a" });
  });

  it("cuenta gratis que nunca tuvo Pro: si; con suscripcion pasada: no", async () => {
    fake.db.promotions = [live({ id: "promo-cuenta", audience: "free_never_pro" })];
    fake.db.profiles = [
      { id: "u-free", tier: "free", stripe_subscription_id: null, subscription_status: "inactive" },
      { id: "u-old", tier: "free", stripe_subscription_id: "sub_1", subscription_status: "canceled" },
    ];
    const session = "sb-abcd-auth-token=base64-xyz";
    getUser.mockResolvedValue({ data: { user: { id: "u-free" } } });
    expect(await (await POST(promoReq(session))).json()).toMatchObject({ active: true, promoId: "promo-cuenta", offer: { audience: "free_never_pro" } });
    getUser.mockResolvedValue({ data: { user: { id: "u-old" } } });
    const no = await POST(promoReq(session));
    expect(await no.json()).toMatchObject({ active: false });
    expect(no.cookies.get(PROMO_COOKIE)).toBeUndefined();
    // Sin sesion no le toca la de cuentas.
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await (await POST(promoReq())).json()).toMatchObject({ active: false });
  });

  it("si la persona crea su cuenta, su reloj de «sin cuenta» se respeta", async () => {
    fake.db.promotions = [live(), live({ id: "promo-cuenta", audience: "free_never_pro", stripe_coupon_id: "COUPON_C" })];
    const a = writePromoCookie(new Map([["promo-a", Date.now() - HOUR]]))!;
    expect(await (await POST(promoReq(`${PROMO_COOKIE}=${a}; sb-abcd-auth-token=x`))).json()).toMatchObject({ active: true, promoId: "promo-a" });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("si dos chocan en el mismo publico, sale la de inicio mas reciente", async () => {
    fake.db.promotions = [
      live({ id: "promo-vieja", starts_at: new Date(Date.now() - 5 * DAY).toISOString() }),
      live({ id: "promo-nueva", starts_at: new Date(Date.now() - DAY).toISOString(), stripe_coupon_id: "COUPON_N" }),
    ];
    expect(await (await POST(promoReq())).json()).toMatchObject({ promoId: "promo-nueva" });
  });

  it("programada o terminada no sale", async () => {
    fake.db.promotions = [
      live({ id: "promo-futura", starts_at: new Date(Date.now() + DAY).toISOString() }),
      live({ id: "promo-pasada", starts_at: new Date(Date.now() - 9 * DAY).toISOString(), ends_at: new Date(Date.now() - DAY).toISOString() }),
    ];
    expect(await (await POST(promoReq())).json()).toEqual({ enabled: false });
  });
});

describe("ayudas del navegador", () => {
  it("formatCountdown da HH:MM:SS y nunca negativo", () => {
    expect(formatCountdown(PROMO_DURATION_MS)).toBe("24:00:00");
    expect(formatCountdown(3 * HOUR + 4 * 60 * 1000 + 5999)).toBe("03:04:05");
    expect(formatCountdown(-10)).toBe("00:00:00");
  });

  it("toPromoState pasa el fin al reloj local y guarda la promo", () => {
    const offer = { id: "promo-a" } as never;
    const st = toPromoState({ enabled: true, active: true, expired: false, endsAt: 10_000, serverNow: 4_000, promoId: "promo-a", offer }, 100_000);
    expect(st).toEqual({ active: true, expired: false, endsAt: 106_000, promoId: "promo-a", offer });
    expect(toPromoState({ enabled: false }, 0)).toBeNull();
    expect(toPromoState(null, 0)).toBeNull();
    expect(toPromoState({ enabled: true, active: false, expired: true, endsAt: 1, serverNow: 2, promoId: "promo-a" }, 5)).toMatchObject({
      active: false,
      expired: true,
      promoId: "promo-a",
      offer: null,
    });
  });

  it("enlaces y rutas", () => {
    expect(promoHref("es")).toBe("/es/login?next=%2Fes%2Fpricing");
    expect(promoHref("en", true)).toBe("/en/pricing");
    expect(isPromoModalExcluded("/es/pricing")).toBe(true);
    expect(isPromoModalExcluded("/en/login")).toBe(true);
    expect(isPromoModalExcluded("/es/prompts")).toBe(false);
  });
});
