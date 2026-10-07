import { createAdminClient } from "@/lib/supabase/admin";
import { upsertAudienceContact } from "@/lib/resend-audience";

/* Lista de correos de promocion (2026-10-07). Fuente unica: newsletter_subscribers, la
 * tabla que ya usa el digest semanal (solo status = active) y que trae token de baja por
 * fila. Solo se llama con consentimiento expreso (ver DECISIONES):
 *   - registro: el enlace magico o Google ya prueban que el buzon es suyo; entra directo.
 *   - roast (`requireConfirm`): doble opt-in. Queda "pending" y se le manda un correo de
 *     confirmacion; confirmList() lo pasa a "active" (auditoria de Fable, PR #76).
 * Nunca lanza: un fallo aqui no debe romper el login ni el roast. */
export interface MarketingListResult {
  ok: boolean;
  /** Quedo activa en esta llamada (para mandar la bienvenida una sola vez). */
  newlyActive: boolean;
  /** Quedo pendiente de confirmar (para mandar el correo de confirmacion). */
  needsConfirmation: boolean;
  unsubscribeToken: string | null;
}

const FAIL: MarketingListResult = { ok: false, newlyActive: false, needsConfirmation: false, unsubscribeToken: null };

export async function addToMarketingList(input: {
  email: string;
  source: "signup" | "roast";
  userId?: string | null;
  firstName?: string;
  lastName?: string;
  requireConfirm?: boolean;
}): Promise<MarketingListResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) return FAIL;
  try {
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin
      .from("newsletter_subscribers")
      .select("status, unsubscribe_token")
      .eq("email", email)
      .maybeSingle();
    if (readError) {
      console.error("[marketing-list] lectura fallo:", readError.message);
      return FAIL;
    }
    // Ya activa: no se toca ni se reenvia nada.
    if (before?.status === "active") {
      return { ok: true, newlyActive: false, needsConfirmation: false, unsubscribeToken: before.unsubscribe_token ?? null };
    }
    const status = input.requireConfirm ? "pending" : "active";
    const { data, error } = await admin
      .from("newsletter_subscribers")
      .upsert(
        {
          email,
          source: input.source,
          user_id: input.userId ?? null,
          status,
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
        },
        { onConflict: "email" },
      )
      .select("unsubscribe_token")
      .maybeSingle();
    if (error) {
      console.error("[marketing-list] upsert fallo:", error.message);
      return FAIL;
    }
    const token = (data?.unsubscribe_token as string | undefined) ?? null;
    if (status === "active") {
      await upsertAudienceContact({ email, firstName: input.firstName, lastName: input.lastName });
      return { ok: true, newlyActive: true, needsConfirmation: false, unsubscribeToken: token };
    }
    return { ok: true, newlyActive: false, needsConfirmation: true, unsubscribeToken: token };
  } catch (err) {
    console.error("[marketing-list] error:", err);
    return FAIL;
  }
}

/** Confirma el doble opt-in. Devuelve el correo si paso de "pending" a "active". */
export async function confirmList(token: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("newsletter_subscribers")
      .update({ status: "active", subscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .eq("status", "pending")
      .select("email")
      .maybeSingle();
    if (error || !data?.email) return null;
    await upsertAudienceContact({ email: data.email as string });
    return data.email as string;
  } catch (err) {
    console.error("[marketing-list] confirmar fallo:", err);
    return null;
  }
}
