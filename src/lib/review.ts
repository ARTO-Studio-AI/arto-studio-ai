/* Revision de prompts nuevos en /admin/revision (2026-11-05, ficha de Victor: «Salen y los
 * reviso despues»). Logica pura: que alta sigue pendiente y que acciones se aceptan. Lo que
 * toca la base vive en review-server.ts.
 *
 * Pendiente = alta (action create) en catalog_changes, no deshecha, cuyo prompt no tiene
 * una decision en prompt_reviews. Una decision «unpublished» deja de contar si el prompt
 * volvio a estar disponible despues (por ejemplo, alguien deshizo la despublicacion en el
 * historial): Victor lo vuelve a ver. */

export const REVIEW_STATUSES = ["pending", "approved", "unpublished"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_MAX = 200; // ids por accion; una ronda sube 20
export const NOTE_MAX = 2000; // igual que el check de la migracion 0020
const ID_RE = /^[A-Z]{2}-\d{4}$/;

export interface CreateChange {
  batch_id: string;
  entity_id: string;
  summary: string;
  changed_by: string;
  created_at: string;
  reverted_at: string | null;
}

export interface ReviewRow {
  prompt_id: string;
  status: ReviewStatus;
}

export interface PendingBatch {
  batchId: string;
  summary: string;
  changedBy: string;
  createdAt: string;
  ids: string[];
}

/** Ids con una decision vigente. `publishedNow` dice si cada prompt despublicado en
 * revision esta disponible hoy; si lo esta, la decision ya no vale. */
export function decidedIds(reviews: ReviewRow[], publishedNow: Map<string, boolean>): Set<string> {
  const out = new Set<string>();
  for (const r of reviews) {
    if (r.status === "approved") out.add(r.prompt_id);
    else if (r.status === "unpublished" && publishedNow.get(r.prompt_id) !== true) out.add(r.prompt_id);
  }
  return out;
}

/** Lotes con altas pendientes, el mas reciente primero. Un prompt cuenta una sola vez, en
 * su alta mas reciente. */
export function pendingBatches(creates: CreateChange[], reviews: ReviewRow[], publishedNow: Map<string, boolean> = new Map()): PendingBatch[] {
  const decided = decidedIds(reviews, publishedNow);
  const latest = new Map<string, CreateChange>();
  for (const c of creates) {
    if (c.reverted_at || decided.has(c.entity_id) || !ID_RE.test(c.entity_id)) continue;
    const prev = latest.get(c.entity_id);
    if (!prev || Date.parse(c.created_at) > Date.parse(prev.created_at)) latest.set(c.entity_id, c);
  }
  const batches = new Map<string, PendingBatch>();
  for (const c of latest.values()) {
    const b = batches.get(c.batch_id);
    if (b) {
      b.ids.push(c.entity_id);
      if (Date.parse(c.created_at) < Date.parse(b.createdAt)) b.createdAt = c.created_at;
    } else {
      batches.set(c.batch_id, { batchId: c.batch_id, summary: c.summary, changedBy: c.changed_by, createdAt: c.created_at, ids: [c.entity_id] });
    }
  }
  return [...batches.values()]
    .map((b) => ({ ...b, ids: b.ids.sort() }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.batchId.localeCompare(b.batchId));
}

export const countPending = (batches: PendingBatch[]) => batches.reduce((n, b) => n + b.ids.length, 0);

export type ReviewAction = { action: "approve" | "unpublish"; ids: string[]; note: string | null; confirm: string };

/** Valida el cuerpo de POST /api/admin/catalogo/revision. */
export function parseReviewAction(raw: unknown): { ok: true; value: ReviewAction } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Cuerpo no válido" };
  const r = raw as Record<string, unknown>;
  if (r.action !== "approve" && r.action !== "unpublish") return { ok: false, error: "Acción no válida" };
  if (!Array.isArray(r.ids) || !r.ids.length) return { ok: false, error: "Faltan los prompts" };
  if (!r.ids.every((x) => typeof x === "string" && ID_RE.test(x))) return { ok: false, error: "Hay un ID no válido" };
  const ids = [...new Set(r.ids as string[])];
  if (ids.length > REVIEW_MAX) return { ok: false, error: `Van de ${REVIEW_MAX} en ${REVIEW_MAX} como máximo.` };
  const note = typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, NOTE_MAX) : null;
  return { ok: true, value: { action: r.action, ids, note, confirm: String(r.confirm ?? "") } };
}

/** Despublicar mas de un prompt pide confirmacion escrita: el numero de prompts. */
export function needsConfirm(a: ReviewAction): boolean {
  return a.action === "unpublish" && a.ids.length > 1 && a.confirm !== String(a.ids.length);
}
