/**
 * Dominio canónico del producto (D6, 10-sep-2026): creative.artostudio.ai.
 * Todo redirect de Stripe (success/cancel/return) y todo enlace en correos
 * sale de aquí; nunca de un dominio escrito a mano.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://creative.artostudio.ai").replace(/\/+$/, "");
