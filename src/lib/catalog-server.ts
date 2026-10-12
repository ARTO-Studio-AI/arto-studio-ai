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
  sameValue,
  CSV_WRITABLE,
  type BulkPatch,
  type ImportRow,
  type CatalogFilter,
  type EmbedFields,
  type PromptInput,
} from "@/lib/catalog";

/* Catalogo de /admin, lado servidor (fase 2, 2026-10-12). Todo va con service role y cada
 * cambio deja historial en catalog_changes con el valor anterior, para poder deshacerlo.
 *
 * Dos limites que mandan el diseno (auditoria de Fable de d9ba218):
 *  - PostgREST devuelve como mucho 1,000 filas por consulta: toda lectura grande pagina
 *    con selectAll().
 *  - Vercel corta la funcion a los 60 s: los cambios que van fila por fila tienen tope
 *    (PER_ROW_MAX) y los embeddings de lotes grandes no se calculan dentro de la peticion;
 *    se dejan en null y /api/admin/catalogo/embeddings los repone por tandas. */

export const BULK_MAX = 3500; // el catalogo entero (3,001 hoy) para cambios de una columna
export const PER_ROW_MAX = 300; // etiquetas y destacados van fila por fila
const INLINE_EMBED_MAX = 20; // hasta aqui se recalcula dentro de la peticion
const PAGE = 1000; // max-rows de PostgREST en Supabase
const CHUNK = 200;

type Row = Record<string, unknown> & { id: string };

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* Lee todas las filas de una consulta, de 1,000 en 1,000. `make` debe devolver la consulta
 * ya ordenada, sin range. */
export async function selectAll<T>(make: () => { range(from: number, to: number): PromiseLike<{ data: unknown; error: { message: string } | null }> }, cap = 20000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/** Valores distintos de una columna del catalogo (para los selectores). */
export async function distinctValues(column: "ai_model" | "subcategory"): Promise<string[]> {
  const sb = createAdminClient();
  const rows = await selectAll<Record<string, string>>(() => sb.from("prompts").select(column).order("id"));
  return [...new Set(rows.map((r) => r[column]).filter(Boolean))].sort();
}

/** Ids que cumplen el filtro (o que vienen seleccionados), con tope. */
export async function resolveIds(input: { ids?: string[]; filter?: CatalogFilter }): Promise<{ ids: string[]; capped: boolean }> {
  if (input.ids?.length) {
    const ids = [...new Set(input.ids.filter((x) => /^[A-Z]{2}-\d{4}$/.test(x)))];
    return { ids: ids.slice(0, BULK_MAX), capped: ids.length > BULK_MAX };
  }
  const sb = createAdminClient();
  const rows = await selectAll<Row>(() => applyFilter(sb.from("prompts").select("id"), input.filter ?? {}).order("id"), BULK_MAX + PAGE);
  const ids = rows.map((r) => r.id);
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
    // Las actualizaciones van en paralelo de 25 en 25 para caber en el tiempo de la funcion.
    const pairs = rows.map((r, i) => ({ id: r.id, vec: `[${resp.data[i].embedding.join(",")}]` }));
    for (const group of chunks(pairs, 25)) {
      const results = await Promise.all(group.map((p) => sb.from("prompts").update({ embedding: p.vec }).eq("id", p.id)));
      const failed = results.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
    }
    done += rows.length;
  }
  return done;
}

/* Recalcula ahora si son pocos; si son muchos, los deja en null para que /embeddings los
 * reponga por tandas (el contador «sin embedding» los muestra). Devuelve cuantos quedaron
 * pendientes. */
export async function refreshOrQueue(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  if (ids.length <= INLINE_EMBED_MAX) {
    await refreshEmbeddings(ids);
    return 0;
  }
  const sb = createAdminClient();
  for (const part of chunks(ids)) {
    const { error } = await sb.from("prompts").update({ embedding: null }).in("id", part);
    if (error) throw new Error(error.message);
  }
  return ids.length;
}

