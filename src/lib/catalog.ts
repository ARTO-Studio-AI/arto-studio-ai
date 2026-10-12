import { VERTICALS, type Category } from "@/types/prompt";

/* Catalogo de /admin (rediseno, fase 2, 2026-10-12). Logica pura: filtros, cambios
 * permitidos, validacion del editor y el texto del embedding. Lo que toca la base vive en
 * catalog-server.ts. */

export const CATEGORIES = Object.keys(VERTICALS) as Category[];
export const TIERS = ["free", "pro"] as const;
export const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;
export const PENDING = ["sin_embedding", "no_publicado", "destacado"] as const;
export type Pending = (typeof PENDING)[number];

export interface CatalogFilter {
  q?: string;
  category?: Category;
  tier?: (typeof TIERS)[number];
  published?: "si" | "no";
  ai_model?: string;
  difficulty?: (typeof DIFFICULTIES)[number];
  featured?: "si";
  pending?: Pending;
}

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const str = (v: unknown) => (typeof one(v) === "string" ? (one(v) as string).trim() : "");

/** Lee y valida el filtro desde la URL o desde un cuerpo JSON. Lo que no es valido se ignora. */
export function parseFilter(raw: Record<string, unknown>): CatalogFilter {
  const f: CatalogFilter = {};
  const q = str(raw.q).slice(0, 100);
  if (q) f.q = q;
  const cat = str(raw.category);
  if ((CATEGORIES as string[]).includes(cat)) f.category = cat as Category;
  const tier = str(raw.tier);
  if ((TIERS as readonly string[]).includes(tier)) f.tier = tier as CatalogFilter["tier"];
  const pub = str(raw.published);
  if (pub === "si" || pub === "no") f.published = pub;
  const model = str(raw.ai_model);
  if (/^[a-z0-9_.-]{1,40}$/i.test(model)) f.ai_model = model;
  const diff = str(raw.difficulty);
  if ((DIFFICULTIES as readonly string[]).includes(diff)) f.difficulty = diff as CatalogFilter["difficulty"];
  if (str(raw.featured) === "si") f.featured = "si";
  const pending = str(raw.pending);
  if ((PENDING as readonly string[]).includes(pending)) f.pending = pending as Pending;
  return f;
}

export function filterToParams(f: CatalogFilter): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (v) out[k] = String(v);
  return out;
}

/** Texto seguro para el or() de PostgREST: sin coma, parentesis, comillas ni comodines. */
export function safeSearch(q: string): string {
  return q.replace(/[%_,()"*\\]/g, "").trim();
}

/* Builder minimo que necesitamos de supabase-js. Los genericos de supabase-js hacen que
 * TypeScript se pierda (TS2589), asi que se pasa por este tipo y se devuelve el original. */
export interface CatalogQuery {
  eq(col: string, v: unknown): CatalogQuery;
  is(col: string, v: null): CatalogQuery;
  or(expr: string): CatalogQuery;
}

export function applyFilter<T>(query: T, f: CatalogFilter): T {
  return applyFilterTo(query as unknown as CatalogQuery, f) as unknown as T;
}

function applyFilterTo(query: CatalogQuery, f: CatalogFilter): CatalogQuery {
  let q = query;
  if (f.q) {
    const s = safeSearch(f.q);
    if (s) {
      const like = `%${s}%`;
      q = q.or(
        ["id", "title_en", "title_es", "use_case", "subcategory", "prompt_en", "prompt_es"].map((c) => `${c}.ilike.${like}`).join(","),
      );
    }
  }
  if (f.category) q = q.eq("category", f.category);
  if (f.tier) q = q.eq("tier", f.tier);
  if (f.published) q = q.eq("is_published", f.published === "si");
  if (f.ai_model) q = q.eq("ai_model", f.ai_model);
  if (f.difficulty) q = q.eq("difficulty", f.difficulty);
  if (f.featured) q = q.eq("is_featured", true);
  if (f.pending === "sin_embedding") q = q.is("embedding", null);
  if (f.pending === "no_publicado") q = q.eq("is_published", false);
  if (f.pending === "destacado") q = q.eq("is_featured", true);
  return q;
}

/* Cambios por lotes permitidos. Nada mas se puede tocar por lote. */
export interface BulkPatch {
  is_published?: boolean;
  tier?: (typeof TIERS)[number];
  is_featured?: boolean;
  category?: Category;
  add_tags?: string[];
  remove_tags?: string[];
}

const TAG_RE = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,39}$/u;

function cleanTags(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const tags = v.map((t) => (typeof t === "string" ? t.trim().toLowerCase() : "")).filter((t) => TAG_RE.test(t));
  return tags.length ? [...new Set(tags)].slice(0, 20) : null;
}

/** Valida el cambio. Devuelve null si no hay nada valido que aplicar. */
export function parsePatch(raw: unknown): BulkPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p: BulkPatch = {};
  if (typeof r.is_published === "boolean") p.is_published = r.is_published;
  if (typeof r.tier === "string" && (TIERS as readonly string[]).includes(r.tier)) p.tier = r.tier as BulkPatch["tier"];
  if (typeof r.is_featured === "boolean") p.is_featured = r.is_featured;
  if (typeof r.category === "string" && (CATEGORIES as string[]).includes(r.category)) p.category = r.category as Category;
  const add = cleanTags(r.add_tags);
  if (add) p.add_tags = add;
  const remove = cleanTags(r.remove_tags);
  if (remove) p.remove_tags = remove;
  return Object.keys(p).length ? p : null;
}

