import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { listPrompts } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { getSubject, getUsed, isUnlimitedTier } from "@/lib/prompt-limit";
import PromptQuota from "@/components/PromptQuota";
import {
  AI_GROUPS,
  CATEGORY_STYLES,
  DIFFICULTY_STYLES,
  TIER_STYLES,
  VERTICALS,
  aiGroupOf,
  type AiGroup,
  type Category,
  type Difficulty,
  type Tier,
} from "@/types/prompt";
import {
  t,
  type Lang,
  AI_GROUP_LABEL_ES,
  DIFFICULTY_LABEL_ES,
  VERTICAL_LABEL_ES,
} from "@/lib/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import SmartSearch from "./SmartSearch";
import DifficultyChip from "@/components/DifficultyChip";
import { Badge } from "@/components/ui";

const CATEGORIES: Category[] = [
  "branding","graphic_design","copywriting","photography","video","ux_ui","illustration","marketing","music","architecture","fashion","creative_productivity",
];
const DIFFICULTIES: Difficulty[] = ["beginner","intermediate","advanced","expert"];
const TIERS: Tier[] = ["free","pro","enterprise"];
const AI_GROUP_LIST: AiGroup[] = ["text","image","video","music","voice","any"];

interface SearchParams {
  category?: string;
  difficulty?: string;
  tier?: string;
  group?: string;
  q?: string;
  page?: string;
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

export default async function CatalogPage({ params, searchParams }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  // Bridge: the catalog's older i18n module uses a Lang alias that is
  // structurally identical to Locale. Pass it through.
  const lang: Lang = locale;
  const dict = t(lang);

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10));

  const { prompts, total, totalPages } = await listPrompts(
    {
      category: sp.category as Category | undefined,
      difficulty: sp.difficulty as Difficulty | undefined,
      tier: sp.tier as Tier | undefined,
      aiGroup: sp.group as AiGroup | undefined,
      search: sp.q || undefined,
      lang,
    },
    page,
  );

  /* Indicador del contador free (D7): "Te quedan N de 3 prompts hoy". Solo
   * para free y anonimos; el listado en si no cuenta como apertura. */
  let quotaUsed: number | null = null;
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    let tier: string | null = null;
    if (user) {
      const { data: profile } = await sb.from("profiles").select("tier").eq("id", user.id).maybeSingle();
      tier = (profile?.tier as string | null) ?? "free";
    }
    if (!isUnlimitedTier(tier)) {
      const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
      const subject = getSubject({
        vid: cookieStore.get("asai_vid")?.value,
        userId: user?.id,
        ip: hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip"),
      });
      quotaUsed = await getUsed(subject);
    }
  } catch {
    quotaUsed = null;
  }

  // qs() preserves filter state across links. Locale lives in the path,
  // not the query, so the language toggle moved to the Nav LangSwitcher.
  const qs = (overrides: Partial<SearchParams>) => {
    const merged = { ...sp, ...overrides };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    return `?${params.toString()}`;
  };

  const labelCategory = (c: Category): string =>
    lang === "es" ? VERTICAL_LABEL_ES[c] ?? VERTICALS[c].label_en : VERTICALS[c].label_en;
  const labelDifficulty = (d: Difficulty): string =>
    lang === "es" ? DIFFICULTY_LABEL_ES[d] ?? DIFFICULTY_STYLES[d].label : DIFFICULTY_STYLES[d].label;
  const labelAiGroup = (g: AiGroup): string =>
    lang === "es" ? AI_GROUP_LABEL_ES[g] ?? AI_GROUPS[g].label : AI_GROUPS[g].label;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1">{dict.catalog}</h1>
          <p className="mt-1 font-mono text-sm text-zinc-500">
            {total.toLocaleString()} prompts · {dict.page_label(page, totalPages || 1)}
          </p>
        </div>
        {quotaUsed !== null && <PromptQuota locale={locale} used={quotaUsed} />}
      </div>

      <div className="mt-6"><SmartSearch lang={lang} /></div>

      <div className="mt-4 space-y-3 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-zinc-500">{dict.category}</span>
          {CATEGORIES.map((v) => {
            const active = sp.category === v;
            const style = CATEGORY_STYLES[v];
            const next = qs({ category: active ? "" : v, page: "1" });
            const cls = active
              ? `inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white`
              : `rounded-full ${style.chip} px-3 py-1 text-xs hover:bg-zinc-200`;
            return (
              <Link key={v} href={next} className={cls} aria-pressed={active}>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />}
                {labelCategory(v)}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-zinc-500">{dict.ai_tool}</span>
          {AI_GROUP_LIST.map((v) => {
            const active = sp.group === v;
            const meta = AI_GROUPS[v];
            const next = qs({ group: active ? "" : v, page: "1" });
            const cls = active
              ? "inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white"
              : `rounded-full ${meta.chip} px-3 py-1 text-xs hover:bg-zinc-100`;
            return (
              <Link key={v} href={next} className={cls} aria-pressed={active}>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />}
                {labelAiGroup(v)}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-zinc-500">{dict.difficulty}</span>
          {DIFFICULTIES.map((v) => {
            const active = sp.difficulty === v;
            const next = qs({ difficulty: active ? "" : v, page: "1" });
            const cls = active
              ? "inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white"
              : "inline-flex rounded-full text-xs hover:opacity-80";
            return (
              <Link key={v} href={next} className={cls} aria-pressed={active}>
                {active ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                    {labelDifficulty(v)}
                  </>
                ) : (
                  <DifficultyChip level={v} label={labelDifficulty(v)} />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-zinc-500">{dict.tier}</span>
          {TIERS.map((v) => {
            const active = sp.tier === v;
            const style = TIER_STYLES[v];
            const next = qs({ tier: active ? "" : v, page: "1" });
            const cls = active
              ? "inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white"
              : `rounded-full ${style.chip} px-3 py-1 text-xs hover:opacity-80`;
            return (
              <Link key={v} href={next} className={cls} aria-pressed={active}>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />}
                {style.label}
              </Link>
            );
          })}
        </div>

        {(sp.category || sp.difficulty || sp.tier || sp.group || sp.q) && (
          <div>
            <Link href={qs({ category: "", difficulty: "", tier: "", group: "", q: "", page: "1" })} className="text-xs text-zinc-500 underline">
              {dict.clear_filters}
            </Link>
          </div>
        )}
      </div>

      {prompts.length === 0 ? (
        <p className="mt-12 text-zinc-500">{dict.no_match}</p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prompts.map((p) => {
            const title = lang === "es" ? p.title_es : p.title_en;
            const cat = CATEGORY_STYLES[p.category];
            const tier = TIER_STYLES[p.tier];
            const aiGroup = aiGroupOf(p.ai_model);
            const aiInfo = AI_GROUPS[aiGroup];
            return (
              <li key={p.id}>
                <Link
                  href={`/${locale}/prompts/${p.id}`}
                  className="group relative block h-full overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-[var(--shadow-md)]"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-400">{p.id}</span>
                    <div className="flex items-center gap-1.5">
                      {p.is_featured && <span title="Editor's pick" className="text-[var(--accent)]" aria-label="Featured">★</span>}
                      <Badge tone={p.tier === "free" ? "tier" : "inverse"}>{tier.label}</Badge>
                    </div>
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-medium">{title}</h3>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className={`rounded-full ${cat.chip} px-2 py-0.5 font-medium`}>
                      {labelCategory(p.category)}
                    </span>
                    <DifficultyChip level={p.difficulty} label={labelDifficulty(p.difficulty)} />
                    <span className={`rounded-full ${aiInfo.chip} px-2 py-0.5`}>
                      {labelAiGroup(aiGroup)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-between text-sm">
          <Link
            href={qs({ page: String(Math.max(1, page - 1)) })}
            className={`rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-1.5 ${page === 1 ? "pointer-events-none opacity-40" : "hover:border-zinc-900"}`}
          >{dict.previous}</Link>
          <span className="text-zinc-500">{dict.page_label(page, totalPages)}</span>
          <Link
            href={qs({ page: String(Math.min(totalPages, page + 1)) })}
            className={`rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:border-zinc-900"}`}
          >{dict.next}</Link>
        </nav>
      )}
    </div>
  );
}
