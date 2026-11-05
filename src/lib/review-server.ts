import { createAdminClient } from "@/lib/supabase/admin";
import { applyBulk, selectAll } from "@/lib/catalog-server";
import { countPending, pendingBatches, type CreateChange, type PendingBatch, type ReviewRow } from "@/lib/review";
import type { Category } from "@/types/prompt";

/* Revision de prompts nuevos, lado servidor (2026-11-05). Todo va con service role; la
 * tabla prompt_reviews (migracion 0020) esta cerrada a anon y authenticated. Despublicar usa
 * la misma receta del Catalogo (applyBulk): historial en catalog_changes y deshacer. */

const CHUNK = 200;

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Ids de esta lista que existen hoy, con su estado de publicacion. */
async function publishedMap(ids: string[]): Promise<Map<string, boolean>> {
  const sb = createAdminClient();
  const out = new Map<string, boolean>();
  for (const part of chunks([...new Set(ids)])) {
    const { data, error } = await sb.from("prompts").select("id, is_published").in("id", part);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { id: string; is_published: boolean | null }[]) out.set(r.id, r.is_published !== false);
  }
  return out;
}

/** Lotes con prompts por revisar, el mas reciente primero. */
export async function loadPendingBatches(): Promise<PendingBatch[]> {
  const sb = createAdminClient();
  const [creates, reviews] = await Promise.all([
    selectAll<CreateChange>(() =>
      sb.from("catalog_changes").select("batch_id, entity_id, summary, changed_by, created_at, reverted_at").eq("entity", "prompt").eq("action", "create").order("id"),
    ),
    selectAll<ReviewRow>(() => sb.from("prompt_reviews").select("prompt_id, status").in("status", ["approved", "unpublished"]).order("prompt_id")),
  ]);
  const unpublished = reviews.filter((r) => r.status === "unpublished").map((r) => r.prompt_id);
  return pendingBatches(creates, reviews, await publishedMap(unpublished));
}

/** Prompts por revisar, para el contador de la navegacion del admin. null si no se pudo
 * leer (por ejemplo, antes de aplicar la migracion 0020): nunca 0 sin dato. */
export async function pendingReviewCount(): Promise<number | null> {
  try {
    return countPending(await loadPendingBatches());
  } catch {
    return null;
  }
}

export interface ReviewPrompt {
  id: string;
  title_es: string;
  title_en: string;
  category: Category;
  subcategory: string;
  tier: string;
  is_published: boolean;
  use_case: string | null;
  expected_output: string | null;
  prompt_es: string;
  prompt_en: string;
}

/** Datos para la pagina de revision, con el texto completo (solo servidor, 0017). */
export async function loadReviewPrompts(ids: string[]): Promise<Map<string, ReviewPrompt>> {
  const sb = createAdminClient();
  const out = new Map<string, ReviewPrompt>();
  for (const part of chunks(ids, 100)) {
    const { data, error } = await sb
      .from("prompts")
      .select("id, title_es, title_en, category, subcategory, tier, is_published, use_case, expected_output, prompt_es, prompt_en")
      .in("id", part);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as ReviewPrompt[]) out.set(r.id, r);
  }
  return out;
}

async function markReviewed(ids: string[], status: "approved" | "unpublished", by: string, note: string | null): Promise<void> {
  const sb = createAdminClient();
  const now = new Date().toISOString();
  for (const part of chunks(ids)) {
    const { error } = await sb
      .from("prompt_reviews")
      .upsert(part.map((id) => ({ prompt_id: id, status, reviewed_by: by, reviewed_at: now, note })), { onConflict: "prompt_id" });
    if (error) throw new Error(`No se pudo guardar la revisión: ${error.message}`);
  }
}

export interface ReviewResult {
  done: number;
  missing: string[];
  /** Lote de catalog_changes de la despublicacion, para deshacerla; null si no cambio nada. */
  batchId: string | null;
}

/** Aprueba: solo deja la decision, el prompt sigue como esta. */
export async function approvePrompts(ids: string[], by: string, note: string | null = null): Promise<ReviewResult> {
  const exists = await publishedMap(ids);
  const found = ids.filter((id) => exists.has(id));
  await markReviewed(found, "approved", by, note);
  return { done: found.length, missing: ids.filter((id) => !exists.has(id)), batchId: null };
}

/** Despublica con historial (se deshace en /admin/catalogo/historial) y deja la decision.
 * Primero despublica: si guardar la decision falla, el prompt ya no se ve y sigue en la
 * lista para reintentar. */
export async function unpublishPrompts(ids: string[], by: string, note: string | null = null): Promise<ReviewResult> {
  const exists = await publishedMap(ids);
  const found = ids.filter((id) => exists.has(id));
  const res = found.length ? await applyBulk(found, { is_published: false }, by, "revisión") : null;
  await markReviewed(found, "unpublished", by, note);
  return { done: found.length, missing: ids.filter((id) => !exists.has(id)), batchId: res?.changed ? res.batchId : null };
}
