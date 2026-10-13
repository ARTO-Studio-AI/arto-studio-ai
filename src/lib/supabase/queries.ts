import {
  AI_TOOLS,
  type AiGroup,
  type Category,
  type Difficulty,
  type Prompt,
  type Tier,
} from "@/types/prompt";
import { createClient } from "./server";
import { createAdminClient } from "./admin";

export interface PromptFilters {
  category?: Category;
  difficulty?: Difficulty;
  tier?: Tier;
  aiGroup?: AiGroup;
  search?: string;
  lang?: "en" | "es";
}

const PER_PAGE = 24;

export async function listPrompts(filters: PromptFilters = {}, page = 1) {
  const sb = await createClient();
  let q = sb
    .from("prompts")
    .select(
      "id, title_en, title_es, category, subcategory, ai_model, difficulty, tier, tags, is_featured",
      { count: "exact" },
    )
    .eq("is_published", true);

  if (filters.category) q = q.eq("category", filters.category);
  if (filters.difficulty) q = q.eq("difficulty", filters.difficulty);
  if (filters.tier) q = q.eq("tier", filters.tier);

  if (filters.aiGroup) {
    const models = AI_TOOLS.filter((t) => t.group === filters.aiGroup).map((t) => t.key);
    if (filters.aiGroup === "image") models.push("dall-e");
    if (filters.aiGroup === "any") models.push("generic");
    q = q.in("ai_model", models);
  }

  if (filters.search) {
    const col = filters.lang === "es" ? "title_es" : "title_en";
    q = q.ilike(col, `%${filters.search}%`);
  }

  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;
  q = q.order("id", { ascending: true }).range(from, to);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  return {
    prompts: (data ?? []) as Prompt[],
    total: count ?? 0,
    page,
    perPage: PER_PAGE,
    totalPages: Math.ceil((count ?? 0) / PER_PAGE),
  };
}

/* El texto del prompt (prompt_en, prompt_es) ya no se lee con la llave publica ni con la
 * sesion del usuario: la migracion 0017 se lo quita a anon y authenticated, porque con la
 * anon key cualquiera leia los 2,265 prompts Pro (2026-10-12). Se lee aqui con service
 * role, solo en el servidor; la pagina decide que mostrar segun el plan de quien la ve.
 * service role se salta RLS, asi que el filtro de publicados va explicito. */
export async function getPrompt(id: string) {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("prompts")
    .select(
      "id, title_en, title_es, prompt_en, prompt_es, category, subcategory, ai_model, difficulty, tags, tier, version, author, use_case, expected_output, view_count, copy_count, favorite_count, is_published, created_at, updated_at, is_featured, featured_at, featured_reason",
    )
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Prompt | null;
}

export async function getStats() {
  const sb = await createClient();
  const { count: total } = await sb
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);
  return { total: total ?? 0 };
}

export async function getFeaturedPrompts(limit = 12) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("prompts")
    .select("id, title_en, title_es, category, subcategory, ai_model, difficulty, tier, tags, is_featured")
    .eq("is_published", true)
    .eq("is_featured", true)
    .order("featured_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Prompt[];
}

export async function getDistinctAiModels(): Promise<string[]> {
  const sb = await createClient();
  const { data } = await sb.from("prompts").select("ai_model").eq("is_published", true).limit(2500);
  const set = new Set<string>();
  for (const r of data ?? []) if (r?.ai_model) set.add(r.ai_model as string);
  return [...set].sort();
}
