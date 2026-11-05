import type { Locale } from "@/i18n/config";

/* Promocion «Primer mes de Pro al 50%» por 24 horas (decision de Victor, 5 nov 2026).
 * Esta parte no usa node:crypto: la leen los componentes del navegador. La firma de la
 * cookie y la decision del cupon viven en src/lib/promo-server.ts.
 *
 * Reglas:
 *   - El reloj es real. Las 24 h empiezan en la primera visita sin sesion y se guardan en
 *     una cookie httpOnly firmada por el servidor (POST /api/promo). Recargar o volver no
 *     las reinicia; el navegador solo pinta lo que el servidor le dice.
 *   - Sin STRIPE_PROMO_COUPON_24H (o sin secreto de firma) la promocion entera se apaga:
 *     ni reloj, ni ventana, ni precio con descuento. */

export const PROMO_COOKIE = "asai_promo_24h";
export const PROMO_DURATION_MS = 24 * 60 * 60 * 1000;
/* La cookie vive mas que la promo para recordar que ya vencio (si no, una visita despues
 * del dia 2 volveria a empezar las 24 h). 400 dias es el tope de Chrome. */
export const PROMO_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;
export const PROMO_PRICE_USD = 9;
export const PROMO_FIRST_MONTH_USD = 4.5;
export const PROMO_MODAL_SEEN_KEY = "asai_promo_modal_seen";
export const PROMO_EXPIRED_SEEN_KEY = "asai_promo_expired_seen";
export const PROMO_MODAL_DELAY_MS = 6000;
export const PROMO_MODAL_SCROLL_PX = 240;

/** Lo que responde POST /api/promo. */
export interface PromoApiResponse {
  enabled: boolean;
  active?: boolean;
  expired?: boolean;
  endsAt?: number | null;
  serverNow?: number;
}

/** Estado de la promo en el navegador, con endsAt ya pasado al reloj local. */
export interface PromoState {
  active: boolean;
  expired: boolean;
  endsAt: number | null;
}

/** Convierte la respuesta del servidor al reloj local, para que un reloj de la
 * computadora mal puesto no alargue ni acorte la oferta. */
export function toPromoState(data: PromoApiResponse | null | undefined, clientNow: number): PromoState | null {
  if (!data || !data.enabled) return null;
  const endsAt =
    typeof data.endsAt === "number" && typeof data.serverNow === "number"
      ? clientNow + (data.endsAt - data.serverNow)
      : null;
  const active = Boolean(data.active) && endsAt !== null && endsAt > clientNow;
  return { active, expired: !active && Boolean(data.expired || data.active), endsAt: active ? endsAt : null };
}

/** HH:MM:SS de lo que falta. Nunca negativo. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Registro que vuelve a /pricing, donde se ve y se paga el precio con descuento. */
export function promoHref(locale: Locale): string {
  return `/${locale}/login?next=${encodeURIComponent(`/${locale}/pricing`)}`;
}

/** Rutas donde la ventana grande no sale: el registro, la cuenta y /pricing (ahi la
 * oferta ya esta en la tarjeta de Pro y la ventana solo estorbaria la compra). */
export function isPromoModalExcluded(pathname: string): boolean {
  const rest = pathname.replace(/^\/(?:es|en)(?=\/|$)/, "");
  return /^\/(?:login|account|pricing)(?:\/|$)/.test(rest);
}

/** Que version de la barra se pinta. "off" = nada; "promo" = oferta con reloj;
 * "signup" = la invitacion de siempre a crear cuenta gratis. */
export type BarMode = "off" | "promo" | "signup";

export function barMode(opts: {
  promoEnabled: boolean;
  promo: PromoState | null;
  /** La barra normal ya cumplio su disparador (scroll o segunda pagina). */
  signupTriggered: boolean;
}): BarMode {
  if (opts.promoEnabled && opts.promo?.active) return "promo";
  return opts.signupTriggered ? "signup" : "off";
}
