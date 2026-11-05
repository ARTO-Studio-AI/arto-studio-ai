import type { Locale } from "@/i18n/config";
import type { PromoOffer } from "@/lib/promos/tipos";

/* Promociones en el navegador. Nacio con «Primer mes de Pro al 50%» por 24 horas (decision
 * de Victor, 5 nov 2026) y desde el mismo dia sirve a cualquier promo de
 * /admin/promociones (src/lib/promos/). Esta parte no usa node:crypto: la leen los
 * componentes del navegador. La firma de la cookie y la decision del descuento viven en
 * src/lib/promo-server.ts y src/lib/promos/.
 *
 * Reglas:
 *   - El reloj es real. Empieza en la primera visita de quien entra en el publico de la promo
 *     y se guarda en una cookie httpOnly firmada por el servidor (POST /api/promo), con el id
 *     de la promo. Recargar o volver no lo reinicia; el navegador solo pinta lo que el
 *     servidor le dice, textos y precio incluidos.
 *   - Sin promos vivas (ni en la base ni en STRIPE_PROMO_COUPON_24H) no hay nada: ni reloj,
 *     ni ventana, ni precio con descuento. */

export const PROMO_COOKIE = "asai_promo_24h";
export const PROMO_DURATION_MS = 24 * 60 * 60 * 1000;
/* La cookie vive mas que la promo para recordar que ya vencio (si no, una visita despues
 * del dia 2 volveria a empezar las 24 h). 400 dias es el tope de Chrome. */
export const PROMO_COOKIE_MAX_AGE_S = 400 * 24 * 60 * 60;
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
  /** Id de la promo del reloj (activa o vencida), para los eventos. */
  promoId?: string | null;
  /** Lo que se pinta de la promo activa, en el idioma pedido. */
  offer?: PromoOffer | null;
}

/** Estado de la promo en el navegador, con endsAt ya pasado al reloj local. */
export interface PromoState {
  active: boolean;
  expired: boolean;
  endsAt: number | null;
  promoId: string | null;
  offer: PromoOffer | null;
}

/** Convierte la respuesta del servidor al reloj local, para que un reloj de la
 * computadora mal puesto no alargue ni acorte la oferta. */
export function toPromoState(data: PromoApiResponse | null | undefined, clientNow: number): PromoState | null {
  if (!data || !data.enabled) return null;
  const endsAt =
    typeof data.endsAt === "number" && typeof data.serverNow === "number"
      ? clientNow + (data.endsAt - data.serverNow)
      : null;
  const active = Boolean(data.active) && endsAt !== null && endsAt > clientNow && Boolean(data.offer);
  return {
    active,
    expired: !active && Boolean(data.expired || data.active),
    endsAt: active ? endsAt : null,
    promoId: data.promoId ?? data.offer?.id ?? null,
    offer: active ? (data.offer ?? null) : null,
  };
}

/** HH:MM:SS de lo que falta. Nunca negativo. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Registro que vuelve a /pricing, donde se ve y se paga el precio con descuento. Con
 * sesion se va directo a /pricing. */
export function promoHref(locale: Locale, signedIn = false): string {
  if (signedIn) return `/${locale}/pricing`;
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
  /** Con sesion la barra de registro no sale; la de promo solo si la promo es para cuentas
   * (las de «sin cuenta» se siguen viendo en /pricing, como en el PR 123). */
  signedIn?: boolean;
}): BarMode {
  const promoOn = opts.promoEnabled && Boolean(opts.promo?.active);
  if (opts.signedIn) return promoOn && opts.promo?.offer?.audience !== "anon" ? "promo" : "off";
  if (promoOn) return "promo";
  return opts.signupTriggered ? "signup" : "off";
}
