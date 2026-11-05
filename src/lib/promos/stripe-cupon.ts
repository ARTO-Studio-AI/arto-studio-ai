import { COUPON_ID_RE, type PromoInput } from "./tipos";

/* Verificacion del cupon de Stripe antes de prender una promo (ficha de Victor del 5 nov
 * 2026). El cupon lo crea Victor en el panel de Stripe; aqui solo se LEE:
 *   GET /v1/coupons/{id}?expand[]=applies_to   (applies_to no viene si no se expande)
 *   GET /v1/prices/{STRIPE_PRICE_ID_PRO}        (para saber el producto y la moneda de Pro)
 * con la misma STRIPE_SECRET_KEY que ya usa el checkout. Este modulo nunca crea, edita ni
 * borra nada en Stripe: solo hace GET, y las pruebas lo comprueban.
 *
 * Tiene que coincidir con lo configurado:
 *   - valid = true (no vencido, no agotado, no borrado),
 *   - tipo: percent_off o amount_off, con el mismo valor; en monto, la misma moneda (y la del
 *     price de Pro),
 *   - duracion: 1 mes = once (o repeating de 1); N meses = repeating con N; forever no vale,
 *   - applies_to.products incluye el producto del price de Pro.
 * La prueba gratis no usa cupon: solo se revisa que el price de Pro exista y sea mensual. */

const STRIPE = "https://api.stripe.com/v1";
const TIMEOUT_MS = 8000;

export interface StripeCoupon {
  id: string;
  valid: boolean;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever" | string;
  duration_in_months: number | null;
  redeem_by: number | null;
  max_redemptions: number | null;
  times_redeemed: number | null;
  applies_to?: { products?: string[] } | null;
}

export interface StripePrice {
  id: string;
  product: string | { id: string };
  currency: string;
  unit_amount: number | null;
  recurring: { interval: string } | null;
  active: boolean;
}

export interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

export interface CouponVerification {
  ok: boolean;
  checks: Check[];
  warnings: string[];
  /** Lo que se leyo del cupon, para guardarlo como constancia. */
  snapshot: Record<string, unknown> | null;
}

const productOf = (p: StripePrice) => (typeof p.product === "string" ? p.product : p.product?.id);

