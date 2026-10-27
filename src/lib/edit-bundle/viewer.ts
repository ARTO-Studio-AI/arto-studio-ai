import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Viewer } from "./access";

/* Quien esta viendo la pagina o pidiendo la descarga. Usa lo que ya existe en el repo:
 *  - la sesion de Supabase (createClient de @/lib/supabase/server, getUser() valida el JWT
 *    contra Supabase, no solo lee la cookie);
 *  - el plan en profiles.tier, que mantienen el webhook de Stripe y las concesiones
 *    (src/lib/stripe-webhook.ts, src/lib/grants.ts). Se lee con el service role, como
 *    /api/search y el checkout de Pro.
 *
 * Si la sesion no se puede leer, es anonimo. Si el perfil no se puede leer, es "free":
 * falla cerrado (nunca regala Pro por un error de base). Solo para servidor. */
export async function getViewer(): Promise<Viewer> {
  let userId: string | null = null;
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    return { signedIn: false };
  }
  if (!userId) return { signedIn: false };

  let tier = "free";
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("profiles").select("tier").eq("id", userId).maybeSingle();
    if (error) console.error("[edit-bundle] no se pudo leer el plan:", error.message);
    else if (typeof data?.tier === "string") tier = data.tier;
  } catch (err) {
    console.error("[edit-bundle] no se pudo leer el plan:", err instanceof Error ? err.message : err);
  }
  return { signedIn: true, userId, tier };
}
