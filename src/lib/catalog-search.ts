/* Busqueda por palabra del catalogo (D28, 2026-10-23).
 *
 * Funciones puras: normalizan, tokenizan y puntuan un indice de prompts ya cargado. No leen la
 * base; el indice lo carga catalog-search-server.ts. Busca en espanol e ingles a la vez, ignora
 * acentos y mayusculas, entiende el codigo (BR-0003, br0003) y tolera un error de dedo en
 * palabras de 4 a 6 letras y dos en las de 7 o mas («brnd» encuentra «brand»).
 *
 * Todas las palabras de la consulta tienen que aparecer (Y logico), salvo las palabras vacias
 * («de», «para», «the»...). Para frases largas esta la busqueda inteligente. */
import {
  AI_TOOLS,
  VERTICALS,
  aiModelLabel,
  type AiGroup,
  type Category,
  type Difficulty,
  type Prompt,
  type Tier,
} from "@/types/prompt";
import { VERTICAL_LABEL_ES } from "@/lib/i18n";

export type CatalogRow = Pick<
  Prompt,
  "id" | "title_en" | "title_es" | "category" | "subcategory" | "ai_model" | "difficulty" | "tier" | "tags" | "is_featured"
>;

export interface CatalogFilters {
  category?: Category;
  difficulty?: Difficulty;
  tier?: Tier;
  aiGroup?: AiGroup;
}

interface IndexedRow {
  row: CatalogRow;
  compactId: string;
  titleEs: string[];
  titleEn: string[];
  meta: string[];
  tags: string[];
}

export interface CatalogIndex {
  rows: IndexedRow[];
  vocab: string[];
}

export const MAX_QUERY_LENGTH = 100;
const MAX_TOKENS = 8;

const STOPWORDS = new Set([
  // es
  "de", "del", "la", "las", "el", "los", "un", "una", "unos", "unas", "y", "o", "en", "para",
  "por", "con", "sin", "que", "mi", "mis", "tu", "tus", "su", "sus", "al", "lo", "se", "como",
  // en
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "my", "your", "how",
]);

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

export function queryTokens(q: string): string[] {
  const all = tokenize(q.slice(0, MAX_QUERY_LENGTH));
  const meaningful = all.filter((t) => !STOPWORDS.has(t));
  return (meaningful.length > 0 ? meaningful : all).slice(0, MAX_TOKENS);
}

/* Distancia de edicion con corte: devuelve max + 1 en cuanto se pasa. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/* Que tan bien una palabra de la consulta encaja con una palabra del indice (0 a 1). */
export function tokenMatch(q: string, w: string): number {
  if (q === w) return 1;
  if (q.length >= 2 && w.startsWith(q)) return 0.8;
  if (q.length >= 3 && w.includes(q)) return 0.6;
  if (q.length >= 4 && !/^\d+$/.test(q)) {
    const max = q.length >= 7 ? 2 : 1;
    const d = Math.min(
      editDistance(q, w, max),
      editDistance(q, w.slice(0, q.length), max),
      editDistance(q, w.slice(0, q.length + 1), max),
    );
    if (d <= max) return 0.4;
  }
  return 0;
}

export function buildIndex(rows: CatalogRow[]): CatalogIndex {
  const vocab = new Set<string>();
  const indexed = rows.map((row) => {
    const titleEs = tokenize(row.title_es ?? "");
    const titleEn = tokenize(row.title_en ?? "");
    const meta = tokenize(
      [
        VERTICAL_LABEL_ES[row.category] ?? "",
        VERTICALS[row.category]?.label_en ?? "",
        row.subcategory ?? "",
        aiModelLabel(row.ai_model ?? ""),
      ].join(" "),
    );
    const tags = tokenize((row.tags ?? []).join(" "));
    for (const t of [...titleEs, ...titleEn, ...meta, ...tags]) vocab.add(t);
    return { row, compactId: normalize(row.id).replace(/ /g, ""), titleEs, titleEn, meta, tags };
  });
  return { rows: indexed, vocab: [...vocab] };
}

/* Mismo criterio que listPrompts() en src/lib/supabase/queries.ts para el filtro de herramienta. */
function modelsForGroup(group: AiGroup): Set<string> {
  const models = AI_TOOLS.filter((t) => t.group === group).map((t) => t.key);
  if (group === "image") models.push("dall-e");
  if (group === "any") models.push("generic");
  return new Set(models);
}

function passesFilters(row: CatalogRow, f: CatalogFilters, groupModels: Set<string> | null): boolean {
  if (f.category && row.category !== f.category) return false;
  if (f.difficulty && row.difficulty !== f.difficulty) return false;
  if (f.tier && row.tier !== f.tier) return false;
  if (groupModels && !groupModels.has(row.ai_model)) return false;
  return true;
}

export function searchCatalog(
  index: CatalogIndex,
  q: string,
  filters: CatalogFilters,
  lang: "es" | "en",
): CatalogRow[] {
  const tokens = queryTokens(q);
  if (tokens.length === 0) return [];
  const compactQ = normalize(q).replace(/ /g, "");
  const groupModels = filters.aiGroup ? modelsForGroup(filters.aiGroup) : null;

  // Cada palabra de la consulta se compara una sola vez contra el vocabulario.
  const quality = tokens.map((t) => {
    const m = new Map<string, number>();
    for (const w of index.vocab) {
      const s = tokenMatch(t, w);
      if (s > 0) m.set(w, s);
    }
    return m;
  });

  const best = (m: Map<string, number>, words: string[], weight: number) => {
    let top = 0;
    for (const w of words) {
      const s = m.get(w);
      if (s && s * weight > top) top = s * weight;
    }
    return top;
  };

  const scored: { row: CatalogRow; score: number }[] = [];
  for (const r of index.rows) {
    if (!passesFilters(r.row, filters, groupModels)) continue;

    let score = 0;
    if (compactQ.length >= 3 && /\d/.test(compactQ)) {
      if (r.compactId === compactQ) score += 1000;
      else if (r.compactId.startsWith(compactQ)) score += 500;
    }

    const own = lang === "es" ? r.titleEs : r.titleEn;
    const other = lang === "es" ? r.titleEn : r.titleEs;
    let all = true;
    let textScore = 0;
    for (let i = 0; i < tokens.length; i++) {
      const m = quality[i];
      const s = Math.max(best(m, own, 3), best(m, other, 2), best(m, r.meta, 1.5), best(m, r.tags, 1));
      if (s === 0) {
        all = false;
        break;
      }
      textScore += s;
    }
    if (all) score += textScore;
    if (score === 0) continue;
    if (r.row.is_featured) score += 0.1;
    scored.push({ row: r.row, score });
  }

  scored.sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id));
  return scored.map((s) => s.row);
}