/** Resumen legible de un cambio, para el historial y la confirmacion. */
export function describePatch(p: BulkPatch): string {
  const parts: string[] = [];
  if (p.is_published !== undefined) parts.push(p.is_published ? "publicar" : "despublicar");
  if (p.tier) parts.push(p.tier === "pro" ? "pasar a Pro" : "pasar a gratis");
  if (p.is_featured !== undefined) parts.push(p.is_featured ? "destacar" : "quitar de destacados");
  if (p.category) parts.push(`mover a ${VERTICALS[p.category].label_es}`);
  if (p.add_tags) parts.push(`agregar etiquetas ${p.add_tags.join(", ")}`);
  if (p.remove_tags) parts.push(`quitar etiquetas ${p.remove_tags.join(", ")}`);
  return parts.join(" · ");
}

/** Columnas que lee y escribe un cambio por lote. */
export function patchColumns(p: BulkPatch): string[] {
  const cols = new Set<string>();
  if (p.is_published !== undefined) cols.add("is_published");
  if (p.tier) cols.add("tier");
  if (p.is_featured !== undefined) { cols.add("is_featured"); cols.add("featured_at"); }
  if (p.category) cols.add("category");
  if (p.add_tags || p.remove_tags) cols.add("tags");
  return [...cols];
}

/** Valores nuevos de una fila a partir de su estado anterior. */
export function nextValues(before: Record<string, unknown>, p: BulkPatch, now: string): Record<string, unknown> {
  const after: Record<string, unknown> = {};
  if (p.is_published !== undefined) after.is_published = p.is_published;
  if (p.tier) after.tier = p.tier;
  if (p.is_featured !== undefined) {
    after.is_featured = p.is_featured;
    after.featured_at = p.is_featured ? (before.is_featured ? before.featured_at ?? now : now) : null;
  }
  if (p.category) after.category = p.category;
  if (p.add_tags || p.remove_tags) {
    const cur = Array.isArray(before.tags) ? (before.tags as string[]) : [];
    const remove = new Set(p.remove_tags ?? []);
    after.tags = [...new Set([...cur.filter((t) => !remove.has(t)), ...(p.add_tags ?? [])])];
  }
  return after;
}

/* El texto del embedding: la misma receta que asai-prompt-library/scripts/embed-prompts.ts,
 * con la que se calcularon los 3,000 vectores actuales. Si cambia, la busqueda mezcla
 * vectores incompatibles. */
export interface EmbedFields {
  title_en: string;
  title_es: string;
  category: string;
  subcategory: string;
  use_case: string | null;
  tags: string[] | null;
}

export function embedSource(p: EmbedFields): string {
  const subcat = p.subcategory.replace(/_/g, " ");
  const cat = p.category.replace(/_/g, " ");
  const tags = (p.tags || []).join(", ");
  return [p.title_en, p.title_es, `Category: ${cat} / ${subcat}.`, p.use_case ? `Use case: ${p.use_case}` : "", tags ? `Tags: ${tags}` : ""]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
}

export const EMBED_FIELDS = ["title_en", "title_es", "category", "subcategory", "use_case", "tags"] as const;

/* Editor de un prompt. */
export interface PromptInput {
  title_en: string;
  title_es: string;
  prompt_en: string;
  prompt_es: string;
  category: Category;
  subcategory: string;
  ai_model: string;
  difficulty: (typeof DIFFICULTIES)[number];
  tier: (typeof TIERS)[number];
  tags: string[];
  use_case: string | null;
  expected_output: string | null;
  is_published: boolean;
}

export function parsePromptInput(raw: unknown): { ok: true; value: PromptInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Faltan los datos del prompt." };
  const r = raw as Record<string, unknown>;
  const text = (k: string, max: number, required = true) => {
    const v = typeof r[k] === "string" ? (r[k] as string).trim() : "";
    if (required && !v) throw new Error(`Falta «${k}».`);
    if (v.length > max) throw new Error(`«${k}» pasa de ${max} caracteres.`);
    return v;
  };
  try {
    const category = text("category", 40);
    if (!(CATEGORIES as string[]).includes(category)) throw new Error("Vertical no valida.");
    const difficulty = text("difficulty", 20);
    if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) throw new Error("Dificultad no valida.");
    const tier = text("tier", 10);
    if (!(TIERS as readonly string[]).includes(tier)) throw new Error("Plan no valido.");
    const subcategory = text("subcategory", 60).toLowerCase().replace(/\s+/g, "_");
    if (!/^[a-z0-9_]+$/.test(subcategory)) throw new Error("La subcategoria solo lleva letras, numeros y guion bajo.");
    const ai_model = text("ai_model", 40);
    if (!/^[a-z0-9_.-]+$/i.test(ai_model)) throw new Error("Modelo de IA no valido.");
    return {
      ok: true,
      value: {
        title_en: text("title_en", 200),
        title_es: text("title_es", 200),
        prompt_en: text("prompt_en", 20000),
        prompt_es: text("prompt_es", 20000),
        category: category as Category,
        subcategory,
        ai_model,
        difficulty: difficulty as PromptInput["difficulty"],
        tier: tier as PromptInput["tier"],
        tags: cleanTags(r.tags) ?? [],
        use_case: text("use_case", 1000, false) || null,
        expected_output: text("expected_output", 2000, false) || null,
        is_published: r.is_published === true,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Datos no validos." };
  }
}

/** Compara dos valores del catalogo. Las fechas se comparan como instante: la app guarda
 * «...00.123Z» y PostgREST devuelve «...00.123000+00:00» (auditoria de Fable de 0d29df8). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a) && /^\d{4}-\d{2}-\d{2}T/.test(b)) {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta === tb;
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Siguiente ID de una vertical a partir del mayor existente («BR-0251» → «BR-0252»). */
export function nextId(category: Category, maxExisting: string | null): string {
  const code = VERTICALS[category].code;
  const n = maxExisting ? Number(maxExisting.split("-")[1]) : 0;
  return `${code}-${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, "0")}`;
}
