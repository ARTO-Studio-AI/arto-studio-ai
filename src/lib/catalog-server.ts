import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyFilter,
  describePatch,
  EMBED_FIELDS,
  embedSource,
  nextId,
  nextValues,
  patchColumns,
  type BulkPatch,
  type CatalogFilter,
  type EmbedFields,
  type PromptInput,
} from "@/lib/catalog";

/* Catalogo de /admin, lado servidor (fase 2, 2026-10-12). Todo va con service role y cada
 * cambio deja historial en catalog_changes con el valor anterior, para poder deshacerlo. */

export const BULK_MAX = 3500; // todo el catalogo cabe (3,001 prompts hoy)
const CHUNK = 200;

type Row = Record<string, unknown> & { id: string };

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Ids que cumplen el filtro (o que vienen seleccionados), con tope. */
export async function resolveIds(input: { ids?: string[]; filter?: CatalogFilter }): Promise<{ ids: string[]; capped: boolean }> {
  if (input.ids?.length) {
    const ids = [...new Set(input.ids.filter((x) => /^[A-Z]{2}-\d{4}$/.test(x)))].slice(0, BULK_MAX);
    return { ids, capped: false };
  }
  const sb = createAdminClient();
  const { data, error } = await applyFilter(sb.from("prompts").select("id"), input.filter ?? {})
    .order("id")
    .limit(BULK_MAX + 1);
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => (r as Row).id);
  return { ids: ids.slice(0, BULK_MAX), capped: ids.length > BULK_MAX };
}

let openai: OpenAI | null = null;
function client(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY para calcular embeddings.");
  openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

/** Recalcula el embedding de estos prompts con la receta original. Devuelve cuantos. */
export async function refreshEmbeddings(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const sb = createAdminClient();
  let done = 0;
  for (const part of chunks(ids, 100)) {
    const { data, error } = await sb.from("prompts").select(["id", ...EMBED_FIELDS].join(", ")).in("id", part);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as (EmbedFields & { id: string })[];
    if (!rows.length) continue;
    const resp = await client().embeddings.create({ model: "text-embedding-3-small", input: rows.map(embedSource) });
    for (let i = 0; i < rows.length; i++) {
      const vec = `[${resp.data[i].embedding.join(",")}]`;
      const { error: upErr } = await sb.from("prompts").update({ embedding: vec }).eq("id", rows[i].id);
      if (upErr) throw new Error(upErr.message);
      done++;
    }
  }
  return done;
}

async function writeHistory(rows: { batch_id: string; entity_id: string; action: "create" | "update"; summary: string; before: unknown; after: unknown; changed_by: string }[]) {
  const sb = createAdminClient();
  for (const part of chunks(rows, 500)) {
    const { error } = await sb.from("catalog_changes").insert(part.map((r) => ({ ...r, entity: "prompt" })));
    if (error) throw new Error(`No se pudo guardar el historial: ${error.message}`);
  }
}

/** Aplica un cambio por lote. Primero guarda el historial; si eso falla, no toca nada. */
export async function applyBulk(ids: string[], patch: BulkPatch, by: string): Promise<{ batchId: string; changed: number; summary: string }> {
  const sb = createAdminClient();
  const cols = patchColumns(patch);
  const now = new Date().toISOString();
  const summary = describePatch(patch);
  const batchId = randomUUID();

  const befores: Row[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await sb.from("prompts").select(["id", ...cols].join(", ")).in("id", part);
    if (error) throw new Error(error.message);
    befores.push(...((data ?? []) as unknown as Row[]));
  }

  const changes = befores
    .map((b) => {
      const after = nextValues(b, patch, now);
      const before: Record<string, unknown> = {};
      for (const k of Object.keys(after)) before[k] = b[k] ?? null;
      const same = Object.keys(after).every((k) => JSON.stringify(after[k]) === JSON.stringify(before[k]));
      return same ? null : { id: b.id, before, after };
    })
    .filter((c): c is { id: string; before: Record<string, unknown>; after: Record<string, unknown> } => c !== null);

  if (!changes.length) return { batchId, changed: 0, summary };

  await writeHistory(changes.map((c) => ({ batch_id: batchId, entity_id: c.id, action: "update", summary, before: c.before, after: c.after, changed_by: by })));

  // Lo que no depende del valor anterior va en un solo update por bloque; las etiquetas y
  // featured_at (que dependen de cada fila) van fila por fila.
  const perRow = patch.add_tags || patch.remove_tags || patch.is_featured !== undefined;
  if (!perRow) {
    const shared = changes[0].after;
    for (const part of chunks(changes.map((c) => c.id))) {
      const { error } = await sb.from("prompts").update({ ...shared, updated_at: now }).in("id", part);
      if (error) throw new Error(error.message);
    }
  } else {
    for (const c of changes) {
      const { error } = await sb.from("prompts").update({ ...c.after, updated_at: now }).eq("id", c.id);
      if (error) throw new Error(error.message);
    }
  }

  // La vertical y las etiquetas entran en el texto del embedding.
  if (patch.category || patch.add_tags || patch.remove_tags) await refreshEmbeddings(changes.map((c) => c.id));
  return { batchId, changed: changes.length, summary };
}

/** Deshace un lote: devuelve cada fila a su valor anterior y marca el lote como revertido. */
export async function undoBatch(batchId: string, by: string): Promise<number> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("catalog_changes")
    .select("id, entity_id, action, before, after")
    .eq("batch_id", batchId)
    .is("reverted_at", null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: number; entity_id: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> }[];
  if (!rows.length) return 0;
  const now = new Date().toISOString();
  const reembed: string[] = [];
  for (const r of rows) {
    if (r.action === "create") {
      // Un alta no se borra: se despublica.
      const { error: e } = await sb.from("prompts").update({ is_published: false, updated_at: now }).eq("id", r.entity_id);
      if (e) throw new Error(e.message);
      continue;
    }
    const { error: e } = await sb.from("prompts").update({ ...(r.before ?? {}), updated_at: now }).eq("id", r.entity_id);
    if (e) throw new Error(e.message);
    if (Object.keys(r.before ?? {}).some((k) => (EMBED_FIELDS as readonly string[]).includes(k))) reembed.push(r.entity_id);
  }
  const { error: markErr } = await sb.from("catalog_changes").update({ reverted_at: now, reverted_by: by }).eq("batch_id", batchId).is("reverted_at", null);
  if (markErr) throw new Error(markErr.message);
  if (reembed.length) await refreshEmbeddings(reembed);
  return rows.length;
}

