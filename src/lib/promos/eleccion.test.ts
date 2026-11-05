import { describe, expect, it } from "vitest";
import { audienceKey, clockWindow, collisions, isLive, promoForVisitor, runningClock, winners } from "./eleccion";
import { copyProblems, discountSummary, priceView, validatePromo, type PromoDef } from "./tipos";
import { getDictionary } from "@/i18n/dictionaries";

/* Eleccion de la promo activa (fechas, publico, choque) y validacion (5 nov 2026). */

const H = 3_600_000;
const D = 24 * H;
const NOW = Date.parse("2026-11-05T12:00:00Z");
const copy = { title: "T", subtitle: "S", cta: "C", badge: "B" };

function p(over: Partial<PromoDef> = {}): PromoDef {
  return {
    id: "a",
    name: "A",
    kind: "percent",
    percentOff: 50,
    amountOffCents: null,
    currency: null,
    months: 1,
    trialDays: null,
    couponId: "C",
    clockHours: 24,
    audience: "anon",
    utmCampaign: null,
    startsAt: NOW - D,
    endsAt: NOW + D,
    enabled: true,
    copy: { es: copy, en: copy },
    source: "db",
    ...over,
  };
}

const anon = { signedIn: false, neverPro: null, utmCampaign: null };

describe("fechas y apagado", () => {
  it("viva solo prendida y entre inicio y fin (el fin no cuenta)", () => {
    expect(isLive(p(), NOW)).toBe(true);
    expect(isLive(p({ enabled: false }), NOW)).toBe(false);
    expect(isLive(p({ startsAt: NOW + 1 }), NOW)).toBe(false);
    expect(isLive(p({ startsAt: NOW }), NOW)).toBe(true);
    expect(isLive(p({ endsAt: NOW }), NOW)).toBe(false);
  });

  it("se prende y se apaga sola a su hora", () => {
    const promo = p({ startsAt: NOW + H, endsAt: NOW + 2 * H });
    expect(promoForVisitor([promo], anon, NOW)).toBeNull();
    expect(promoForVisitor([promo], anon, NOW + H)?.id).toBe("a");
    expect(promoForVisitor([promo], anon, NOW + 2 * H)).toBeNull();
  });
});

describe("publico", () => {
  const promos = [
    p({ id: "sin-cuenta" }),
    p({ id: "cuentas", audience: "free_never_pro" }),
    p({ id: "campana", audience: "utm", utmCampaign: "Buen-Fin" }),
  ];

  it("sin cuenta, cuenta que nunca tuvo Pro y campana", () => {
    expect(promoForVisitor(promos, anon, NOW)?.id).toBe("sin-cuenta");
    expect(promoForVisitor(promos, { signedIn: true, neverPro: true, utmCampaign: null }, NOW)?.id).toBe("cuentas");
    expect(promoForVisitor(promos, { ...anon, utmCampaign: " buen-fin " }, NOW)?.id).toBe("campana");
    expect(promoForVisitor(promos, { ...anon, utmCampaign: "otra" }, NOW)?.id).toBe("sin-cuenta");
  });

  it("con sesion de quien tuvo Pro (o sin saber) no sale nada, ni la de campana", () => {
    expect(promoForVisitor(promos, { signedIn: true, neverPro: false, utmCampaign: "buen-fin" }, NOW)).toBeNull();
    expect(promoForVisitor(promos, { signedIn: true, neverPro: null, utmCampaign: null }, NOW)).toBeNull();
    expect(promoForVisitor(promos, { signedIn: true, neverPro: true, utmCampaign: "buen-fin" }, NOW)?.id).toBe("campana");
  });

  it("cada campana es su propio publico", () => {
    expect(audienceKey(p({ audience: "utm", utmCampaign: "X" }))).toBe("utm:x");
    expect(audienceKey(p())).toBe("anon");
  });
});

describe("choque: una por publico, gana la de inicio mas reciente", () => {
  const vieja = p({ id: "vieja", startsAt: NOW - 3 * D, endsAt: NOW + 3 * D });
  const nueva = p({ id: "nueva", startsAt: NOW - D, endsAt: NOW + D });

  it("sale la de inicio mas reciente y /admin ve el choque", () => {
    expect(winners([vieja, nueva], NOW).get("anon")?.id).toBe("nueva");
    expect(collisions([vieja, nueva])).toEqual([{ audience: "anon", ids: ["nueva", "vieja"], winner: "nueva" }]);
  });

  it("al terminar la nueva vuelve la vieja", () => {
    expect(promoForVisitor([vieja, nueva], anon, NOW + D)?.id).toBe("vieja");
  });

  it("no chocan si son de publicos distintos, si una esta apagada o si las fechas no se enciman", () => {
    expect(collisions([vieja, { ...nueva, audience: "free_never_pro" }])).toEqual([]);
    expect(collisions([vieja, { ...nueva, enabled: false }])).toEqual([]);
    expect(collisions([p({ id: "x", endsAt: NOW }), p({ id: "y", startsAt: NOW, endsAt: NOW + D })])).toEqual([]);
  });

  it("a quien ya le corria el reloj de la vieja se le respeta", () => {
    const run = runningClock([vieja, nueva], new Map([["vieja", NOW - H]]), NOW);
    expect(run?.promo.id).toBe("vieja");
  });
});

