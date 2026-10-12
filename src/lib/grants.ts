import { createAdminClient } from "@/lib/supabase/admin";

/* Concesiones de plan (fase 4 de /admin, 2026-10-12). Viven en email_tier_grants:
 *  - Al crear o editar una, el trigger email_tier_grants_apply_retro copia el plan al
 *    perfil si la persona ya existe; si no, handle_new_user lo aplica al registrarse.
 *  - Al borrarla, el trigger no hace nada: aqui se regresa el perfil a free, salvo que
 *    tenga una suscripcion de Stripe vigente (entonces manda Stripe).
 *  - Las concesiones con is_admin no se tocan desde el panel: dar o quitar permisos de
 *    administrador es una decision aparte y va por SQL. */

export const GRANT_TIERS = ["pro", "enterprise"] as const;
export type GrantTier = (typeof GRANT_TIERS)[number];

const EMAIL_RE = /^[^\s@,;()<>"]+@[^\s@,;()<>"]+\.[^\s@,;()<>"]{2,}$/;

export function cleanEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 200 && EMAIL_RE.test(e) ? e : null;
}

export interface GrantRow {
  email: string;
  tier: string;
  is_admin: boolean;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const stamp = (by: string) => `${new Date().toISOString().slice(0, 10)} ${by}`;

export async function grantTier(email: string, tier: GrantTier, note: string, by: { email: string; userId: string }): Promise<"created" | "updated"> {
  const sb = createAdminClient();
  const { data: cur, error: readErr } = await sb.from("email_tier_grants").select("email, tier, is_admin, notes").eq("email", email).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  const existing = cur as GrantRow | null;
  if (existing?.is_admin) throw new Error("Esa concesión incluye permisos de administrador; se cambia por SQL, no desde el panel.");
  const line = `[${stamp(by.email)}] ${tier}${note ? `: ${note}` : ""}`;
  const notes = [existing?.notes, line].filter(Boolean).join("\n").slice(-2000);
  const now = new Date().toISOString();
  if (existing) {
    const { error } = await sb.from("email_tier_grants").update({ tier, notes, updated_at: now }).eq("email", email);
    if (error) throw new Error(error.message);
    return "updated";
  }
  const { error } = await sb.from("email_tier_grants").insert({ email, tier, is_admin: false, notes, created_by: by.userId, created_at: now, updated_at: now });
  if (error) throw new Error(error.message);
  return "created";
}

export async function revokeGrant(email: string, by: { email: string }): Promise<{ downgraded: boolean; keptByStripe: boolean }> {
  const sb = createAdminClient();
  const { data: cur, error: readErr } = await sb.from("email_tier_grants").select("email, is_admin").eq("email", email).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!cur) throw new Error("Ese correo no tiene concesión.");
  if ((cur as GrantRow).is_admin) throw new Error("Esa concesión incluye permisos de administrador; se quita por SQL, no desde el panel.");
  const { error } = await sb.from("email_tier_grants").delete().eq("email", email);
  if (error) throw new Error(error.message);
  console.log(JSON.stringify({ event: "grant_revoked", email, by: by.email, at: new Date().toISOString() }));

  const { data: prof } = await sb.from("profiles").select("id, tier, subscription_status, stripe_subscription_id").eq("email", email).maybeSingle();
  const p = prof as { id: string; tier: string; subscription_status: string | null; stripe_subscription_id: string | null } | null;
  if (!p || p.tier === "free") return { downgraded: false, keptByStripe: false };
  const stripeLive = Boolean(p.stripe_subscription_id) && ["active", "past_due"].includes(p.subscription_status ?? "");
  if (stripeLive) return { downgraded: false, keptByStripe: true };
  const { error: upErr } = await sb.from("profiles").update({ tier: "free", updated_at: new Date().toISOString() }).eq("id", p.id);
  if (upErr) throw new Error(upErr.message);
  return { downgraded: true, keptByStripe: false };
}
