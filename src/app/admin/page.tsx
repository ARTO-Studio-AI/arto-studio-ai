import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui";
import { fecha, guardAdmin, PageHead } from "./_kit";

/* /admin · Hoy (fase 1 del rediseno, 2026-10-12). Numeros reales del negocio. La portada
 * vieja contaba tablas que ya no existen (traces, scraping_runs, growth_signals) y
 * mostraba 0 sin avisar. Si una consulta falla, la tarjeta dice «sin dato», nunca 0. */

export const dynamic = "force-dynamic";

type Count = number | null;

// Tipo del query builder de supabase-js sin acoplarse a sus genericos internos.
type CountQuery = ReturnType<ReturnType<ReturnType<typeof createAdminClient>["from"]>["select"]>;

async function count(table: string, filter?: (q: CountQuery) => CountQuery): Promise<Count> {
  try {
    let q = createAdminClient().from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count: c, error } = await q;
    return error ? null : (c ?? 0);
  } catch {
    return null;
  }
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export default async function AdminHoy() {
  await guardAdmin();
  const d7 = daysAgo(7);
  const d30 = daysAgo(30);
  const [reg7, reg30, regTotal, listaActiva, listaPend, listaBaja, pro, proStripe, roasts7, roastsTotal, busq7, lastSent] = await Promise.all([
    count("profiles", (q) => q.gte("created_at", d7)),
    count("profiles", (q) => q.gte("created_at", d30)),
    count("profiles"),
    count("newsletter_subscribers", (q) => q.eq("status", "active")),
    count("newsletter_subscribers", (q) => q.eq("status", "pending")),
    count("newsletter_subscribers", (q) => q.in("status", ["unsubscribed", "bounced"])),
    count("profiles", (q) => q.eq("tier", "pro")),
    count("profiles", (q) => q.in("subscription_status", ["active", "past_due"])),
    count("skill_traces", (q) => q.eq("skill_slug", "brand-roast").gte("created_at", d7)),
    count("skill_traces", (q) => q.eq("skill_slug", "brand-roast")),
    count("search_queries", (q) => q.gte("created_at", d7)),
    createAdminClient()
      .from("newsletter_subscribers")
      .select("last_sent_at")
      .not("last_sent_at", "is", null)
      .order("last_sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => (r.data?.last_sent_at as string | undefined) ?? null, () => null),
  ]);

  const n = (c: Count) => (c === null ? "sin dato" : c.toLocaleString("es-MX"));
  const tiles: { label: string; value: string; sub: string; href?: string }[] = [
    { label: "Registros · 7 días", value: n(reg7), sub: `${n(reg30)} en 30 días · ${n(regTotal)} en total`, href: "/admin/usuarios" },
    { label: "Lista de promociones", value: n(listaActiva), sub: `activos · ${n(listaPend)} por confirmar · ${n(listaBaja)} bajas o rebotes`, href: "/admin/lista" },
    { label: "Plan Pro", value: n(pro), sub: `${n(proStripe)} con suscripción activa en Stripe · el resto por concesión`, href: "/admin/pro" },
    { label: "Roasts · 7 días", value: n(roasts7), sub: `${n(roastsTotal)} en total`, href: "/admin/roasts" },
    { label: "Búsquedas · 7 días", value: n(busq7), sub: "en la biblioteca · qué no encuentran", href: "/admin/busquedas" },
  ];

  return (
    <div>
      <PageHead eyebrow="Panel" title="Hoy" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} href={t.href} padding="md">
            <p className="text-eyebrow text-zinc-500">{t.label}</p>
            <p className="font-display mt-2 text-4xl font-extrabold tracking-[-0.03em] text-zinc-900">{t.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{t.sub}</p>
          </Card>
        ))}
      </div>
      <div className="mt-8 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        <p className="text-eyebrow text-zinc-500">Salud</p>
        <p className="mt-2">Último envío del digest: <span className="text-zinc-900">{fecha(lastSent)}</span></p>
        <p className="mt-1">
          Las secciones viejas siguen en el menú, bajo «Anterior», hasta que se decida qué se retira.{" "}
          <Link href="/admin/emails" className="text-zinc-900 underline-offset-2 hover:underline">Editar la bienvenida</Link>
        </p>
      </div>
    </div>
  );
}