export async function writeHistory(rows: { batch_id: string; entity_id: string; action: "create" | "update"; summary: string; before: unknown; after: unknown; changed_by: string }[]) {
  const sb = createAdminClient();
  for (const part of chunks(rows, 500)) {
    const { error } = await sb.from("catalog_changes").insert(part.map((r) => ({ ...r, entity: "prompt" })));
    if (error) throw new Error(`No se pudo guardar el historial: ${error.message}`);
  }
}

export interface BulkResult {
  batchId: string;
  changed: number;
  summary: string;
  embeddingsPending: number;
}

/** True si el cambio va fila por fila (y por eso tiene tope menor). */
export function isPerRow(patch: BulkPatch): boolean {
  return Boolean(patch.add_tags || patch.remove_tags || patch.is_featured !== undefined);
}

/** Aplica un cambio por lote. Primero guarda el historial; si eso falla, no toca nada. */
export async function applyBulk(ids: string[], patch: BulkPatch, by: string): Promise<BulkResult> {
  const perRow = isPerRow(patch);
  if (perRow && ids.length > PER_ROW_MAX) throw new Error(`Etiquetas y destacados van de ${PER_ROW_MAX} en ${PER_ROW_MAX}. Acota el filtro o la selección.`);
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
      const same = Object.keys(after).every((k) => sameValue(after[k], before[k]));
      return same ? null : { id: b.id, before, after };
    })
    .filter((c): c is { id: string; before: Record<string, unknown>; after: Record<string, unknown> } => c !== null);

  if (!changes.length) return { batchId, changed: 0, summary, embeddingsPending: 0 };

  await writeHistory(changes.map((c) => ({ batch_id: batchId, entity_id: c.id, action: "update", summary, before: c.before, after: c.after, changed_by: by })));

  if (!perRow) {
    // Mismo valor para todas las filas: un update por bloque de 200.
    const shared = changes[0].after;
    for (const part of chunks(changes.map((c) => c.id))) {
      const { error } = await sb.from("prompts").update({ ...shared, updated_at: now }).in("id", part);
      if (error) throw new Error(error.message);
    }
  } else {
    // Etiquetas y featured_at dependen de cada fila: en paralelo por bloques de 25.
    for (const part of chunks(changes, 25)) {
      const results = await Promise.all(part.map((c) => sb.from("prompts").update({ ...c.after, updated_at: now }).eq("id", c.id)));
      const failed = results.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
    }
  }

  // La vertical y las etiquetas entran en el texto del embedding.
  const embeddingsPending = patch.category || patch.add_tags || patch.remove_tags ? await refreshOrQueue(changes.map((c) => c.id)) : 0;
  return { batchId, changed: changes.length, summary, embeddingsPending };
}

interface ChangeRow {
  id: number;
  entity_id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}

/** Deshace un lote. Solo restaura las filas que siguen con el valor que dejo el lote: si
 * alguien las cambio despues, se saltan y se reportan, para no pisar ese cambio. */
