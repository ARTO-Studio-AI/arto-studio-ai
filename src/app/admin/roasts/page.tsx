import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui";
import { fecha, guardAdmin, PageHead, Pager, PAGE_SIZE, pageOf, Table, TD } from "../_kit";

/* /admin/roasts (fase 1, 2026-10-12): los Brand Roasts reales. Desde el roast v2 viven en
 * skill_traces con slug brand-roast; la pestana vieja «Roast traces» lee roast_traces,
 * que quedo congelada. Solo lectura. */

export const dynamic = "force-dynamic";

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : null);

function tone(score: number | null): string {
  if (score === null) return "text-zinc-400";
  if (score >= 7) return "text-[var(--ok)]";
  if (score >= 4.5) return "text-[var(--warn)]";
  return "text-[var(--bad)]";
}

export default async function Roasts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await guardAdmin();
  const sp = await searchParams;
  const page = pageOf(sp.p);
  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await createAdminClient()
    .from("skill_traces")
    .select("id, input, output, email, latency_ms, model, created_at", { count: "exact" })
    .eq("skill_slug", "brand-roast")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  return (
    <div>
      <PageHead eyebrow="Producto" title="Brand Roasts" />
      {error && <p className="mb-4 text-sm text-[var(--bad)]">No se pudieron leer los roasts: {error.message}</p>}
      <Table head={["Marca", "Calificación", "Veredicto", "Correo", "Idioma", "Fecha"]} empty={!error && (rows ?? []).length === 0 && "Todavía no hay roasts."}>
        {(rows ?? []).map((r) => {
          const input = (r.input ?? {}) as Json;
          const output = (r.output ?? {}) as Json;
          const score = num(output.overall);
          const url = str(input.websiteUrl);
          return (
            <tr key={r.id}>
              <td className={TD}>
                <div className="text-zinc-900">{str(input.brandName) || "—"}</div>
                {url && <div className="text-xs text-zinc-500">{url}</div>}
                {str(input.industry) && <div className="text-xs text-zinc-400">{str(input.industry)}</div>}
              </td>
              <td className={`${TD} font-display text-xl font-extrabold ${tone(score)}`}>{score ?? "—"}</td>
              <td className={`${TD} max-w-md text-zinc-600`}><span className="line-clamp-3">{str(output.verdict) || "—"}</span></td>
              <td className={TD}>{r.email ? <Badge tone="live" dot mono={false}>{r.email}</Badge> : <span className="text-zinc-400">no dejó</span>}</td>
              <td className={TD}>{str(output.lang) || str(input.lang) || "—"}</td>
              <td className={`${TD} whitespace-nowrap text-zinc-500`}>{fecha(r.created_at)}</td>
            </tr>
          );
        })}
      </Table>
      <Pager base="/admin/roasts" page={page} total={count ?? 0} />
    </div>
  );
}
