/* Consentimiento de cookies (H-48, 9 oct 2026).
 *
 * La cookie `asai_consent` guarda lo que eligio la persona en el aviso de cookies:
 *   - "essential": solo lo necesario para que el sitio funcione (sesion, idioma,
 *     contador free, esta misma cookie). Es el default: sin respuesta no hay analitica.
 *   - "all": ademas PostHog (analitica de producto) y `asai_utm` (atribucion de
 *     primera visita).
 *
 * Se lee en tres sitios:
 *   - src/proxy.ts: sin "all" no se escribe asai_utm.
 *   - src/lib/analytics.ts: sin "all" PostHog no se inicializa.
 *   - src/app/auth/callback: sin "all" no se manda signup/login a PostHog desde el servidor.
 *
 * Formato: "<eleccion>.<version>" (p. ej. "all.v1-2026-10-09"). Si el texto del aviso
 * cambia de forma importante se sube la version y la cookie vieja deja de valer, asi
 * que el aviso vuelve a salir.
 *
 * Este modulo no importa nada de Next para que se pueda probar con vitest en node. */

export const CONSENT_COOKIE = "asai_consent";
export const CONSENT_VERSION = "v1-2026-10-09";
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 6 meses

/** Evento de window que abre el aviso otra vez (enlace "Cookies" del footer). */
export const OPEN_CONSENT_EVENT = "asai:open-consent";
/** Evento de window que avisa que la eleccion cambio (el detail es la eleccion). */
export const CONSENT_CHANGED_EVENT = "asai:consent-changed";

export type ConsentChoice = "all" | "essential";

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
  return choice === "all" || choice === "essential" ? choice : null;
}

export function serializeConsent(choice: ConsentChoice): string {
  return `${choice}.${CONSENT_VERSION}`;
}

/** true solo si la persona acepto la analitica en la version vigente del aviso. */
export function analyticsAllowed(raw: string | null | undefined): boolean {
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
