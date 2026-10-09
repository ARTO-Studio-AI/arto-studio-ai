import { createAdminClient } from "@/lib/supabase/admin";
import { upsertAudienceContact } from "@/lib/resend-audience";

/* Lista de correos de promocion (2026-10-07). Fuente unica: newsletter_subscribers, la
 * tabla que ya usa el digest semanal y que trae token de baja por fila. Solo se llama
 * con consentimiento expreso (casilla del registro o del roast; ver DECISIONES).
 * Volver a marcar la casilla reactiva a quien se habia dado de baja: es un nuevo si.
 * Tambien da de alta en la audiencia de Resend (no-op sin RESEND_AUDIENCE_ID).
 * Nunca lanza: un fallo aqui no debe romper el login ni el roast. */
export async function addToMarketingList(input: {
  email: string;
  source: "signup" | "roast";
  userId?: string | null;
  firstName?: string;
  lastName?: string;
}): Promise<boolean> {
  const email = input.email.trim().toLowerCase();
  if (!email) return false;
  let ok = true;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("newsletter_subscribers").upsert(
      {
        email,
        source: input.source,
        user_id: input.userId ?? null,
        status: "active",
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null,
      },
      { onConflict: "email" },
    );
    if (error) {
      ok = false;
      console.error("[marketing-list] upsert fallo:", error.message);
    }
  } catch (err) {
    ok = false;
    console.error("[marketing-list] error:", err);
  }
  await upsertAudienceContact({ email, firstName: input.firstName, lastName: input.lastName });
  return ok;
}
