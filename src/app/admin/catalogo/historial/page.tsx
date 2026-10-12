import { createAdminClient } from "@/lib/supabase/admin";
import { fecha, guardAdmin, PageHead, Table, TD } from "../../_kit";
import UndoButton from "./UndoButton";

/* /admin/catalogo/historial: los ultimos lotes de cambios, con deshacer. */

export const dynamic = "force-dynamic";

interface Change { batch_id: string; entity_id: string; summary: string; changed_by: string; created_at: string; reverted_at: string | null }

export default async function Historial() {
  await guardAdmin();
  const { data, error } = await createAdminClient()
    .from("catalog_changes")
    .select("batch_id, entity_id, summary, changed_by, created_at, reverted_at")
    .order("created_at", { ascending: false })
    .limit(1000); // PostgREST no da mas de 1,000 filas: son los cambios mas recientes
  const batches = new Map<string, { first: Change; ids: string[] }>();
  for (const c of (data ?? []) as Change[]) {
    const b = batches.get(c.batch_id);
    if (b) b.ids.push(c.entity_id);
    else batches.set(c.batch_id, { first: c, ids: [c.entity_id] });
  }
  const list = [...batches.values()].slice(0, 100);
  return (
    <div>
      <PageHead eyebrow="Catálogo" title="Historial de cambios" />
      <p className="-mt-4 mb-4 text-sm text-zinc-500">Los últimos 100 lotes. Deshacer solo restaura los prompts que nadie cambió después.</p>
      {error && <p className="mb-4 text-sm text-[var(--bad)]">No se pudo leer el historial: {error.message}</p>}
      <Table head={["Cambio", "Prompts", "Quién", "Cuándo", ""]} empty={!error && list.length === 0 && "Todavía no hay cambios."}>
        {list.map(({ first, ids }) => (
          <tr key={first.batch_id}>
            <td className={TD}>{first.summary}</td>
            <td className={`${TD} max-w-xs text-xs text-zinc-500`}>{ids.length === 1 ? ids[0] : `${ids.length} prompts (${ids.slice(0, 3).join(", ")}${ids.length > 3 ? "…" : ""})`}</td>
            <td className={TD}>{first.changed_by}</td>
            <td className={`${TD} whitespace-nowrap`}>{fecha(first.created_at)}</td>
            <td className={TD}>{first.reverted_at ? <span className="text-xs text-zinc-400">deshecho</span> : <UndoButton batchId={first.batch_id} />}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
