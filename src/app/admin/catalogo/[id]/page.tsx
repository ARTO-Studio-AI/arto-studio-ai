import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { fecha, guardAdmin, PageHead, Table, TD } from "../../_kit";
import PromptEditor, { type EditorPrompt } from "../PromptEditor";

/* /admin/catalogo/[id]: editar un prompt y ver su historial. */

export const dynamic = "force-dynamic";

export default async function EditarPrompt({ params }: { params: Promise<{ id: string }> }) {
  await guardAdmin();
  const { id } = await params;
  if (!/^[A-Z]{2}-\d{4}$/.test(id)) notFound();
  const sb = createAdminClient();
  const [{ data }, { data: history }, { data: subs }] = await Promise.all([
    sb.from("prompts").select("id, title_en, title_es, prompt_en, prompt_es, category, subcategory, ai_model, difficulty, tier, tags, use_case, expected_output, is_published, view_count, copy_count, updated_at").eq("id", id).maybeSingle(),
    sb.from("catalog_changes").select("batch_id, summary, changed_by, created_at, reverted_at").eq("entity", "prompt").eq("entity_id", id).order("created_at", { ascending: false }).limit(20),
    sb.from("prompts").select("subcategory").limit(5000),
  ]);
  if (!data) notFound();
  const prompt = data as unknown as EditorPrompt & { view_count: number | null; copy_count: number | null; updated_at: string | null };
  const subcategories = [...new Set(((subs ?? []) as { subcategory: string }[]).map((s) => s.subcategory))].sort();

  return (
    <div>
      <PageHead eyebrow={`Catálogo · ${prompt.id}`} title={prompt.title_es} />
      <p className="-mt-4 mb-6 text-sm text-zinc-500">
        {prompt.view_count ?? 0} vistas · {prompt.copy_count ?? 0} copias · último cambio {fecha(prompt.updated_at)}
      </p>
      <PromptEditor initial={prompt} subcategories={subcategories} />
      <h2 className="text-eyebrow mb-2 mt-10 text-zinc-500">Historial de este prompt</h2>
      <Table head={["Cambio", "Quién", "Cuándo", "Estado"]} empty={(history ?? []).length === 0 && "Sin cambios registrados desde que existe el Catálogo."}>
        {((history ?? []) as { batch_id: string; summary: string; changed_by: string; created_at: string; reverted_at: string | null }[]).map((h) => (
          <tr key={`${h.batch_id}-${h.created_at}`}>
            <td className={TD}>{h.summary}</td>
            <td className={TD}>{h.changed_by}</td>
            <td className={`${TD} whitespace-nowrap`}>{fecha(h.created_at)}</td>
            <td className={TD}>{h.reverted_at ? `deshecho ${fecha(h.reverted_at)}` : "vigente"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
