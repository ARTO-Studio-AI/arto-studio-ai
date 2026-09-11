import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AI_GROUPS,
  CATEGORY_STYLES,
  DIFFICULTY_STYLES,
  TIER_STYLES,
  VERTICALS,
  aiGroupOf,
  type Prompt,
} from "@/types/prompt";
import {
  t,
  type Lang,
  VERTICAL_LABEL_ES,
  DIFFICULTY_LABEL_ES,
} from "@/lib/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { localeOf, pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("favorites", localeOf(locale));
}

export default async function FavoritesPage({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const lang: Lang = locale;
  const dict = t(lang);

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/favorites`);

  const { data: favs } = await sb
    .from("favorites")
    .select("prompt_id, created_at, prompts:prompt_id (id, title_en, title_es, category, subcategory, ai_model, difficulty, tier, tags)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const prompts = (favs ?? [])
    .map((f) => f.prompts as unknown as Prompt | null)
    .filter((p): p is Prompt => p !== null);

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{dict.favorites_title}</h1>
          <p className="mt-2 text-sm text-zinc-500">{dict.favorites_subtitle}</p>
        </div>
        <Link href={`/${locale}/account`} className="text-sm text-zinc-500 hover:text-zinc-900">
          ← {dict.nav_account}
        </Link>
      </div>

      {prompts.length === 0 ? (
        <p className="mt-12 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500">
          {dict.favorites_empty}
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prompts.map((p) => {
            const title = lang === "es" ? p.title_es : p.title_en;
            const cat = CATEGORY_STYLES[p.category];
            const diff = DIFFICULTY_STYLES[p.difficulty];
            const tier = TIER_STYLES[p.tier];
            const aiGroup = aiGroupOf(p.ai_model);
            const aiInfo = AI_GROUPS[aiGroup];
            const catLabel =
              lang === "es"
                ? VERTICAL_LABEL_ES[p.category] ?? VERTICALS[p.category].label_en
                : VERTICALS[p.category].label_en;
            const diffLabel = lang === "es" ? DIFFICULTY_LABEL_ES[p.difficulty] ?? diff.label : diff.label;
            return (
              <li key={p.id}>
                <Link
                  href={`/${locale}/prompts/${p.id}`}
                  className="group relative block h-full overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-400">{p.id}</span>
                    <span className={`rounded-full ${tier.chip} px-2 py-0.5 text-[11px] font-medium`}>
                      {tier.label}
                    </span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-medium">{title}</h3>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className={`rounded-full ${cat.chip} px-2 py-0.5 font-medium`}>{catLabel}</span>
                    <span className={`rounded-full ${diff.chip} px-2 py-0.5`}>{diffLabel}</span>
                    <span className={`rounded-full ${aiInfo.chip} px-2 py-0.5`}>{aiInfo.label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
