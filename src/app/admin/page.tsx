import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui";
import { ADMIN_QUICK_IDS, adminNavItem, type AdminNavId } from "@/lib/admin-nav";
import { fecha, guardAdmin, PageHead } from "./_kit";
import AdminNavIcon from "./AdminNavIcon";

/* /admin · Resumen (antes «Hoy», fase 1 del rediseno, 2026-10-12). Numeros reales del negocio. La portada
 * vieja contaba tablas que ya no existen (traces, scraping_runs, growth_signals) y
 * mostraba 0 sin avisar. Si una consulta falla, la tarjeta dice «sin dato», nunca 0.
 * 5 nov 2026: tablero con el lenguaje de la navegacion de usuario (tarjetas con icono y accesos
 * rapidos). Las consultas son las mismas de antes; no se sumo ninguna. */

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
  const tiles: { label: string; value: string; sub: string; href: string; icon: AdminNavId }[] = [
    { label: "Registros · 7 días", value: n(reg7), sub: `${n(reg30)} en 30 días · ${n(regTotal)} en total`, href: "/admin/usuarios", icon: "users" },
    { label: "Lista de promociones", value: n(listaActiva), sub: `activos · ${n(listaPend)} por confirmar · ${n(listaBaja)} bajas o rebotes`, href: "/admin/lista", icon: "waitlist" },
    { label: "Plan Pro", value: n(pro), sub: `${n(proStripe)} con suscripción activa en Stripe · el resto por concesión`, href: "/admin/pro", icon: "pro" },
    { label: "Roasts · 7 días", value: n(roasts7), sub: `${n(roastsTotal)} en total`, href: "/admin/roasts", icon: "roasts" },
    { label: "Búsquedas · 7 días", value: n(busq7), sub: "en la biblioteca · qué no encuentran", href: "/admin/busquedas", icon: "searches" },
  ];
  const quick = ADMIN_QUICK_IDS.map(adminNavItem);

  return (
    <div>
      <PageHead eyebrow="Inicio" title="Resumen" />

      <section aria-labelledby="admin-numeros">
        <h2 id="admin-numeros" className="sr-only">Números</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <Card key={t.label} href={t.href} padding="md">
              <div className="flex items-center justify-between gap-3">
                <p className="text-eyebrow text-zinc-500">{t.label}</p>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                  <AdminNavIcon name={t.icon} />
                </span>
              </div>
              <p className="font-display mt-2 text-4xl font-extrabold tracking-[-0.03em] text-zinc-900">{t.value}</p>
              <p className="mt-1 text-sm text-zinc-500">{t.sub}</p>
            </Card>
          ))}
          <div className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-eyebrow text-zinc-500">Último digest</p>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                <AdminNavIcon name="emails" />
              </span>
            </div>
            <p className="mt-3 text-lg font-semibold text-zinc-900">{fecha(lastSent)}</p>
            <p className="mt-1 text-sm text-zinc-500">
              Envío más reciente a la lista.{" "}
              <Link href="/admin/emails" className="text-zinc-900 underline-offset-2 hover:underline">
                Editar la bienvenida
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="admin-accesos" className="mt-10">
        <h2 id="admin-accesos" className="text-eyebrow mb-3 text-zinc-500">
          Accesos rápidos
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quick.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex min-h-[56px] items-center gap-3 rounded-[var(--radius-lg)] border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              >
                <AdminNavIcon name={item.id} className="h-5 w-5 text-zinc-500 group-hover:text-zinc-900" />
                <span className="flex-1">{item.label}</span>
                <AdminNavIcon name="arrow" className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-900" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