export async function undoBatch(batchId: string, by: string): Promise<{ reverted: number; skipped: string[]; embeddingsPending: number }> {
  const sb = createAdminClient();
  const rows = await selectAll<ChangeRow>(() =>
    sb.from("catalog_changes").select("id, entity_id, action, before, after").eq("batch_id", batchId).is("reverted_at", null).order("id"),
  );
  if (!rows.length) return { reverted: 0, skipped: [], embeddingsPending: 0 };
  const now = new Date().toISOString();

  // Estado actual de las columnas que toco el lote.
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r.action === "create" ? { is_published: true } : r.after)))];
  const current = new Map<string, Row>();
  for (const part of chunks(rows.map((r) => r.entity_id))) {
    const { data, error } = await sb.from("prompts").select(["id", ...keys].join(", ")).in("id", part);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as unknown as Row[]) current.set(r.id, r);
  }

  const restored: number[] = [];
  const skipped: string[] = [];
  const reembed: string[] = [];
  const todo: { row: ChangeRow; values: Record<string, unknown> }[] = [];
  for (const r of rows) {
    const cur = current.get(r.entity_id);
    if (!cur) { skipped.push(r.entity_id); continue; }
    if (r.action === "create") {
      // Un alta no se borra: se despublica.
      todo.push({ row: r, values: { is_published: false } });
      continue;
    }
    const untouched = Object.keys(r.after).every((k) => sameValue(cur[k], r.after[k]));
    if (!untouched) { skipped.push(r.entity_id); continue; }
    todo.push({ row: r, values: r.before ?? {} });
    if (Object.keys(r.before ?? {}).some((k) => (EMBED_FIELDS as readonly string[]).includes(k))) reembed.push(r.entity_id);
  }

  for (const part of chunks(todo, 25)) {
    const results = await Promise.all(part.map((t) => sb.from("prompts").update({ ...t.values, updated_at: now }).eq("id", t.row.entity_id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    // Se marca cada tanda al terminarla: si una falla despues, las ya restauradas no quedan
    // como vigentes en el historial.
    const ids = part.map((t) => t.row.id);
    const { error } = await sb.from("catalog_changes").update({ reverted_at: now, reverted_by: by }).in("id", ids);
    if (error) throw new Error(error.message);
    restored.push(...ids);
  }
  const embeddingsPending = await refreshOrQueue(reembed);
  return { reverted: restored.length, skipped, embeddingsPending };
}

const EDITABLE = [
  "title_en", "title_es", "prompt_en", "prompt_es", "category", "subcategory", "ai_model",
  "difficulty", "tier", "tags", "use_case", "expected_output", "is_published",
] as const;

async function nextFreeId(category: PromptInput["category"]): Promise<string> {
  const code = nextId(category, null).split("-")[0];
  const { data } = await createAdminClient().from("prompts").select("id").like("id", `${code}-%`).order("id", { ascending: false }).limit(1).maybeSingle();
  return nextId(category, (data as Row | null)?.id ?? null);
}

/** Alta o edicion desde el editor. Recalcula el embedding si cambio algo que lo afecta. */
export async function savePrompt(id: string | null, input: PromptInput, by: string): Promise<{ id: string; batchId: string }> {
  const sb = createAdminClient();
  const now = new Date().toISOString();
  const batchId = randomUUID();

  if (!id) {
    // En un alta se inserta primero y el historial va despues: si dos altas chocan por el
    // mismo ID, la segunda reintenta una vez con el siguiente y no queda historial huerfano.
    let newId = await nextFreeId(input.category);
    let row = { id: newId, ...input, author: "ARTO Studio AI", version: "1.0", created_at: now, updated_at: now };
    let { error } = await sb.from("prompts").insert(row);
    if (error?.code === "23505") {
      newId = await nextFreeId(input.category);
      row = { ...row, id: newId };
      ({ error } = await sb.from("prompts").insert(row));
    }
    if (error) throw new Error(error.message);
    await writeHistory([{ batch_id: batchId, entity_id: newId, action: "create", summary: "alta", before: null, after: row, changed_by: by }]);
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

/* ── Importacion CSV (2026-10-12) ────────────────────────────────────────────────── */

export interface ImportPlanRow {
  line: number;
  id: string | null;
  action: "create" | "update" | "same" | "error";
  fields: string[];
  errors: string[];
  title: string;
}

interface PlannedChange {
  row: ImportRow;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/** Compara el CSV con el catalogo y dice que pasaria con cada fila, sin tocar nada. */
export async function planImport(rows: ImportRow[]): Promise<{ plan: ImportPlanRow[]; changes: PlannedChange[]; creates: ImportRow[] }> {
  const sb = createAdminClient();
  const ids = [...new Set(rows.map((r) => r.id).filter((x): x is string => Boolean(x)))];
  const existing = new Map<string, Row>();
  for (const part of chunks(ids)) {
    const { data, error } = await sb.from("prompts").select(["id", ...CSV_WRITABLE].join(", ")).in("id", part);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as unknown as Row[]) existing.set(r.id, r);
  }
  const seen = new Set<string>();
  const plan: ImportPlanRow[] = [];
  const changes: PlannedChange[] = [];
  const creates: ImportRow[] = [];
  for (const row of rows) {
    const title = String(row.values.title_es ?? (row.id ? existing.get(row.id)?.title_es ?? "" : ""));
    const errors = [...row.errors];
    if (row.id && seen.has(row.id)) errors.push(`${row.id} aparece dos veces en el CSV`);
    if (row.id) seen.add(row.id);
    if (row.id && !existing.has(row.id)) errors.push(`${row.id} no existe (deja el id vacío para dar de alta)`);
    if (errors.length) {
      plan.push({ line: row.line, id: row.id, action: "error", fields: [], errors, title });
      continue;
    }
    if (!row.id) {
      creates.push(row);
      plan.push({ line: row.line, id: null, action: "create", fields: Object.keys(row.values), errors: [], title });
      continue;
    }
    const cur = existing.get(row.id)!;
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row.values)) {
      if (!sameValue(cur[k], v)) {
        before[k] = cur[k] ?? null;
        after[k] = v;
      }
    }
    const fields = Object.keys(after);
    if (fields.length) changes.push({ row, before, after });
    plan.push({ line: row.line, id: row.id, action: fields.length ? "update" : "same", fields, errors: [], title });
  }
  return { plan, changes, creates };
}

/** Aplica una importacion ya planeada como un solo lote (un batch_id para deshacerlo). */
export async function applyImport(
  changes: PlannedChange[],
  creates: ImportRow[],
  by: string,
): Promise<{ batchId: string; updated: number; created: string[]; embeddingsPending: number }> {
  const sb = createAdminClient();
  const batchId = randomUUID();
  const now = new Date().toISOString();

  // Ediciones: historial primero, luego los updates en paralelo de 25.
  if (changes.length) {
    await writeHistory(
      changes.map((c) => ({ batch_id: batchId, entity_id: c.row.id!, action: "update", summary: `importar CSV: ${Object.keys(c.after).join(", ")}`, before: c.before, after: c.after, changed_by: by })),
    );
    for (const part of chunks(changes, 25)) {
      const results = await Promise.all(part.map((c) => sb.from("prompts").update({ ...c.after, updated_at: now }).eq("id", c.row.id!)));
      const failed = results.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
    }
  }

  // Altas: los ID se asignan en orden por vertical, a partir del mayor existente.
  const created: string[] = [];
  if (creates.length) {
    const nextByCat = new Map<string, number>();
    const rowsToInsert: Record<string, unknown>[] = [];
    for (const c of creates) {
      const cat = c.values.category as PromptInput["category"];
      if (!nextByCat.has(cat)) {
        const first = await nextFreeId(cat);
        nextByCat.set(cat, Number(first.split("-")[1]));
      }
      const n = nextByCat.get(cat)!;
      nextByCat.set(cat, n + 1);
      const id = `${first2(cat)}-${String(n).padStart(4, "0")}`;
      rowsToInsert.push({
        id,
        tags: [],
        use_case: null,
        expected_output: null,
        ...c.values,
        is_published: false,
        author: "ARTO Studio AI",
        version: "1.0",
        created_at: now,
        updated_at: now,
      });
      created.push(id);
    }
    for (const part of chunks(rowsToInsert, 100)) {
      const { error } = await sb.from("prompts").insert(part);
      if (error) throw new Error(error.code === "23505" ? "Otro alta tomó uno de los ID mientras se importaba. Vuelve a intentar." : error.message);
    }
    await writeHistory(rowsToInsert.map((r) => ({ batch_id: batchId, entity_id: String(r.id), action: "create", summary: "importar CSV: alta", before: null, after: r, changed_by: by })));
  }

  const reembed = [
    ...changes.filter((c) => Object.keys(c.after).some((k) => (EMBED_FIELDS as readonly string[]).includes(k))).map((c) => c.row.id!),
    ...created,
  ];
  const embeddingsPending = await refreshOrQueue(reembed);
  return { batchId, updated: changes.length, created, embeddingsPending };
}

function first2(category: PromptInput["category"]): string {
  return nextId(category, null).split("-")[0];
}
