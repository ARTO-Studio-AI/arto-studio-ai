import { Resend } from "resend";

/* Audiencia de Resend (Fase 1C, 13 sep 2026).
 *
 * Crea o actualiza un contacto en la audiencia cuyo id viene de RESEND_AUDIENCE_ID.
 * No manda ningun correo: solo deja el contacto listo para los broadcasts que
 * Victor decida despues (D8: secuencia de onboarding). Si falta la variable, no
 * hace nada y lo dice una sola vez en consola; asi el codigo puede ir a main
 * antes de que exista la audiencia.
 *
 * Se llama en dos sitios: /auth/callback al detectar un signup nuevo y
 * /api/roast/email cuando alguien deja su correo para ver el reporte completo.
 *
 * Nota: Resend renombro "audiences" a "segments" en 2026. El SDK sigue aceptando
 * audienceId (marcado deprecated) y el id de un segment funciona ahi. Cuando
 * migremos, este es el unico archivo que cambia. */

let warned = false;

function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[resend-audience] ${message}`);
}

export interface AudienceContact {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export type AudienceResult =
  | { ok: true; action: "created" | "updated" }
  | { ok: false; skipped: true; reason: "no_audience_id" | "no_api_key" | "invalid_email" }
  | { ok: false; skipped: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Divide "Nombre Apellido" en firstName / lastName; ambos undefined si no hay nombre. */
export function splitName(fullName: string | null | undefined): { firstName?: string; lastName?: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function upsertAudienceContact(
  contact: AudienceContact,
  deps: { resend?: Resend } = {},
): Promise<AudienceResult> {
  const audienceId = process.env.RESEND_AUDIENCE_ID?.trim();
  if (!audienceId) {
    warnOnce("RESEND_AUDIENCE_ID ausente; no se sincroniza la audiencia");
    return { ok: false, skipped: true, reason: "no_audience_id" };
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey && !deps.resend) {
    warnOnce("RESEND_API_KEY ausente; no se sincroniza la audiencia");
    return { ok: false, skipped: true, reason: "no_api_key" };
  }
  const email = contact.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, skipped: true, reason: "invalid_email" };

  const firstName = contact.firstName?.trim() || undefined;
  const lastName = contact.lastName?.trim() || undefined;
  const resend = deps.resend ?? new Resend(apiKey);

  try {
    const created = await resend.contacts.create({ audienceId, email, firstName, lastName, unsubscribed: false });
    if (!created.error) {
      console.log(JSON.stringify({ event: "audience_contact_created", email }));
      return { ok: true, action: "created" };
    }
    // Contacto ya existente: se actualiza el nombre sin tocar unsubscribed.
    if (/exist/i.test(created.error.message)) {
      const updated = await resend.contacts.update({ audienceId, email, firstName, lastName });
      if (!updated.error) {
        console.log(JSON.stringify({ event: "audience_contact_updated", email }));
        return { ok: true, action: "updated" };
      }
      console.error("[resend-audience] update fallo:", updated.error);
      return { ok: false, skipped: false, error: updated.error.message };
    }
    console.error("[resend-audience] create fallo:", created.error);
    return { ok: false, skipped: false, error: created.error.message };
  } catch (error) {
    console.error("[resend-audience] excepcion:", error);
    return { ok: false, skipped: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Solo para pruebas. */
export function __resetResendAudienceForTests(): void {
  warned = false;
}
