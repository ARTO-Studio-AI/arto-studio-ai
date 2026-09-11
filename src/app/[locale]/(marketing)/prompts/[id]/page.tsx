import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrompt } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import {
  AI_GROUPS,
  CATEGORY_STYLES,
  DIFFICULTY_STYLES,
  TIER_STYLES,
  VERTICALS,
  aiGroupOf,
  aiModelLabel,
  humanize,
} from "@/types/prompt";
import {
  t,
  type Lang,
  AI_GROUP_LABEL_ES,
  DIFFICULTY_LABEL_ES,
  VERTICAL_LABEL_ES,
} from "@/lib/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { buildMetadata, clampDescription, localeOf, withBrand } from "@/lib/seo";
import CopyButton from "./CopyButton";
import AddToCollectionButton from "./AddToCollectionButton";
import FavoriteButton from "./FavoriteButton";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, enterprise: 2 };

/* Title and description from the prompt row; the prompt body itself never
 * goes into the description (Pro content stays behind the gate). ogImage is
 * null on purpose so the segment's own opengraph-image.tsx / twitter-image.tsx
 * keep rendering the per-prompt card. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam, id } = await params;
  const locale = localeOf(localeParam);
  let prompt: Awaited<ReturnType<typeof getPrompt>> = null;
  try {
    prompt = await getPrompt(id);
  } catch {
    prompt = null;
  }
  if (!prompt) return {};

  const title = locale === "es" ? prompt.title_es : prompt.title_en;
  const catLabel =
    locale === "es"
      ? VERTICAL_LABEL_ES[prompt.category] ?? VERTICALS[prompt.category].label_en
      : VERTICALS[prompt.category].label_en;
  const diffLabel =
    locale === "es"
      ? DIFFICULTY_LABEL_ES[prompt.difficulty] ?? prompt.difficulty
      : humanize(prompt.difficulty);
  // use_case only exists in English in the prompts table, so Spanish gets a
  // sentence built from the localized title, vertical and difficulty.
  const fallback =
    locale === "es"
      ? `${title}: prompt de IA para ${catLabel} (${diffLabel}) en la biblioteca de ARTO Studio AI.`
      : `${title}: AI prompt for ${catLabel} (${diffLabel}) in the ARTO Studio AI library.`;
  const useCase = locale === "en" ? prompt.use_case?.trim() : "";
  const description = clampDescription(useCase || fallback);

  return buildMetadata({
    locale,
    path: `/prompts/${prompt.id}`,
    title: withBrand(title),
    description,
    ogImage: null,
  });
}

export default async function PromptDetail({ params }: Props) {
  const { locale: localeParam, id } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  // Bridge the old Lang alias to the unified Locale (structurally identical).
  const lang: Lang = locale;
  const dict = t(lang);

  const prompt = await getPrompt(id);
  if (!prompt) notFound();

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  let userTier: "free" | "pro" | "enterprise" = "free";
  let isFavorited = false;
  if (user) {
    const [{ data: profile }, { data: fav }] = await Promise.all([
      sb.from("profiles").select("tier").eq("id", user.id).maybeSingle(),
      sb.from("favorites").select("id").eq("user_id", user.id).eq("prompt_id", prompt.id).maybeSingle(),
    ]);
    const t2 = profile?.tier;
    if (t2 === "pro" || t2 === "enterprise") userTier = t2;
    isFavorited = !!fav;
  }

  const isLocked = (TIER_RANK[prompt.tier] ?? 0) > (TIER_RANK[userTier] ?? 0);

  const title = lang === "es" ? prompt.title_es : prompt.title_en;
  const body = lang === "es" ? prompt.prompt_es : prompt.prompt_en;
  const useCase = prompt.use_case;
  const expectedOutput = prompt.expected_output;

  const cat = CATEGORY_STYLES[prompt.category];
  const diff = DIFFICULTY_STYLES[prompt.difficulty];
  const tier = TIER_STYLES[prompt.tier];
  const aiGroup = aiGroupOf(prompt.ai_model);
  const aiInfo = AI_GROUPS[aiGroup];

  const catLabel = lang === "es"
    ? VERTICAL_LABEL_ES[prompt.category] ?? VERTICALS[prompt.category].label_en
    : VERTICALS[prompt.category].label_en;
  const diffLabel = lang === "es"
    ? DIFFICULTY_LABEL_ES[prompt.difficulty] ?? diff.label
    : diff.label;
  const aiGroupLabel = lang === "es" ? AI_GROUP_LABEL_ES[aiGroup] ?? aiInfo.label : aiInfo.label;

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/${locale}/prompts`} className="text-sm text-neutral-500 hover:text-neutral-900">
        {dict.back_to_catalog}
      </Link>

      <header className="relative mt-6 overflow-hidden rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-mono text-neutral-400">{prompt.id}</span>
              <span className={`rounded-full ${tier.chip} px-2 py-0.5 font-medium`}>{tier.label}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className={`rounded-full ${cat.chip} px-2 py-0.5 font-medium`}>{catLabel}</span>
              <span className={`rounded-full ${diff.chip} px-2 py-0.5`}>{diffLabel}</span>
              <span className={`rounded-full ${aiInfo.chip} px-2 py-0.5`}>
                {aiGroupLabel} · {aiModelLabel(prompt.ai_model)}
              </span>
            </div>
            <p className="mt-3 text-xs text-neutral-500">{humanize(prompt.subcategory)}</p>
            {/* Inline EN/ES switcher removed — the global LangSwitcher in the
              * Nav handles locale toggling for the whole site. */}
          </div>
          <FavoriteButton
            promptId={prompt.id}
            initialFavorited={isFavorited}
            signedIn={!!user}
            labelAdd={dict.favorite_add}
            labelRemove={dict.favorite_remove}
            labelSignIn={dict.favorite_sign_in}
          />
        </div>
      </header>

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{dict.prompt_label}</h2>
          {!isLocked && (
            <div className="flex items-center gap-2">
              <AddToCollectionButton promptId={prompt.id} lang={lang} signedIn={!!user} />
              <CopyButton text={body} labelCopy={dict.copy} labelCopied={dict.copied} />
            </div>
          )}
        </div>
        <div className="relative mt-3">
          {isLocked ? (
            <>
              <pre className="select-none whitespace-pre-wrap break-words font-sans text-neutral-700 blur-sm">
                {body.slice(0, 400)}…
              </pre>
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded bg-white/80 backdrop-blur-sm">
                <p className="text-sm font-medium text-neutral-900">
                  {prompt.tier === "pro" ? dict.pro_prompt : dict.enterprise_prompt}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {user ? dict.upgrade_to_unlock : dict.sign_in_to_unlock}
                </p>
                <Link href={`/${locale}/pricing`} className="mt-3 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
                  {dict.see_pricing}
                </Link>
              </div>
            </>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-sans text-neutral-700">{body}</pre>
          )}
        </div>
      </section>

      {(useCase || expectedOutput) && !isLocked && (
        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {useCase && (
            <div className="rounded-lg border border-neutral-200 bg-white p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{dict.when_to_use}</h3>
              <p className="mt-2 text-sm text-neutral-700">{useCase}</p>
            </div>
          )}
          {expectedOutput && (
            <div className="rounded-lg border border-neutral-200 bg-white p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{dict.expected_output}</h3>
              <p className="mt-2 text-sm text-neutral-700">{expectedOutput}</p>
            </div>
          )}
        </section>
      )}

      {prompt.tags?.length > 0 && (
        <section className="mt-8">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{dict.tags}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {prompt.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-600">{tag}</span>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
