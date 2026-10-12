import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/catalog-server";
import { Badge, Card } from "@/components/ui";
import { fecha, guardAdmin, PageHead, Table, TD } from "../_kit";

/* /admin/pro (fase 4, 2026-10-12): quien tiene plan de pago y por que. Solo lectura. El
 * origen se deduce: suscripcion de Stripe, concesion por correo (email_tier_grants) o
 * manual (tier puesto a mano, sin ninguna de las dos). Los cobros y facturas se ven en
 * Stripe; aqui solo el estado que ya sincroniza el webhook. */

export const dynamic = "force-dynamic";

interface Profile {
  id: string;
  email: string | null;
  tier: string;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

const STATUS: Record<string, { label: string; tone: "live" | "soon" | "neutral" | "inverse" }> = {
  active: { label: "activa", tone: "live" },
  past_due: { label: "pago atrasado", tone: "soon" },
  canceled: { label: "cancelada", tone: "neutral" },
  inactive: { label: "sin suscripción", tone: "neutral" },
};

// Fuera del componente: la regla de pureza de React no deja llamar Date.now() al pintar.
const isFuture = (iso: string | null) => Boolean(iso && Date.parse(iso) > Date.now());

export default async function Pro() {
  await guardAdmin();
  const sb = createAdminClient();
  const [profiles, grants, events] = await Promise.all([
    selectAll<Profile>(() =>
      sb
        .from("profiles")
        .select("id, email, tier, subscription_status, subscription_ends_at, stripe_customer_id, stripe_subscription_id, created_at")
        .or("tier.neq.free,stripe_subscription_id.not.is.null,subscription_status.neq.inactive")
        .order("created_at", { ascending: false }),
    ),
    selectAll<{ email: string; tier: string; notes: string | null }>(() => sb.from("email_tier_grants").select("email, tier, notes").order("email")),
    sb.from("stripe_events").select("id, type, received_at").order("received_at", { ascending: false }).limit(15),
  ]);
  const grantBy = new Map(grants.map((g) => [g.email.toLowerCase(), g]));

  const origin = (p: Profile) =>
    p.stripe_subscription_id ? "Stripe" : p.email && grantBy.has(p.email.toLowerCase()) ? "Concesión" : p.tier !== "free" ? "Manual" : "—";

  const activos = profiles.filter((p) => p.subscription_status === "active").length;
  const atrasados = profiles.filter((p) => p.subscription_status === "past_due").length;
  const porVencer = profiles.filter((p) => p.subscription_status === "canceled" && isFuture(p.subscription_ends_at)).length;
  const concesion = profiles.filter((p) => origin(p) === "Concesión").length;

  const tiles = [
    { label: "Pagan por Stripe", value: activos, sub: "suscripción activa" },
    { label: "Pago atrasado", value: atrasados, sub: "Stripe reintenta el cobro" },
    { label: "Cancelaron", value: porVencer, sub: "conservan acceso hasta que vence" },
    { label: "Por concesión", value: concesion, sub: "plan dado por correo, sin cobro" },
  ];

  return (
    <div>
      <PageHead eyebrow="Personas" title="Pro y planes de pago" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} padding="md">
            <p className="text-eyebrow text-zinc-500">{t.label}</p>
            <p className="font-display mt-2 text-4xl font-extrabold tracking-[-0.03em] text-zinc-900">{t.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{t.sub}</p>
          </Card>
        ))}
      </div>

      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Personas con plan de pago o suscripción</h2>
      <Table head={["Correo", "Plan", "Origen", "Suscripción", "Vence", "Stripe", "Alta"]} empty={profiles.length === 0 && "Nadie tiene plan de pago todavía."}>
        {profiles.map((p) => {
          const st = STATUS[p.subscription_status ?? "inactive"] ?? { label: p.subscription_status ?? "—", tone: "neutral" as const };
          const g = p.email ? grantBy.get(p.email.toLowerCase()) : undefined;
          return (
            <tr key={p.id}>
              <td className={`${TD} text-zinc-900`}>{p.email ?? "—"}</td>
              <td className={TD}><Badge tone={p.tier === "free" ? "neutral" : "inverse"} dot={p.tier !== "free"}>{p.tier}</Badge></td>
              <td className={TD}>
                {origin(p)}
                {g?.notes && <div className="text-xs text-zinc-500">{g.notes}</div>}
              </td>
              <td className={TD}><Badge tone={st.tone} dot={st.tone === "live"}>{st.label}</Badge></td>
              <td className={`${TD} whitespace-nowrap`}>{fecha(p.subscription_ends_at)}</td>
              <td className={TD}>
                {p.stripe_customer_id ? (
                  <a className="text-xs text-zinc-600 underline-offset-2 hover:underline" href={`https://dashboard.stripe.com/customers/${encodeURIComponent(p.stripe_customer_id)}`} target="_blank" rel="noreferrer noopener">
                    ver cliente →
                  </a>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </td>
              <td className={`${TD} whitespace-nowrap text-zinc-500`}>{fecha(p.created_at)}</td>
            </tr>
          );
        })}
      </Table>

      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Últimos avisos de Stripe</h2>
      <Table head={["Evento", "Recibido"]} empty={(events.data ?? []).length === 0 && "Todavía no llega ningún aviso del webhook de Stripe en producción."}>
        {((events.data ?? []) as { id: string; type: string; received_at: string }[]).map((e) => (
          <tr key={e.id}>
            <td className={`${TD} font-mono text-xs`}>{e.type}</td>
            <td className={`${TD} whitespace-nowrap`}>{fecha(e.received_at)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