const EDITABLE = [
  "title_en", "title_es", "prompt_en", "prompt_es", "category", "subcategory", "ai_model",
  "difficulty", "tier", "tags", "use_case", "expected_output", "is_published",
] as const;

/** Alta o edicion desde el editor. Recalcula el embedding si cambio algo que lo afecta. */
export async function savePrompt(id: string | null, input: PromptInput, by: string): Promise<{ id: string; batchId: string }> {
  const sb = createAdminClient();
  const now = new Date().toISOString();
  const batchId = randomUUID();

  if (!id) {
    const code = nextId(input.category, null).split("-")[0];
    const { data: maxRow } = await sb.from("prompts").select("id").like("id", `${code}-%`).order("id", { ascending: false }).limit(1).maybeSingle();
    const newId = nextId(input.category, (maxRow as Row | null)?.id ?? null);
    const row = { id: newId, ...input, author: "ARTO Studio AI", version: "1.0", created_at: now, updated_at: now };
    await writeHistory([{ batch_id: batchId, entity_id: newId, action: "create", summary: "alta", before: null, after: row, changed_by: by }]);
    const { error } = await sb.from("prompts").insert(row);
    if (error) throw new Error(error.message);
    await refreshEmbeddings([newId]);
    return { id: newId, batchId };
  }

  const { data: cur, error: readErr } = await sb.from("prompts").select(EDITABLE.join(", ")).eq("id", id).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!cur) throw new Error("Ese prompt no existe.");
  const current = cur as unknown as Record<string, unknown>;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    const next = (input as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(next) !== JSON.stringify(current[k] ?? null)) {
      before[k] = current[k] ?? null;
      after[k] = next;
    }
  }
  if (!Object.keys(after).length) return { id, batchId };
  await writeHistory([{ batch_id: batchId, entity_id: id, action: "update", summary: `editar ${Object.keys(after).join(", ")}`, before, after, changed_by: by }]);
  const { error } = await sb.from("prompts").update({ ...after, updated_at: now }).eq("id", id);
  if (error) throw new Error(error.message);
  if (Object.keys(after).some((k) => (EMBED_FIELDS as readonly string[]).includes(k))) await refreshEmbeddings([id]);
  return { id, batchId };
}