/** Compara el cupon y el price con la promo. Logica pura, para probarla sin Stripe. */
export function compareCoupon(promo: Pick<PromoInput, "kind" | "percentOff" | "amountOffCents" | "currency" | "months" | "endsAt">, coupon: StripeCoupon, price: StripePrice): CouponVerification {
  const checks: Check[] = [];
  const warnings: string[] = [];
  const add = (label: string, ok: boolean, detail: string) => checks.push({ label, ok, detail });

  add("Cupón vigente", coupon.valid === true, coupon.valid ? "Stripe lo marca como válido." : "Stripe lo marca como no válido (vencido, agotado o borrado).");

  if (promo.kind === "percent") {
    const same = coupon.percent_off !== null && Math.abs(coupon.percent_off - (promo.percentOff ?? -1)) < 1e-6;
    add("Porcentaje", same && coupon.amount_off === null, coupon.percent_off !== null ? `Stripe: ${coupon.percent_off}% · aquí: ${promo.percentOff}%` : "El cupón es de monto fijo, no de porcentaje.");
  } else if (promo.kind === "amount") {
    add("Monto", coupon.amount_off === promo.amountOffCents && coupon.percent_off === null, coupon.amount_off !== null ? `Stripe: ${coupon.amount_off} centavos · aquí: ${promo.amountOffCents}` : "El cupón es de porcentaje, no de monto fijo.");
    const cur = (coupon.currency ?? "").toLowerCase();
    add("Moneda", cur === promo.currency && cur === price.currency.toLowerCase(), `Stripe: ${cur || "sin moneda"} · aquí: ${promo.currency} · price de Pro: ${price.currency}`);
    if (price.unit_amount !== null && (coupon.amount_off ?? 0) > price.unit_amount) warnings.push("El descuento es mayor que el precio de Pro: el primer pago queda en cero.");
  }

  const months = promo.months ?? 1;
  const durOk =
    months === 1
      ? coupon.duration === "once" || (coupon.duration === "repeating" && coupon.duration_in_months === 1)
      : coupon.duration === "repeating" && coupon.duration_in_months === months;
  const durText =
    coupon.duration === "repeating" ? `repeating, ${coupon.duration_in_months} meses` : coupon.duration;
  add("Duración", durOk, `Stripe: ${durText} · aquí: ${months === 1 ? "solo el primer pago" : `${months} meses`}`);

  const product = productOf(price);
  const products = coupon.applies_to?.products ?? [];
  add(
    "Solo para Pro",
    Boolean(product) && products.includes(product!),
    products.length ? `Productos del cupón: ${products.join(", ")} · producto de Pro: ${product}` : `El cupón no está limitado a productos; en Stripe tiene que aplicar solo a ${product}.`,
  );

  if (coupon.redeem_by && coupon.redeem_by * 1000 < Date.parse(promo.endsAt)) {
    warnings.push(`El cupón deja de canjearse el ${new Date(coupon.redeem_by * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC, antes del fin de la promo.`);
  }
  if (coupon.max_redemptions) warnings.push(`El cupón tiene tope de ${coupon.max_redemptions} usos (lleva ${coupon.times_redeemed ?? 0}).`);
  if (!price.recurring || price.recurring.interval !== "month") warnings.push("El price de Pro no es mensual.");

  return {
    ok: checks.every((c) => c.ok),
    checks,
    warnings,
    snapshot: {
      id: coupon.id,
      valid: coupon.valid,
      percent_off: coupon.percent_off,
      amount_off: coupon.amount_off,
      currency: coupon.currency,
      duration: coupon.duration,
      duration_in_months: coupon.duration_in_months,
      products,
      price_product: product ?? null,
    },
  };
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function stripeGet<T>(path: string, key: string, fetcher: Fetcher): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetcher(`${STRIPE}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || !body) return { ok: false, status: res.status, message: body?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, data: body };
  } catch (err) {
    return { ok: false, status: 0, message: (err as Error).message };
  }
}

const fail = (label: string, detail: string): CouponVerification => ({ ok: false, checks: [{ label, ok: false, detail }], warnings: [], snapshot: null });

/** Lee el cupon y el price de Pro en Stripe y los compara con la promo. Nunca lanza. */
export async function verifyPromoInStripe(
  promo: Pick<PromoInput, "kind" | "percentOff" | "amountOffCents" | "currency" | "months" | "trialDays" | "couponId" | "endsAt">,
  fetcher: Fetcher = fetch,
): Promise<CouponVerification> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = process.env.STRIPE_PRICE_ID_PRO?.trim();
  if (!key) return fail("Stripe", "Falta STRIPE_SECRET_KEY en este ambiente.");
  if (!priceId) return fail("Price de Pro", "Falta STRIPE_PRICE_ID_PRO en este ambiente.");

  const price = await stripeGet<StripePrice>(`/prices/${encodeURIComponent(priceId)}`, key, fetcher);
  if (!price.ok) return fail("Price de Pro", `No pude leer el price de Pro en Stripe: ${price.message}`);

  if (promo.kind === "trial") {
    const days = promo.trialDays ?? 0;
    const checks: Check[] = [
      { label: "Price de Pro", ok: price.data.active !== false, detail: `${price.data.id} · ${price.data.currency} · ${price.data.active === false ? "archivado" : "activo"}` },
      { label: "Días de prueba", ok: Number.isInteger(days) && days >= 1 && days <= 730, detail: `${days} días (Stripe acepta de 1 a 730).` },
    ];
    return { ok: checks.every((c) => c.ok), checks, warnings: [], snapshot: { trial_days: days, price_product: productOf(price.data) ?? null } };
  }

  if (!promo.couponId || !COUPON_ID_RE.test(promo.couponId)) return fail("Cupón", "El id del cupón no es válido.");
  const coupon = await stripeGet<StripeCoupon>(`/coupons/${encodeURIComponent(promo.couponId)}?expand%5B%5D=applies_to`, key, fetcher);
  if (!coupon.ok) {
    return fail(
      "Cupón",
      coupon.status === 404
        ? `No existe el cupón «${promo.couponId}» en esta cuenta de Stripe (revisa si es de modo de prueba o real).`
        : `No pude leer el cupón en Stripe: ${coupon.message}`,
    );
  }
  return compareCoupon(promo, coupon.data, price.data);
}
