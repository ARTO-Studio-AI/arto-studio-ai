import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakePromosDb, promoRow, type FakePromosDb } from "../../../tests/helpers/fake-promos-db";

/* Escrituras de /admin/promociones (5 nov 2026): prender exige el cupon verificado en
 * Stripe en ese momento, cada cambio deja registro, y sin tabla no se escribe nada. */

let fake: FakePromosDb;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fake.client }));

const { savePromo, setPromoEnabled, changedFields, PromoAdminError } = await import("./admin-server");
const { __resetPromoCache, getSitePromos } = await import("./estado");

const saved = { key: process.env.STRIPE_SECRET_KEY, price: process.env.STRIPE_PRICE_ID_PRO };
const price = { id: "price_pro", product: "prod_pro", currency: "usd", unit_amount: 900, recurring: { interval: "month" }, active: true };
const couponOk = { id: "COUPON_A", valid: true, percent_off: 30, amount_off: null, currency: null, duration: "once", duration_in_months: null, applies_to: { products: ["prod_pro"] } };

function stripe(coupon: object | null) {
  const methods: string[] = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    methods.push(init.method ?? "GET");
    if (url.includes("/prices/")) return new Response(JSON.stringify(price), { status: 200 });
    return coupon ? new Response(JSON.stringify(coupon), { status: 200 }) : new Response(JSON.stringify({ error: { message: "No such coupon" } }), { status: 404 });
  });
  return { fetcher, methods };
}

const input = (over: Record<string, unknown> = {}) => ({
  id: "promo-a",
  name: "Promo A",
  kind: "percent",
  percentOff: 30,
  months: 1,
  couponId: "COUPON_A",
  clockHours: 48,
  audience: "anon",
  startsAt: "2026-11-01T00:00:00.000Z",
  endsAt: "2026-12-01T00:00:00.000Z",
  copy: { es: { title: "T", subtitle: "S", cta: "C", badge: "B" }, en: { title: "T", subtitle: "S", cta: "C", badge: "B" } },
  ...over,
});

