import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/catalog-server";
import type { GrantRow } from "@/lib/grants";
import { guardAdmin, PageHead } from "../_kit";
import GrantsClient, { type GrantView } from "./GrantsClient";

/* /admin/concesiones (fase 4, 2026-10-12): dar o quitar un plan a un correo sin SQL. */

export const dynamic = "force-dynamic";

export default async function Concesiones() {
  await guardAdmin();
  const sb = createAdminClient();
  const grants = await selectAll<GrantRow>(() => sb.from("email_tier_grants").select("email, tier, is_admin, notes, created_at, updated_at").order("email"));
  const emails = grants.map((g) => g.email);
  const { data: profs } = emails.length
    ? await sb.from("profiles").select("email, tier, subscription_status, stripe_subscription_id").in("email", emails)
    : { data: [] };
  const byEmail = new Map(((profs ?? []) as { email: string; tier: string; subscription_status: string | null; stripe_subscription_id: string | null }[]).map((p) => [p.email, p]));
  const rows: GrantView[] = grants.map((g) => {
    const p = byEmail.get(g.email);
    return {
      ...g,
      registered: Boolean(p),
      profileTier: p?.tier ?? null,
      stripeLive: Boolean(p?.stripe_subscription_id) && ["active", "past_due"].includes(p?.subscription_status ?? ""),
    };
  });
  return (
    <div>
      <PageHead eyebrow="Personas" title="Concesiones de plan" />
      <p className="-mt-4 mb-6 max-w-3xl text-sm text-zinc-600">
        Da un plan sin cobro a un correo. Si la persona ya tiene cuenta, el plan se aplica en ese momento; si no, al registrarse.
        Al quitar una concesión, la cuenta vuelve a gratis, salvo que pague por Stripe. Las concesiones con permisos de
        administrador están bloqueadas aquí.
      </p>
      <GrantsClient rows={rows} />
    </div>
  );
}
