import { createHmac, timingSafeEqual } from "node:crypto";
import { getDictionary } from "@/i18n/dictionaries";
import { PROMO_DURATION_MS } from "@/lib/promo";
import { clockWindow, runningClock } from "@/lib/promos/eleccion";
import { LEGACY_PROMO_ID, PROMO_ID_RE, type PromoDef } from "@/lib/promos/tipos";

/* Lado servidor de las promociones (PR 123 del 5 nov 2026, generalizado el mismo dia para
 * las promos de /admin/promociones). Ver src/lib/promo.ts y src/lib/promos/.
 *
 * Cookie asai_promo_24h, httpOnly. Dos formatos:
 *   - v1 "v1.<inicio en ms>.<firma>": la del PR 123. No lleva id; cuenta como de la promo
 *     LEGACY_PROMO_ID (la de STRIPE_PROMO_COUPON_24H) y de ninguna otra.
 *   - v2 "v2.<datos>.<firma>": datos = base64url de [[id, inicio], ...], hasta
 *     MAX_ENTRIES relojes. La firma cubre los ids: una cookie de la promo A no sirve para
 *     la B, ni se puede mover el inicio. Guardar varios evita que alguien estrene reloj de
 *     una promo vencida solo por pasar a otra (por ejemplo, al entrar y salir de su cuenta).
 * Firma HMAC-SHA256 con PROMO_SIGNING_SECRET o, si no existe, ARTO_API_KEY_SALT con
 * separacion de dominio (mismo patron que src/lib/roast-share.ts).
 *
 * Cupon de respaldo: STRIPE_PROMO_COUPON_24H. Solo cuenta mientras la base no tiene promos
 * (src/lib/promos/estado.ts); asi la promo de 24 h sigue igual hasta que se pase a la base. */

const V1_RE = /^v1\.(\d{13})\.([A-Za-z0-9_-]{43})$/;
const V2_RE = /^v2\.([A-Za-z0-9_-]{1,1200})\.([A-Za-z0-9_-]{43})$/;
/* Tolerancia por relojes de servidores distintos: un inicio un poco en el futuro vale. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;
export const MAX_ENTRIES = 6;

function secret(): string | null {
  return process.env.PROMO_SIGNING_SECRET?.trim() || process.env.ARTO_API_KEY_SALT?.trim() || null;
}

function signingKey(): string | null {
  const k = secret();
  return k ? `promo-24h-v1:${k}` : null;
}

function signingKeyV2(): string | null {
  const k = secret();
  return k ? `promos-v2:${k}` : null;
}

/** true si hay con que firmar la cookie. Sin esto no hay promo de ningun tipo. */
export function promoSigningReady(): boolean {
  return secret() !== null;
}

/** Id del cupon de la variable de respaldo, o null. */
export function promoCouponId(): string | null {
  const id = process.env.STRIPE_PROMO_COUPON_24H?.trim();
  return id ? id : null;
}

/** true si la promo de respaldo (variable) esta completa: cupon y secreto. */
export function promoConfigured(): boolean {
  return Boolean(promoCouponId() && signingKey());
}

/** La promo de la variable STRIPE_PROMO_COUPON_24H, con los textos del PR 123. */
export function envPromo(): PromoDef | null {
  const couponId = promoCouponId();
  if (!couponId || !signingKey()) return null;
  const copyOf = (locale: "es" | "en") => {
    const d = getDictionary(locale).promo;
    return { title: d.title, subtitle: d.modal_sub, cta: d.cta, badge: d.pricing_badge };
  };
  return {
    id: LEGACY_PROMO_ID,
    name: "Primer mes de Pro al 50% por 24 h (variable STRIPE_PROMO_COUPON_24H)",
    kind: "percent",
    percentOff: 50,
    amountOffCents: null,
    currency: null,
    months: 1,
    trialDays: null,
    couponId,
    clockHours: PROMO_DURATION_MS / 3_600_000,
    audience: "anon",
    utmCampaign: null,
    startsAt: 0,
    endsAt: Number.MAX_SAFE_INTEGER,
    enabled: true,
    copy: { es: copyOf("es"), en: copyOf("en") },
    source: "env",
  };
}

/* ------------------------------------------------------------ cookie v1 (PR 123) */

function signV1(start: number, key: string): string {
  return createHmac("sha256", key).update(`start:${start}`).digest("base64url");
}

/** Cookie v1 para un inicio. Solo la usan las pruebas: el servidor ya escribe v2. */
export function signPromoStart(start: number): string | null {
  const key = signingKey();
  if (!key || !Number.isSafeInteger(start) || start <= 0) return null;
  return `v1.${start}.${signV1(start, key)}`;
}

