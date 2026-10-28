/* Regla de acceso del ARTO Edit Bundle #1 (decision de Victor del 2026-10-27, ver
 * docs/DECISIONES.md, «ARTO Edit Bundle #1»).
 *
 *  - Los 9 skills y el bundle son parte de Pro (el Pro de 9 USD que ya existe en Stripe).
 *  - Promocion: del 27 oct al 7 nov de 2026 (Victor la amplio el 28 oct, antes era al 2 nov) se descargan gratis con cualquier cuenta gratis.
 *  - Desde el 8 nov a las 00:00 de Ciudad de Mexico (06:00 UTC) solo Pro.
 *
 * El corte vive en UNA constante para que nadie tenga que acordarse de quitarlo. Las pruebas
 * (access.test.ts) revisan los dos lados de la fecha. Este archivo no toca base ni red: es
 * logica pura, la usan las paginas (etiqueta y boton) y la ruta de descarga (permiso). */

/** Primer instante en que la descarga gratis YA NO aplica. 2026-11-08 00:00 en CDMX (UTC-6). */
export const EDIT_BUNDLE_FREE_UNTIL = "2026-11-08T06:00:00Z";

const FREE_UNTIL_MS = Date.parse(EDIT_BUNDLE_FREE_UNTIL);

/** Planes que cuentan como Pro para descargar. Enterprise incluye todo lo de Pro. */
const PRO_TIERS = new Set(["pro", "enterprise"]);

export type Viewer =
  | { signedIn: false }
  | { signedIn: true; userId: string; tier: string };

/** signin: mandar a crear cuenta o entrar. download: entregar. upgrade: mandar a Pro. */
export type DownloadAccess = "signin" | "download" | "upgrade";

export function isProTier(tier: string | null | undefined): boolean {
  return typeof tier === "string" && PRO_TIERS.has(tier);
}

/** true mientras dura la promocion (estrictamente antes del corte). */
export function isPromoActive(now: Date = new Date()): boolean {
  const t = now.getTime();
  return Number.isFinite(t) && t < FREE_UNTIL_MS;
}

export function downloadAccess(viewer: Viewer, now: Date = new Date()): DownloadAccess {
  if (!viewer.signedIn) return "signin";
  if (isProTier(viewer.tier)) return "download";
  return isPromoActive(now) ? "download" : "upgrade";
}

/** Etiqueta de las tarjetas: "free" (Gratis hasta el 7 nov) o "pro". */
export function priceLabel(now: Date = new Date()): "free" | "pro" {
  return isPromoActive(now) ? "free" : "pro";
}
