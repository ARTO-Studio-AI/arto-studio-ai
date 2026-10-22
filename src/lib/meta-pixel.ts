import { browserAdsAllowed } from "@/lib/consent";

/* Pixel de Meta en el navegador (22 oct 2026, pedido por Victor). Decision D19.
 *
 * Es el conjunto de datos «ARTO Studio AI» (1786082372609082), del portafolio artostudio,
 * conectado a la cuenta publicitaria compartida «ARTO Studio». Es solo de ASAI: Nomina
 * tiene el suyo y cada campaña usa el pixel de su proyecto.
 *
 * Mismas reglas que GA4 (src/lib/ga.ts), con una puerta mas estricta:
 *   - Sin NEXT_PUBLIC_META_PIXEL_ID (o con un valor que no es numerico) todo es no-op.
 *   - Solo con la publicidad aceptada (cookie asai_consent = "all"). «Solo analitica»
 *     carga PostHog y GA, pero no Meta. Si la persona acepta despues, el aviso vuelve a
 *     llamar initAnalytics(), que llama a initMetaPixel().
 *   - Con doNotTrack activo no se carga.
 *   - autoConfig apagado: Meta no lee botones ni microdatos de la pagina por su cuenta.
 *     Solo salen los eventos de esta lista.
 *   - El pixel manda la URL completa de la pagina. La vista compartida del roast lleva el
 *     nombre de la marca y el titular en la query, asi que en cualquier URL con parametros
 *     que no sean utm_* no sale nada hacia Meta.
 *   - revokeMetaPixel() apaga el envio en esta carga (fbq consent revoke) y borra _fbp y _fbc.
 *
 * Eventos (los mismos de AnalyticsEvents, traducidos a los de Meta):
 *   - PageView en cada navegacion (metaPageView, desde GaPageViews).
 *   - roast_completed con source "ai"  -> RoastCompleted (personalizado).
 *   - roast_email_submitted            -> Lead (estandar).
 * Fase 2 (22 oct 2026): src/lib/meta-capi.ts manda RoastCompleted, Lead y
 * CompleteRegistration desde el servidor. Para que Meta no cuente dos veces, el navegador
 * genera el event_id (newMetaEventId), lo manda en el body de la peticion y lo usa aqui. */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: unknown;
  loaded: boolean;
  version: string;
};
type MetaWindow = Window & { fbq?: Fbq; _fbq?: Fbq };

const SCRIPT_ID = "asai-meta-pixel";
let loadedId: string | null = null;
let lastPageView: string | null = null;

/** ID del pixel o null si no esta definido o no es numerico. */
export function metaPixelId(): string | null {
  const raw = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  return raw && /^\d{10,20}$/.test(raw) ? raw : null;
}

function metaDoNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { msDoNotTrack?: string | null };
  const value = nav.doNotTrack ?? (globalThis as { doNotTrack?: string | null }).doNotTrack ?? nav.msDoNotTrack ?? null;
  return value === "1" || value === "yes";
}

/** true si la URL solo trae parametros utm_* (o ninguno). Las demas no salen hacia Meta. */
export function metaSafeUrl(href: string): boolean {
  try {
    for (const key of new URL(href).searchParams.keys()) if (!key.toLowerCase().startsWith("utm_")) return false;
    return true;
  } catch {
    return false;
  }
}

function canSend(): boolean {
  if (typeof window === "undefined" || typeof location === "undefined" || !loadedId) return false;
  return browserAdsAllowed() && metaSafeUrl(location.href);
}

/** Carga fbevents.js una sola vez si hay ID, publicidad aceptada y no hay DNT. Nunca lanza. */
export function initMetaPixel(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const id = metaPixelId();
  if (!id || !browserAdsAllowed() || metaDoNotTrack()) return false;
  const w = window as unknown as MetaWindow;
  try {
    if (loadedId === id && w.fbq) {
      w.fbq("consent", "grant");
      metaPageView();
      return true;
    }
    if (!w.fbq) {
      // Cola estandar de Meta: guarda las llamadas hasta que carga fbevents.js.
      const fbq = function (...args: unknown[]) {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
      } as Fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      w.fbq = fbq;
      w._fbq = fbq;
    }
    w.fbq!("set", "autoConfig", false, id);
    w.fbq!("consent", "grant");
    w.fbq!("init", id);
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    loadedId = id;
    metaPageView();
    return true;
  } catch {
    return false;
  }
}

/** PageView de la pagina actual. Una por URL. Nunca lanza. */
export function metaPageView(): void {
  if (!canSend()) return;
  const href = location.href;
  if (href === lastPageView) return;
  try {
    (window as unknown as MetaWindow).fbq?.("track", "PageView");
    lastPageView = href;
  } catch {
    /* nunca romper la UI por publicidad */
  }
}

/** event_id para juntar el evento del pixel con el de la API de conversiones. */
export function newMetaEventId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* sin crypto: cae al de abajo */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Traduce un evento de AnalyticsEvents al de Meta, si tiene uno. Nunca lanza.
 * eventId es el mismo que se mando al servidor (dedupe con la API de conversiones). */
export function metaEvent(name: string, props: Record<string, unknown>, eventId?: string): void {
  if (!canSend()) return;
  const fbq = (window as unknown as MetaWindow).fbq;
  const options = eventId ? { eventID: eventId } : undefined;
  try {
    if (name === "roast_completed" && props.source === "ai") {
      fbq?.("trackCustom", "RoastCompleted", { industry: props.industry, overall: props.overall }, options);
    } else if (name === "roast_email_submitted") {
      fbq?.("track", "Lead", { content_name: "roast_report", content_category: props.industry }, options);
    }
  } catch {
    /* nunca romper la UI por publicidad */
  }
}

/** La persona retiro la publicidad: el pixel deja de enviar y se borran _fbp y _fbc. */
export function revokeMetaPixel(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    (window as unknown as MetaWindow).fbq?.("consent", "revoke");
  } catch {
    /* nunca romper la UI por publicidad */
  }
  lastPageView = null;
  // fbevents.js escribe _fbp con domain= explicito (el dominio registrable, o el host
  // completo cuando es un sufijo publico como vercel.app). Una cookie con domain= no se
  // borra sin el mismo domain=, asi que se intenta sin dominio, con el host y con el padre.
  const host = typeof location === "undefined" ? "" : location.hostname;
  const labels = host.split(".");
  const domains = ["", host ? `; domain=${host}` : "", labels.length > 1 ? `; domain=.${labels.slice(-2).join(".")}` : ""];
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name !== "_fbp" && name !== "_fbc") continue;
    for (const domain of new Set(domains)) document.cookie = `${name}=; path=/; max-age=0; samesite=lax${domain}`;
  }
}

/** Solo para pruebas: vuelve al estado inicial del modulo. */
export function __resetMetaPixelForTests(): void {
  loadedId = null;
  lastPageView = null;
}
