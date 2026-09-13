/* Validacion del parametro `next` antes de redirigir (H-46, 13 sep 2026).
 *
 * /auth/callback armaba `${siteUrl}${next}` sin validar. Con `next=.evil.com`
 * salia `https://creative.artostudio.ai.evil.com` y con `next=@evil.com` el
 * navegador resolvia a `evil.com` (lo de antes de la arroba es usuario). Toda
 * redireccion que tome un destino de la peticion pasa por aqui.
 *
 * Reglas:
 *   - Solo rutas que empiezan con exactamente una `/`. Nada de `//` ni `/\`
 *     (el navegador los lee como otro host), ni esquemas (`javascript:`,
 *     `http:`), ni backslashes, ni caracteres de control (el parser de URL
 *     quita tabs y saltos, asi que `/\t/evil.com` terminaria en `//evil.com`).
 *   - Se construye con `new URL(next, siteUrl)` y el origin resultante tiene
 *     que ser el de `siteUrl`. Se devuelve solo `pathname + search + hash`.
 *   - Cualquier duda devuelve `fallback`. */

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/** Origin que se usa si no llega `siteUrl`: el del sitio o uno fijo que no resuelve. */
function defaultSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://safe-next.invalid";
}

export function safeNextPath(
  next: string | null | undefined,
  fallback = "/",
  siteUrl: string = defaultSiteUrl(),
): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  if (CONTROL_CHARS.test(next)) return fallback;
  if (next.includes("\\")) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;

  try {
    const base = new URL(siteUrl);
    const resolved = new URL(next, base);
    if (resolved.origin !== base.origin) return fallback;
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    // Segunda barrera: lo que sale tambien tiene que ser una ruta de una sola barra.
    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
