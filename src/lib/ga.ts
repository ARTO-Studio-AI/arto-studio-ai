import { browserConsent } from "@/lib/consent";

/* Google Analytics 4 en el navegador (20 oct 2026, pedido por Victor). Decision D17.
 *
 * Mismas reglas que PostHog (src/lib/analytics.ts):
 *   - Sin NEXT_PUBLIC_GA_MEASUREMENT_ID (o con un valor que no parece "G-XXXX") todo es
 *     no-op. Un sitio sin analitica es mejor que un sitio caido.
 *   - Sin consentimiento de analitica (cookie asai_consent = "all") no se carga el script
 *     de Google ni se escribe ninguna cookie _ga. Si la persona acepta despues, el aviso
 *     vuelve a llamar initAnalytics(), que llama a initGA().
 *   - Con doNotTrack activo no se carga.
 *   - Solo analitica: Google Signals, personalizacion de anuncios y almacenamiento de
 *     anuncios quedan apagados (Consent Mode v2 en "denied" para todo lo de anuncios).
 *     El aviso de cookies promete «no usamos cookies de publicidad».
 *   - revokeGA() apaga la medicion en esta carga y borra las cookies _ga y _ga_<id>.
 *
 * Vistas de pagina: el page_view automatico va apagado (send_page_view: false) y se
 * manda a mano con gaPageView() desde GaPageViews, con la URL limpia: sin query salvo los
 * utm_*, y en /roast con un titulo fijo. La vista compartida del roast lleva el nombre de
 * la marca y el titular en la query y en el <title>; eso no sale hacia Google (auditoria de
 * Fable, PR #100). En el flujo web de GA4 hay que apagar «Cambios de pagina basados en
 * eventos del historial» de la medicion mejorada, o habra vistas duplicadas con la URL
 * completa.
 *
 * Los eventos tipados de AnalyticsEvents se reenvian desde track() con el mismo nombre que
 * en PostHog, para que los dos tableros se lean igual. */

type Gtag = (...args: unknown[]) => void;
type GaWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag } & Record<string, unknown>;

const SCRIPT_ID = "asai-ga4";
const ROAST_TITLE = "Brand Roast · ARTO Studio AI";
let loadedId: string | null = null;
let realGtag: Gtag | null = null;
let lastPageView: string | null = null;

/** Measurement ID de GA4 o null si no esta definido o no tiene la forma G-XXXX. */
export function gaMeasurementId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim().toUpperCase();
  return raw && /^G-[A-Z0-9]{4,20}$/.test(raw) ? raw : null;
}

function gaDoNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { msDoNotTrack?: string | null };
  const value = nav.doNotTrack ?? (globalThis as { doNotTrack?: string | null }).doNotTrack ?? nav.msDoNotTrack ?? null;
  return value === "1" || value === "yes";
}

/** URL que se manda a GA: origen y ruta, y de la query solo los utm_*. */
export function gaPageLocation(href: string): string {
  try {
    const url = new URL(href);
    const kept = new URLSearchParams();
    for (const [key, value] of url.searchParams) if (key.toLowerCase().startsWith("utm_")) kept.append(key, value);
    const query = kept.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
  } catch {
    return "";
  }
}

/** Titulo que se manda a GA. En /roast es fijo: el de la vista compartida lleva la marca. */
export function gaPageTitle(pathname: string, title: string): string {
  return /(^|\/)roast\/?$/.test(pathname) ? ROAST_TITLE : title;
}

/** Carga gtag.js una sola vez si hay ID, consentimiento y no hay DNT. Nunca lanza. */
export function initGA(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const id = gaMeasurementId();
  if (!id || browserConsent() !== "all" || gaDoNotTrack()) return false;
  const w = window as unknown as GaWindow;
  try {
    // Si la persona habia retirado el consentimiento en esta misma carga, se reactiva.
    w[`ga-disable-${id}`] = false;
    if (loadedId === id && realGtag) {
      w.gtag = realGtag;
      w.gtag("consent", "update", { analytics_storage: "granted" });
      gaPageView();
      return true;
    }
    w.dataLayer = w.dataLayer ?? [];
    realGtag = function gtag() {
      // gtag.js espera el objeto arguments, no un arreglo.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag = realGtag;
    w.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    w.gtag("js", new Date());
    w.gtag("config", id, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      // Las vistas de pagina van a mano, con la URL limpia (gaPageView).
      send_page_view: false,
      // La cookie _ga queda en creative.artostudio.ai, igual que ph_*, y revokeGA() la puede borrar.
      cookie_domain: "none",
    });
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(script);
    }
    loadedId = id;
    gaPageView();
    return true;
  } catch {
    return false;
  }
}

/** Manda la vista de la pagina actual con la URL limpia. Una por URL. Nunca lanza. */
export function gaPageView(): void {
  if (typeof window === "undefined" || typeof location === "undefined" || !loadedId) return;
  if (browserConsent() !== "all") return;
  const pageLocation = gaPageLocation(location.href);
  if (!pageLocation || pageLocation === lastPageView) return;
  const w = window as unknown as GaWindow;
  try {
    w.gtag?.("event", "page_view", {
      page_location: pageLocation,
      page_title: gaPageTitle(location.pathname, typeof document === "undefined" ? "" : document.title),
    });
    lastPageView = pageLocation;
  } catch {
    /* nunca romper la UI por analitica */
  }
}

/** Reenvia un evento a GA4. No-op si GA no esta cargado. Nunca lanza. */
export function gaEvent(name: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined" || !loadedId) return;
  if (browserConsent() !== "all") return;
  const w = window as unknown as GaWindow;
  try {
    w.gtag?.("event", name, params);
  } catch {
    /* nunca romper la UI por analitica */
  }
}

/** La persona retiro el consentimiento: GA deja de medir y se borran _ga y _ga_<id>. */
export function revokeGA(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const w = window as unknown as GaWindow;
  const id = loadedId ?? gaMeasurementId();
  try {
    if (id) w[`ga-disable-${id}`] = true;
    realGtag?.("consent", "update", { analytics_storage: "denied" });
    // Cinturon: hasta que vuelva a aceptar, nada de lo que llame a window.gtag llega a Google.
    if (realGtag) w.gtag = () => {};
  } catch {
    /* nunca romper la UI por analitica */
  }
  lastPageView = null;
  const labels = typeof location === "undefined" ? [] : location.hostname.split(".");
  const parent = labels.length > 1 ? `; domain=.${labels.slice(-2).join(".")}` : "";
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name || !(name === "_ga" || name.startsWith("_ga_"))) continue;
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
    if (parent) document.cookie = `${name}=; path=/; max-age=0; samesite=lax${parent}`;
  }
}

/** Solo para pruebas: vuelve al estado inicial del modulo. */
export function __resetGAForTests(): void {
  loadedId = null;
  realGtag = null;
  lastPageView = null;
}