/** Inicio en ms si la cookie v1 es valida; si no, null. */
export function verifyPromoCookie(raw: string | null | undefined, now: number): number | null {
  if (!raw) return null;
  const key = signingKey();
  if (!key) return null;
  const m = V1_RE.exec(raw);
  if (!m) return null;
  const start = Number(m[1]);
  if (!Number.isSafeInteger(start) || start > now + FUTURE_SKEW_MS) return null;
  const expected = Buffer.from(signV1(start, key));
  const given = Buffer.from(m[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return start;
}

/* ------------------------------------------------------------ cookie v2 */

function signV2(data: string, key: string): string {
  return createHmac("sha256", key).update(`starts:${data}`).digest("base64url");
}

/** Relojes que trae la cookie: id de promo -> inicio en ms. Vacio si no hay o no vale. */
export function readPromoCookie(raw: string | null | undefined, now: number): Map<string, number> {
  const out = new Map<string, number>();
  if (!raw) return out;
  const legacy = verifyPromoCookie(raw, now);
  if (legacy !== null) {
    out.set(LEGACY_PROMO_ID, legacy);
    return out;
  }
  const key = signingKeyV2();
  const m = key ? V2_RE.exec(raw) : null;
  if (!key || !m) return out;
  const expected = Buffer.from(signV2(m[1], key));
  const given = Buffer.from(m[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
  } catch {
    return out;
  }
  if (!Array.isArray(parsed)) return out;
  for (const entry of parsed.slice(0, MAX_ENTRIES)) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [id, start] = entry as [unknown, unknown];
    if (typeof id !== "string" || !PROMO_ID_RE.test(id) || id.length > 60) continue;
    if (typeof start !== "number" || !Number.isSafeInteger(start) || start <= 0 || start > now + FUTURE_SKEW_MS) continue;
    out.set(id, start);
  }
  return out;
}

/** Valor de la cookie v2 con estos relojes (los MAX_ENTRIES mas recientes), o null sin secreto. */
export function writePromoCookie(starts: ReadonlyMap<string, number>): string | null {
  const key = signingKeyV2();
  if (!key) return null;
  const entries = [...starts.entries()]
    .filter(([id, start]) => PROMO_ID_RE.test(id) && Number.isSafeInteger(start) && start > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ENTRIES);
  if (entries.length === 0) return null;
  const data = Buffer.from(JSON.stringify(entries)).toString("base64url");
  return `v2.${data}.${signV2(data, key)}`;
}

/* ------------------------------------------------------------ checkout */

export interface CouponProfile {
  tier?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
}

/** true si la persona nunca tuvo suscripcion. stripe_customer_id no cuenta: se crea al abrir
 * el checkout aunque no se pague. */
export function neverSubscribed(profile: CouponProfile | null): boolean {
  if (profile?.tier && profile.tier !== "free") return false;
  if (profile?.stripe_subscription_id) return false;
  return (profile?.subscription_status ?? "inactive") === "inactive";
}

export interface CheckoutPromo {
  promo: PromoDef;
  start: number;
  endsAt: number;
}

/**
 * Promo que se aplica en el checkout, o null. Solo si:
 *   - la cookie firmada trae un reloj que sigue corriendo para una promo viva (prendida y
 *     dentro de sus fechas), con el id de esa promo en lo firmado,
 *   - el precio es el de Pro mensual,
 *   - la persona nunca tuvo suscripcion.
 */
export function promoForCheckout(input: {
  promos: readonly PromoDef[];
  starts: ReadonlyMap<string, number>;
  now: number;
  priceId: string | null | undefined;
  proMonthlyPriceId: string | null | undefined;
  profile: CouponProfile | null;
}): CheckoutPromo | null {
  const { promos, starts, now, priceId, proMonthlyPriceId, profile } = input;
  if (!priceId || !proMonthlyPriceId || priceId !== proMonthlyPriceId) return null;
  if (!neverSubscribed(profile)) return null;
  const run = runningClock(promos, starts, now);
  if (!run || run.window.endsAt === null) return null;
  const p = run.promo;
  if (p.kind === "trial" ? !p.trialDays : !p.couponId) return null;
  return { promo: p, start: run.start, endsAt: run.window.endsAt };
}

/* Stripe exige que expires_at quede entre 30 min y 24 h despues de crear la sesion. */
const STRIPE_MIN_EXPIRY_MS = 31 * 60 * 1000;
const STRIPE_MAX_EXPIRY_MS = 23 * 60 * 60 * 1000 + 59 * 60 * 1000;

/** expires_at (segundos) para una sesion con promo: el fin del reloj, dentro de los limites
 * de Stripe. Asi el descuento no se puede pagar mucho despues de vencer. */
export function checkoutExpiresAt(endsAt: number | null, now: number): number | null {
  if (endsAt === null || now >= endsAt) return null;
  const at = Math.min(Math.max(endsAt, now + STRIPE_MIN_EXPIRY_MS), now + STRIPE_MAX_EXPIRY_MS);
  return Math.floor(at / 1000);
}

/** Reloj de 24 h de la promo de respaldo (PR 123). Se conserva para las pruebas viejas. */
export function promoWindow(start: number | null, now: number) {
  return clockWindow({ clockHours: PROMO_DURATION_MS / 3_600_000, endsAt: Number.MAX_SAFE_INTEGER }, start, now);
}

/** expires_at de la promo de respaldo a partir de su inicio (PR 123). */
export function promoCheckoutExpiresAt(start: number | null, now: number): number | null {
  const w = promoWindow(start, now);
  return w.active ? checkoutExpiresAt(w.endsAt, now) : null;
}