beforeEach(() => {
  __resetPromoCache();
  fake = fakePromosDb({ promotions: [], promotion_changes: [] });
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_PRICE_ID_PRO = "price_pro";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [k, v] of [["STRIPE_SECRET_KEY", saved.key], ["STRIPE_PRICE_ID_PRO", saved.price]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("guardar", () => {
  it("crea apagada sin tocar Stripe y deja registro con autor", async () => {
    const s = stripe(couponOk);
    const r = await savePromo({ raw: input(), enable: false, isNew: true, actor: "victor@arto", fetcher: s.fetcher });
    expect(r).toMatchObject({ id: "promo-a", created: true, enabled: false });
    expect(s.fetcher).not.toHaveBeenCalled();
    expect(fake.db.promotions[0]).toMatchObject({ id: "promo-a", enabled: false, created_by: "victor@arto", coupon_verified_at: null });
    expect(fake.db.promotion_changes[0]).toMatchObject({ promotion_id: "promo-a", action: "create", before: null, changed_by: "victor@arto" });
  });

  it("guardar prendida verifica en Stripe (solo GET) y guarda la constancia", async () => {
    const s = stripe(couponOk);
    const r = await savePromo({ raw: input(), enable: true, isNew: true, actor: "v", fetcher: s.fetcher });
    expect(r.enabled).toBe(true);
    expect(s.methods.every((m) => m === "GET")).toBe(true);
    expect(fake.db.promotions[0].coupon_verified_at).toBeTruthy();
    expect(fake.db.promotions[0].coupon_snapshot).toMatchObject({ id: "COUPON_A", percent_off: 30 });
    // La cache se invalida: el sitio la ve al momento en esta instancia.
    expect((await getSitePromos()).promos.map((p) => p.id)).toEqual(["promo-a"]);
  });

  it("si el cupon no coincide no se guarda nada", async () => {
    const s = stripe({ ...couponOk, percent_off: 50 });
    const err = await savePromo({ raw: input(), enable: true, isNew: true, actor: "v", fetcher: s.fetcher }).catch((e) => e);
    expect(err).toBeInstanceOf(PromoAdminError);
    expect(err.status).toBe(409);
    expect(err.verification.ok).toBe(false);
    expect(fake.db.promotions).toHaveLength(0);
    expect(fake.db.promotion_changes).toHaveLength(0);
  });

  it("valida antes de todo; id repetido o inexistente dan error", async () => {
    await expect(savePromo({ raw: input({ percentOff: 0 }), enable: false, isNew: true, actor: "v" })).rejects.toMatchObject({ status: 400 });
    fake.db.promotions = [promoRow()];
    await expect(savePromo({ raw: input(), enable: false, isNew: true, actor: "v" })).rejects.toMatchObject({ status: 409 });
    await expect(savePromo({ raw: input({ id: "otra" }), enable: false, isNew: false, actor: "v" })).rejects.toMatchObject({ status: 404 });
  });

  it("al editar el descuento se borra la verificacion vieja; el registro dice de que a que", async () => {
    fake.db.promotions = [promoRow({ enabled: false })];
    await savePromo({ raw: input({ percentOff: 40, couponId: "COUPON_40" }), enable: false, isNew: false, actor: "ana@arto" });
    expect(fake.db.promotions[0]).toMatchObject({ percent_off: 40, coupon_verified_at: null, updated_by: "ana@arto" });
    const log = fake.db.promotion_changes[0] as { before: Record<string, unknown>; after: Record<string, unknown> };
    const diff = changedFields(log.before, log.after).map((f) => [f.field, f.from, f.to]);
    expect(diff).toEqual(expect.arrayContaining([["percent_off", 30, 40], ["stripe_coupon_id", "COUPON_A", "COUPON_40"]]));
  });

  it("al editar solo textos se conserva la verificacion", async () => {
    fake.db.promotions = [promoRow({ enabled: false, percent_off: "30.00" })];
    await savePromo({ raw: input({ name: "Otro nombre" }), enable: false, isNew: false, actor: "v" });
    expect(fake.db.promotions[0].coupon_verified_at).toBe("2026-11-01T00:00:00.000Z");
  });

  it("avisa si choca con otra del mismo publico", async () => {
    fake.db.promotions = [promoRow({ id: "promo-vieja", starts_at: "2026-10-01T00:00:00.000Z" })];
    const r = await savePromo({ raw: input(), enable: true, isNew: true, actor: "v", fetcher: stripe(couponOk).fetcher });
    expect(r.warnings.join(" ")).toMatch(/Choca con «promo-vieja».*sale «promo-a»/);
  });

  it("sin la tabla no se escribe nada y se dice por que", async () => {
    fake.missingTable = true;
    await expect(savePromo({ raw: input(), enable: false, isNew: true, actor: "v" })).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/migración 0022/) });
  });
});

describe("prender y apagar", () => {
  it("prender vuelve a leer el cupon; si ya no coincide, sigue apagada", async () => {
    fake.db.promotions = [promoRow({ enabled: false })];
    await expect(setPromoEnabled({ id: "promo-a", enabled: true, actor: "v", fetcher: stripe(null).fetcher })).rejects.toMatchObject({ status: 409 });
    expect(fake.db.promotions[0].enabled).toBe(false);
    const r = await setPromoEnabled({ id: "promo-a", enabled: true, actor: "v", fetcher: stripe(couponOk).fetcher });
    expect(r).toMatchObject({ changed: true, enabled: true });
    expect(fake.db.promotions[0].enabled).toBe(true);
    expect(fake.db.promotion_changes.at(-1)).toMatchObject({ action: "enable", before: { enabled: false }, after: { enabled: true }, changed_by: "v" });
  });

  it("apagar no toca Stripe y deja registro", async () => {
    fake.db.promotions = [promoRow({ enabled: true })];
    const s = stripe(couponOk);
    await setPromoEnabled({ id: "promo-a", enabled: false, actor: "v", fetcher: s.fetcher });
    expect(s.fetcher).not.toHaveBeenCalled();
    expect(fake.db.promotions[0].enabled).toBe(false);
    expect(fake.db.promotion_changes.at(-1)).toMatchObject({ action: "disable" });
  });

  it("sin cambio no escribe; id desconocido da 404", async () => {
    fake.db.promotions = [promoRow({ enabled: true })];
    expect(await setPromoEnabled({ id: "promo-a", enabled: true, actor: "v" })).toMatchObject({ changed: false });
    expect(fake.db.promotion_changes).toHaveLength(0);
    await expect(setPromoEnabled({ id: "nada", enabled: true, actor: "v" })).rejects.toMatchObject({ status: 404 });
    await expect(setPromoEnabled({ id: "promo-a", enabled: "si", actor: "v" })).rejects.toMatchObject({ status: 400 });
  });
});
