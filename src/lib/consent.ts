/* Consentimiento de cookies (H-48, 9 oct 2026).
 *
 * La cookie `asai_consent` guarda lo que eligio la persona en el aviso de cookies:
 *   - "essential": solo lo necesario para que el sitio funcione (sesion, idioma,
 *     contador free, esta misma cookie). Es el default: sin respuesta no hay analitica.
 *   - "analytics": ademas PostHog (analitica de producto), Google Analytics 4 y `asai_utm`
 *     (atribucion de primera visita).
 *   - "all": la analitica y ademas el pixel de Meta (publicidad), que mide que anuncios
 *     traen gente al roast. Ver src/lib/meta-pixel.ts.
 *
 * Se lee en cinco sitios:
 *   - src/proxy.ts: sin analitica no se escribe asai_utm.
 *   - src/lib/analytics.ts y src/lib/ga.ts: sin analitica PostHog y GA no se inicializan.
 *   - src/lib/meta-pixel.ts: sin "all" el pixel de Meta no se carga.
 *   - src/lib/meta-capi.ts: sin "all" no sale nada a la API de conversiones de Meta.
 *   - src/app/auth/callback: sin analitica no se manda signup/login a PostHog desde el servidor.
 *
 * Formato: "<eleccion>.<version>" (p. ej. "all.v1-2026-10-09"). Si el texto del aviso
 * cambia de forma importante se sube la version y la cookie vieja deja de valer, asi
 * que el aviso vuelve a salir.
 *
 * Este modulo no importa nada de Next para que se pueda probar con vitest en node. */

export const CONSENT_COOKIE = "asai_consent";
// v2 (20 oct 2026): el aviso suma Google Analytics. Quien acepto la v1 solo acepto PostHog,
// asi que el aviso vuelve a salir para todos.
// v3 (22 oct 2026): el aviso suma la publicidad (pixel de Meta) como opcion aparte. El aviso
// anterior prometia «no usamos cookies de publicidad», asi que vuelve a salir para todos.
export const CONSENT_VERSION = "v3-2026-10-22";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 6 meses

/** Evento de window que abre el aviso otra vez (enlace "Cookies" del footer). */
export const OPEN_CONSENT_EVENT = "asai:open-consent";
/** Evento de window que avisa que la eleccion cambio (el detail es la eleccion). */
export const CONSENT_CHANGED_EVENT = "asai:consent-changed";

export type ConsentChoice = "all" | "analytics" | "essential";

/** Eleccion vigente a partir del valor crudo de la cookie, o null si no hay o es de otra version. */
export function parseConsent(raw: string | null | undefined): ConsentChoice | null {
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    /* no estaba codificado */
  }
  const dot = value.indexOf(".");
  if (dot === -1 || value.slice(dot + 1) !== CONSENT_VERSION) return null;
  const choice = value.slice(0, dot);
  return choice === "all" || choice === "analytics" || choice === "essential" ? choice : null;
}

export function serializeConsent(choice: ConsentChoice): string {
  return `${choice}.${CONSENT_VERSION}`;
}

/** true solo si la persona acepto la analitica en la version vigente del aviso. */
export function analyticsAllowed(raw: string | null | undefined): boolean {
  const choice = parseConsent(raw);
  return choice === "all" || choice === "analytics";
}

/** true solo si la persona acepto tambien la publicidad (pixel de Meta). */
export function adsAllowed(raw: string | null | undefined): boolean {
  return parseConsent(raw) === "all";
}

/** Valor de una cookie dentro de un string tipo document.cookie. */
export function readCookie(cookieString: string | null | undefined, name: string): string | undefined {
  if (!cookieString) return undefined;
  for (const part of cookieString.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/** Eleccion vigente leida de document.cookie (cliente). null fuera del navegador. */
export function browserConsent(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  return parseConsent(readCookie(document.cookie, CONSENT_COOKIE));
}

/** Analitica permitida en el navegador (PostHog y GA4). */
export function browserAnalyticsAllowed(): boolean {
  const choice = browserConsent();
  return choice === "all" || choice === "analytics";
}

/** Publicidad permitida en el navegador (pixel de Meta). */
export function browserAdsAllowed(): boolean {
  return browserConsent() === "all";
}
