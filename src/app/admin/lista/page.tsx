import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, Button } from "@/components/ui";
import { fecha, guardAdmin, PageHead, Pager, PAGE_SIZE, pageOf, Table, TD } from "../_kit";

/* /admin/lista (fase 1, 2026-10-12): la lista de promociones (newsletter_subscribers),
 * fuente unica de la lista (D12). Solo lectura y exportacion a CSV. Las campanas se
 * mandan desde Resend; la baja manual llega en la fase 2. */

export const dynamic = "force-dynamic";

const STATUSES = ["active", "pending", "unsubscribed", "bounced"] as const;
const LABEL: Record<string, string> = { active: "Activos", pending: "Por confirmar", unsubscribed: "Bajas", bounced: "Rebotes" };

export default async function Lista({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await guardAdmin();
  const sp = await searchParams;
  const status = typeof sp.estado === "string" && (STATUSES as readonly string[]).includes(sp.estado) ? sp.estado : "";
  const page = pageOf(sp.p);
  const from = (page - 1) * PAGE_SIZE;
  const sb = createAdminClient();

  const counts = await Promise.all(
    STATUSES.map(async (s) => {
      const { count } = await sb.from("newsletter_subscribers").select("*", { count: "exact", head: true }).eq("status", s);
      return [s, count ?? 0] as const;
    }),
  );

  let query = sb
    .from("newsletter_subscribers")
    .select("email, status, source, subscribed_at, last_sent_at, unsubscribed_at", { count: "exact" })
    .order("subscribed_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const { data: rows, count, error } = await query;

  return (
    <div>
      <PageHead eyebrow="Personas" title="Lista de promociones">
        <Button href={`/api/admin/lista/export${status ? `?estado=${status}` : ""}`} variant="secondary" size="sm">Exportar CSV</Button>
      </PageHead>
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/lista" className={`rounded-full border px-3 py-1 ${!status ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:text-zinc-900"}`}>Todos</Link>
        {counts.map(([s, c]) => (
          <Link key={s} href={`/admin/lista?estado=${s}`} className={`rounded-full border px-3 py-1 ${status === s ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:text-zinc-900"}`}>
            {LABEL[s]} · {c.toLocaleString("es-MX")}
          </Link>
        ))}
      </div>
      {error && <p className="mb-4 text-sm text-[var(--bad)]">No se pudo leer la lista: {error.message}</p>}
      <Table head={["Correo", "Estado", "Origen", "Alta", "Último envío", "Baja"]} empty={!error && (rows ?? []).length === 0 && "Nadie en este estado."}>
        {(rows ?? []).map((r) => (
          <tr key={r.email}>
            <td className={`${TD} text-zinc-900`}>{r.email}</td>
            <td className={TD}><Badge tone={r.status === "active" ? "live" : "soon"} dot={r.status === "active"}>{LABEL[r.status] ?? r.status}</Badge></td>
            <td className={TD}>{r.source === "signup" ? "registro" : r.source === "roast" ? "roast" : (r.source ?? "—")}</td>
            <td className={`${TD} whitespace-nowrap`}>{fecha(r.subscribed_at)}</td>
            <td className={`${TD} whitespace-nowrap`}>{fecha(r.last_sent_at)}</td>
            <td className={`${TD} whitespace-nowrap`}>{fecha(r.unsubscribed_at)}</td>
          </tr>
        ))}
      </Table>
      <Pager base="/admin/lista" page={page} total={count ?? 0} params={{ estado: status || undefined }} />
    </div>
  );
}
