/**
 * URL publica del sitio (D6, 2026-09-11). Antes habia hardcodes de
 * arto-studio-ai.vercel.app repartidos en correos, cron del digest, unsubscribe
 * y las imagenes OG. Todo lo que construya un enlace absoluto o muestre el
 * dominio lee de aqui. NEXT_PUBLIC_SITE_URL esta definida en Vercel; el default
 * es el dominio de produccion. Stripe (checkout y billing portal) va en otro PR.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://creative.artostudio.ai"
).replace(/\/+$/, "");

/** Solo el host, para mostrarlo como texto (pies de correo, imagenes OG). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
