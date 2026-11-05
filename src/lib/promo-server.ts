import { createHmac, timingSafeEqual } from "node:crypto";
import { PROMO_DURATION_MS } from "@/lib/promo";

/* Lado servidor de la promo de 24 horas (5 nov 2026). Ver src/lib/promo.ts.
 *
 * Cookie: "v1.<inicio en ms>.<firma>", httpOnly. La firma es HMAC-SHA256 con
 * PROMO_SIGNING_SECRET o, si no existe, ARTO_API_KEY_SALT con separacion de dominio
 * (mismo patron que src/lib/roast-share.ts). Sin la firma correcta el inicio no vale:
 * nadie puede escribirse una cookie con un reloj nuevo o mas largo.
 *
 * Cupon: STRIPE_PROMO_COUPON_24H, lo crea Victor en el panel de Stripe. Sin el, la
 * promocion queda apagada en todo el sitio. */

const COOKIE_RE = /^v1\.(\d{13})\.([A-Za-z0-9_-]{43})$/;
/* Tolerancia por relojes de servidores distintos: un inicio un poco en el futuro vale. */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function signingKey(): string | null {
  const k = process.env.PROMO_SIGNING_SECRET?.trim() || process.env.ARTO_API_KEY_SALT?.trim();
  return k ? `promo-24h-v1:${k}` : null;
}

/** Id del cupon de Stripe o null si no esta configurado. */
export function promoCouponId(): string | null {
  const id = process.env.STRIPE_PROMO_COUPON_24H?.trim();
  return id ? id : null;
}

/** true solo si existe el cupon y un secreto para firmar. Si no, la promo no existe. */
export function promoConfigured(): boolean {
  return Boolean(promoCouponId() && signingKey());
}

function sign(start: number, key: string): string {
  return createHmac("sha256", key).update(`start:${start}`).digest("base64url");
}

/** Valor de la cookie para un inicio dado, o null sin secreto. */
export function signPromoStart(start: number): string | null {
  const key = signingKey();
  if (!key || !Number.isSafeInteger(start) || start <= 0) return null;
  return `v1.${start}.${sign(start, key)}`;
}

/** Inicio en ms si la cookie es valida (firma correcta, fecha razonable); si no, null. */
export function verifyPromoCookie(raw: string | null | undefined, now: number): number | null {
  if (!raw) return null;
  const key = signingKey();
  if (!key) return null;
  const m = COOKIE_RE.exec(raw);
  if (!m) return null;
  const start = Number(m[1]);
  if (!Number.isSafeInteger(start) || start > now + FUTURE_SKEW_MS) return null;
  const expected = Buffer.from(sign(start, key));
  const given = Buffer.from(m[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return start;
}

export interface PromoWindow {
  active: boolean;
  expired: boolean;
  endsAt: number | null;
}

/** Estado de la ventana de 24 h a partir del inicio. Sin inicio: ni activa ni vencida. */
export function promoWindow(start: number | null, now: number): PromoWindow {
  if (start === null) return { active: false, expired: false, endsAt: null };
  const endsAt = start + PROMO_DURATION_MS;
  return { active: now < endsAt, expired: now >= endsAt, endsAt };
}

export interface CouponProfile {
  tier?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
}

/**
 * Cupon a aplicar en el checkout o null. Solo se aplica si:
 *   - existe STRIPE_PROMO_COUPON_24H (couponId),
 *   - la cookie firmada sigue dentro de sus 24 h,
 *   - el precio es el de Pro mensual,
 *   - la persona nunca tuvo suscripcion (sin stripe_subscription_id y estado inactive).
 * stripe_customer_id no cuenta: se crea al abrir el checkout aunque no se pague.
 */
export function couponForCheckout(input: {
  couponId: string | null;
  start: number | null;
  now: number;
  priceId: string | null | undefined;
  proMonthlyPriceId: string | null | undefined;
  profile: CouponProfile | null;
}): string | null {
  const { couponId, start, now, priceId, proMonthlyPriceId, profile } = input;
  if (!couponId) return null;
  if (!promoWindow(start, now).active) return null;
  if (!priceId || !proMonthlyPriceId || priceId !== proMonthlyPriceId) return null;
  if (profile?.tier && profile.tier !== "free") return null;
  if (profile?.stripe_subscription_id) return null;
  const status = profile?.subscription_status ?? "inactive";
  if (status !== "inactive") return null;
  return couponId;
}

/* Stripe exige que expires_at quede entre 30 min y 24 h despues de crear la sesion. */
const STRIPE_MIN_EXPIRY_MS = 31 * 60 * 1000;
const STRIPE_MAX_EXPIRY_MS = 23 * 60 * 60 * 1000 + 59 * 60 * 1000;

/** expires_at (segundos) para una sesion con cupon: el fin de las 24 h, dentro de los
 * limites de Stripe. Asi el descuento no se puede pagar mucho despues de vencer. */
export function promoCheckoutExpiresAt(start: number | null, now: number): number | null {
  const w = promoWindow(start, now);
  if (!w.active || w.endsAt === null) return null;
  const at = Math.min(Math.max(w.endsAt, now + STRIPE_MIN_EXPIRY_MS), now + STRIPE_MAX_EXPIRY_MS);
  return Math.floor(at / 1000);
}
