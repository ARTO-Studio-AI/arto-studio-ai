/* Webhook de Resend (9 oct 2026, punto 8 de Victor: el marketing vive en Resend y aqui
 * solo se construye lo que conecta Resend con la base).
 *
 * Lleva a newsletter_subscribers lo que pasa del lado de Resend, para que el digest y
 * cualquier envio propio no le escriban a quien ya no se debe:
 *   - email.bounced con rebote permanente  -> bounced
 *   - email.suppressed (lista de supresion) -> bounced
 *   - email.complained (lo marco como spam) -> unsubscribed
 *   - contact.updated con unsubscribed=true (baja desde un Broadcast) -> unsubscribed
 *
 * Nunca reactiva a nadie: solo baja de active o pending. Una baja no se vuelve rebote.
 * Este modulo no importa nada de Next para probarlo con vitest en node. */

export type ListStatus = "bounced" | "unsubscribed";

export interface ListChange {
  emails: string[];
  status: ListStatus;
  reason: string;
}

interface ResendEvent {
  type?: string;
  data?: {
    to?: string[];
    email?: string;
    unsubscribed?: boolean;
    audience_id?: string;
    bounce?: { type?: string; subType?: string };
    suppressed?: { type?: string };
  };
}

function clean(list: (string | undefined)[]): string[] {
  return [...new Set(list.filter((e): e is string => typeof e === "string" && e.includes("@")).map((e) => e.trim().toLowerCase()))];
}

/** Que cambio de lista implica el evento, o null si no toca la lista. */
export function listChangeFor(event: ResendEvent, audienceId?: string): ListChange | null {
  const data = event.data ?? {};
  switch (event.type) {
    case "email.bounced": {
      // Transient (buzon lleno, servidor caido) no es motivo para sacar a nadie.
      if (data.bounce?.type !== "Permanent") return null;
      const emails = clean(data.to ?? []);
      return emails.length ? { emails, status: "bounced", reason: `bounce:${data.bounce.subType ?? "permanent"}` } : null;
    }
    case "email.suppressed": {
      const emails = clean(data.to ?? []);
      return emails.length ? { emails, status: "bounced", reason: `suppressed:${data.suppressed?.type ?? "unknown"}` } : null;
    }
    case "email.complained": {
      const emails = clean(data.to ?? []);
      return emails.length ? { emails, status: "unsubscribed", reason: "complaint" } : null;
    }
    case "contact.updated": {
      if (data.unsubscribed !== true) return null;
      // Solo la audiencia de ASAI: una baja en otra audiencia de la cuenta no es de aqui.
      if (audienceId && data.audience_id !== audienceId) return null;
      const emails = clean([data.email]);
      return emails.length ? { emails, status: "unsubscribed", reason: "resend_unsubscribe" } : null;
    }
    default:
      return null;
  }
}

/** Estados desde los que se puede bajar. unsubscribed y bounced se quedan como estan. */
export const DOWNGRADABLE = ["active", "pending"] as const;