describe("reloj", () => {
  it("dura clockHours y se corta al fin de la promo", () => {
    expect(clockWindow(p({ clockHours: 48, endsAt: NOW + 10 * D }), NOW, NOW)).toEqual({ active: true, expired: false, endsAt: NOW + 48 * H });
    expect(clockWindow(p({ clockHours: 48, endsAt: NOW + H }), NOW, NOW).endsAt).toBe(NOW + H);
    expect(clockWindow(p(), NOW - 25 * H, NOW)).toMatchObject({ active: false, expired: true });
    expect(clockWindow(p(), null, NOW)).toEqual({ active: false, expired: false, endsAt: null });
  });
});

describe("validatePromo", () => {
  const ok = {
    id: "buen-fin-30",
    name: "Buen Fin",
    kind: "percent",
    percentOff: "30",
    months: 3,
    couponId: "BUENFIN30",
    clockHours: 48,
    audience: "anon",
    startsAt: "2026-11-10T06:00:00Z",
    endsAt: "2026-11-18T06:00:00Z",
    copy: { es: copy, en: copy },
  };

  it("normaliza y deja en null lo que no aplica al tipo", () => {
    const { promo, errors } = validatePromo({ ...ok, trialDays: 7, amountOffCents: 100, utmCampaign: "x" });
    expect(errors).toEqual([]);
    expect(promo).toMatchObject({ percentOff: 30, months: 3, trialDays: null, amountOffCents: null, utmCampaign: null });
  });

  it("prueba gratis no lleva cupon; monto pide moneda; campana pide utm", () => {
    expect(validatePromo({ ...ok, kind: "trial", trialDays: 7 }).promo).toMatchObject({ couponId: null, months: null, trialDays: 7 });
    expect(validatePromo({ ...ok, kind: "amount", amountOffCents: 450 }).errors.join(" ")).toMatch(/Moneda/);
    expect(validatePromo({ ...ok, audience: "utm" }).errors.join(" ")).toMatch(/utm_campaign/);
  });

  it("rechaza lo invalido", () => {
    const bad = (over: object) => validatePromo({ ...ok, ...over }).errors.length > 0;
    expect(bad({ id: "Con Mayus" })).toBe(true);
    expect(bad({ percentOff: 0 })).toBe(true);
    expect(bad({ percentOff: 101 })).toBe(true);
    expect(bad({ percentOff: 12.345 })).toBe(true);
    expect(bad({ percentOff: 12.5 })).toBe(false);
    expect(bad({ months: 0 })).toBe(true);
    expect(bad({ couponId: "con espacio" })).toBe(true);
    expect(bad({ clockHours: 0 })).toBe(true);
    expect(bad({ clockHours: 721 })).toBe(true);
    expect(bad({ endsAt: ok.startsAt })).toBe(true);
    expect(bad({ copy: { es: { ...copy, title: "" }, en: copy } })).toBe(true);
    expect(bad({ copy: { es: { ...copy, title: "Ahorra \u2014 ya" }, en: copy } })).toBe(true);
    expect(bad({ copy: { es: copy, en: { ...copy, subtitle: "A seamless upgrade" } } })).toBe(true);
  });

  it("copyProblems encuentra guion largo y palabras prohibidas, sin falsos positivos", () => {
    expect(copyProblems("Tu primer mes al 50%")).toEqual([]);
    expect(copyProblems("Elevate your work")).toEqual(["usa la palabra «elevate»"]);
    expect(copyProblems("cutting edge")).toHaveLength(1);
    expect(copyProblems("Eleva tu trabajo")).toEqual([]);
  });
});

describe("precio que se pinta", () => {
  const t = getDictionary("es").promo;
  it("porcentaje, monto, varios meses y prueba gratis", () => {
    expect(priceView({ kind: "percent", percentOff: 50, amountOffCents: null, months: 1, trialDays: null, clockHours: 24 }, t)).toMatchObject({
      strike: "$9",
      now: "$4.50",
      unit: "el primer mes",
      eyebrow: "Solo 24 horas",
    });
    expect(priceView({ kind: "amount", percentOff: null, amountOffCents: 400, months: 3, trialDays: null, clockHours: 1 }, t)).toMatchObject({
      now: "$5",
      unit: "los primeros 3 meses",
      eyebrow: "Solo 1 hora",
    });
    expect(priceView({ kind: "amount", percentOff: null, amountOffCents: 5000, months: 1, trialDays: null, clockHours: 72 }, t).now).toBe("$0");
    expect(priceView({ kind: "trial", percentOff: null, amountOffCents: null, months: null, trialDays: 7, clockHours: 48 }, t)).toMatchObject({
      strike: null,
      now: "Gratis",
      unit: "por 7 días",
    });
  });

  it("resumen para /admin", () => {
    expect(discountSummary(p())).toBe("50% el primer pago");
    expect(discountSummary(p({ kind: "amount", percentOff: null, amountOffCents: 250, currency: "usd", months: 3 }))).toBe("2.50 USD durante 3 meses");
    expect(discountSummary(p({ kind: "trial", trialDays: 14 }))).toBe("14 días de prueba gratis");
  });
});
