/* Lista de espera del Pack ARTO (/skills) y de Agentes (/agents), 2026-10-16.
 *
 * Lo comparten NewsletterForm (cliente) y /api/waitlist (servidor), por eso no importa
 * nada de servidor. Dejar el correo en la lista de espera es pedir un aviso: el dia que
 * abra. Las promociones son aparte, con su casilla sin marcar y doble opt-in (ver
 * src/lib/marketing-list.ts y DECISIONES, «Lista de espera del Pack»). */

export const WAITLIST_SOURCES = ["skills", "agents", "general"] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

/** Fuente con la que entra a newsletter_subscribers quien acepta promociones en cada formulario. */
export const LIST_SOURCE = {
  skills: "pack_waitlist",
  agents: "agents_waitlist",
  general: "waitlist",
} as const satisfies Record<WaitlistSource, string>;

/** Version del texto de la casilla de NewsletterForm. Si cambia el texto, cambia esto. */
export const WAITLIST_CONSENT_VERSION = "v1-2026-10-16";

export function parseWaitlistSource(value: unknown): WaitlistSource {
  return (WAITLIST_SOURCES as readonly unknown[]).includes(value) ? (value as WaitlistSource) : "general";
}
