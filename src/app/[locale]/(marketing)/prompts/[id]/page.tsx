import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getPrompt } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { FREE_DAILY_OPENS, getSubject, getUsed, isUnlimitedTier, openForTier } from "@/lib/prompt-limit";
import PromptQuota from "@/components/PromptQuota";
import ProUnlockBanner from "@/components/ProUnlockBanner";
import LockIcon from "@/components/LockIcon";
import TrackedLink from "@/components/analytics/TrackedLink";
import { getProPromptCount } from "@/lib/pro-count";
import { subcategoryLabel } from "@/lib/subcategory-labels";
import { getDictionary } from "@/i18n/dictionaries";
import TrackOnMount from "@/components/analytics/TrackOnMount";
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
import PromptLimitReached from "./PromptLimitReached";
import SignupWall from "./SignupWall";
import DifficultyChip from "@/components/DifficultyChip";
import { Badge, buttonClass } from "@/components/ui";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, enterprise: 2 };

/** Primeras ~280 letras del prompt, cortadas en una palabra, para el muro de registro. */
function teaserOf(body: string): string {
  const clean = body.trim();
  if (clean.length <= 280) return clean.slice(0, Math.max(60, Math.floor(clean.length / 2))) + "…";
  const cut = clean.slice(0, 280);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 200 ? lastSpace : 280)}…`;
}

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
  /* Registro free (2026-10-06): sin sesion, un prompt free muestra solo el inicio y pide
   * crear la cuenta gratis. No pasa por el contador (no es una apertura). */
  const needsSignup = !user && !isLocked;

  /* Contador free (D7): abrir un prompt cuenta; 3 al dia para free y anonimos.
   * Se comprueba en el servidor antes de renderizar el cuerpo. Un prompt Pro
   * bloqueado para free no cuenta: no se ve el cuerpo. */
  let limitHit = false;
  let resetsAtUtc = "";
  let quotaUsed: number | null = null;
  if (user && !isUnlimitedTier(userTier)) {
    const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
    const subject = getSubject({
      vid: cookieStore.get("asai_vid")?.value,
      userId: user?.id,
      ip: hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip"),
    });
    if (isLocked) {
      quotaUsed = await getUsed(subject);
    } else {
      const res = await openForTier(userTier, subject, prompt.id);
      limitHit = !res.allowed;
      resetsAtUtc = res.resetsAtUtc;
      quotaUsed = res.used;
    }
  }

  const title = lang === "es" ? prompt.title_es : prompt.title_en;
  /* Bloqueado: el texto ni siquiera entra a una variable del render, asi no puede acabar en
   * el HTML ni en el payload RSC por un cambio futuro (migracion 0017, D28 2026-11-05). */
  const body = isLocked ? "" : lang === "es" ? prompt.prompt_es : prompt.prompt_en;
  const useCase = prompt.use_case;
  const expectedOutput = prompt.expected_output;

  const cat = CATEGORY_STYLES[prompt.category];
  const diff = DIFFICULTY_STYLES[prompt.difficulty];
  void diff;
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

  /* Tier para analitica: "anon" sin sesion, si no el del perfil. */
  const analyticsTier = user ? userTier : "anon";

  /* Lo Pro a la vista (D28, 2026-11-05): en una ficha Pro bloqueada se ve titulo, cuando usarlo
   * y resultado esperado, con el texto bloqueado, un llamado a Pro y, sin sesion, a la cuenta gratis. */
  const proDict = getDictionary(locale).pro_unlock;
  const showProStrip = isLocked && prompt.tier === "pro";
  const proCount = showProStrip ? await getProPromptCount() : null;
  const signupHref = `/${locale}/login?next=${encodeURIComponent(`/${locale}/prompts/${prompt.id}`)}`;

  if (limitHit) {
    return (
      <article className="mx-auto max-w-3xl px-6 py-12">
        <TrackOnMount
          event="free_limit_reached"
          props={{ prompt_id: prompt.id, tier: analyticsTier, signed_in: !!user, locale }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/${locale}/prompts`} className="text-sm text-zinc-500 hover:text-zinc-900">
            {dict.back_to_catalog}
          </Link>
          {quotaUsed !== null && <PromptQuota locale={locale} used={quotaUsed} />}
        </div>
        <PromptLimitReached
          locale={locale}
          title={title}
          promptId={prompt.id}
          signedIn={!!user}
          resetsAtUtc={resetsAtUtc}
        />
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      {needsSignup && (
        <TrackOnMount event="signup_wall_viewed" props={{ prompt_id: prompt.id, locale }} />
      )}
      {!isLocked && !needsSignup && (
        <TrackOnMount
          event="prompt_opened"
          props={{
            prompt_id: prompt.id,
            prompt_tier: prompt.tier,
            used: quotaUsed ?? 0,
            limit: FREE_DAILY_OPENS,
            tier: analyticsTier,
            locale,
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/${locale}/prompts`} className="text-sm text-zinc-500 hover:text-zinc-900">
          {dict.back_to_catalog}
        </Link>
        {quotaUsed !== null && <PromptQuota locale={locale} used={quotaUsed} />}
      </div>

      <header className="relative mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-mono text-zinc-500">{prompt.id}</span>
              <Badge tone={prompt.tier === "free" ? "tier" : "inverse"} dot={isLocked ? false : undefined}>
                {isLocked && <LockIcon className="h-2.5 w-2.5" />}
                {tier.label}
              </Badge>
            </div>
            <h1 className="text-h1 mt-3">{title}</h1>
            <span className="accent-rule mt-3" />
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className={`rounded-full ${cat.chip} px-2 py-0.5 font-medium`}>{catLabel}</span>
              <DifficultyChip level={prompt.difficulty} label={diffLabel} />
              <span className={`rounded-full ${aiInfo.chip} px-2 py-0.5`}>
                {aiGroupLabel} · {aiModelLabel(prompt.ai_model)}
              </span>
            </div>
            <p className="mt-3 text-xs text-zinc-500">{subcategoryLabel(prompt.subcategory, lang)}</p>
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

      <section className="mt-6 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-eyebrow text-zinc-500">{dict.prompt_label}</h2>
          {!isLocked && !needsSignup && (
            <div className="flex items-center gap-2">
              <AddToCollectionButton promptId={prompt.id} lang={lang} signedIn={!!user} />
              <CopyButton
                text={body}
                labelCopy={dict.copy}
                labelCopied={dict.copied}
                promptId={prompt.id}
                promptTier={prompt.tier}
                locale={locale}
              />
            </div>
          )}
        </div>
        <div className="relative mt-3">
          {needsSignup ? (
            <SignupWall locale={locale} promptId={prompt.id} teaser={teaserOf(body)} />
          ) : isLocked ? (
            <div className="relative overflow-hidden rounded-[var(--radius-md)]" data-testid="pro-locked">
              {/* Relleno sin texto real: antes iban los primeros 400 caracteres del prompt bajo
                * un blur de CSS, y cualquiera los leia en el HTML (H-65, 2026-10-12). */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none space-y-2 py-1 blur-[2px]">
                {[96, 88, 92, 70, 94, 82, 60, 90, 76, 84, 66, 92].map((w, i) => (
                  <div key={i} className="h-3 rounded bg-zinc-200" style={{ width: `${w}%` }} />
                ))}
              </div>
              <div className="relative flex flex-col items-center bg-white/80 px-4 py-8 text-center backdrop-blur-sm">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-[var(--accent)]">
                  <LockIcon className="h-5 w-5" />
                </span>
                <p className="mt-3 font-semibold text-zinc-900">
                  {prompt.tier === "pro" ? proDict.locked_title : dict.enterprise_prompt}
                </p>
                <p className="mt-1 max-w-md text-sm text-zinc-600">
                  {prompt.tier === "pro"
                    ? user ? proDict.locked_body_free : proDict.locked_body_anon
                    : user ? dict.upgrade_to_unlock : dict.sign_in_to_unlock}
                </p>
                <div className="mt-4 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <TrackedLink
                    event="pro_unlock_clicked"
                    props={{ placement: "prompt_locked", cta: "pricing", locale }}
                    href={`/${locale}/pricing`}
                    className={buttonClass("primary", "md", "min-h-[44px]")}
                  >
                    {prompt.tier === "pro" ? proDict.locked_cta_pro : dict.see_pricing}
                  </TrackedLink>
                  {!user && (
                    <TrackedLink
                      event="pro_unlock_clicked"
                      props={{ placement: "prompt_locked", cta: "signup", locale }}
                      href={signupHref}
                      className={buttonClass("secondary", "md", "min-h-[44px]")}
                    >
                      {proDict.locked_cta_signup}
                    </TrackedLink>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-sans text-zinc-700" data-testid="prompt-body">{body}</pre>
          )}
        </div>
      </section>

      {isLocked && prompt.tier === "pro" && (
        <p className="mt-3 text-xs text-zinc-500">{proDict.preview_note}</p>
      )}

      {/* Bloqueado se ve igual: para que sirve y que entrega ayuda a decidir si vale Pro (D28). */}
      {(useCase || expectedOutput) && !needsSignup && (
        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {useCase && (
            <div className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5">
              <h3 className="text-eyebrow text-zinc-500">{dict.when_to_use}</h3>
              <p className="mt-2 text-sm text-zinc-700">{useCase}</p>
            </div>
          )}
          {expectedOutput && (
            <div className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5">
              <h3 className="text-eyebrow text-zinc-500">{dict.expected_output}</h3>
              <p className="mt-2 text-sm text-zinc-700">{expectedOutput}</p>
            </div>
          )}
        </section>
      )}

      {showProStrip && (
        <ProUnlockBanner locale={locale} count={proCount} placement="prompt_detail" className="mt-6" />
      )}

      {prompt.tags?.length > 0 && (
        <section className="mt-8">
          <h3 className="text-eyebrow text-zinc-500">{dict.tags}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {prompt.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-600">{tag}</span>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
