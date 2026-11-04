import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TutorialCover from "@/components/TutorialCover";
import TrackOnMount from "@/components/analytics/TrackOnMount";
import TrackedLink from "@/components/analytics/TrackedLink";
import { Badge, Button, Card } from "@/components/ui";
import { LOCALES, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { buildMetadata, clampDescription, localeOf, withBrand } from "@/lib/seo";
import {
  TUTORIALS_UI,
  TUTORIAL_PROMPTS,
  TUTORIAL_TOOLS,
  getAllTutorials,
  getTutorial,
  hasProPrompt,
  tutorialPromptIds,
  videoEmbedUrl,
} from "@/lib/tutorials";

/* Pagina de un tutorial (2026-11-05, D28): portada, texto, video opcional y enlace a cada prompt
 * que usa. Los precios salen del diccionario de /pricing, no se escriben aqui. */

export const dynamicParams = false;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => getAllTutorials().map((t) => ({ locale, slug: t.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const tut = getTutorial(slug);
  if (!tut) return {};
  const locale = localeOf(localeParam);
  const c = tut.copy[locale];
  return buildMetadata({
    locale,
    path: `/tutoriales/${tut.slug}`,
    title: withBrand(c.title),
    description: clampDescription(c.summary),
  });
}

export default async function TutorialPage({ params }: Props) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const tut = getTutorial(slug);
  if (!tut) notFound();

  const t = TUTORIALS_UI[locale];
  const pricing = getDictionary(locale).pricing;
  const learn = getDictionary(locale).learn;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  const c = tut.copy[locale];
  const promptIds = tutorialPromptIds(tut);
  const embed = videoEmbedUrl(tut.video);
  const showPro = hasProPrompt(tut);
  const signupHref = `${lp("/login")}?next=${encodeURIComponent(lp(`/tutoriales/${tut.slug}`))}`;
  const others = getAllTutorials().filter((o) => o.slug !== tut.slug);

  const tierBadge = (id: string) => {
    const tier = TUTORIAL_PROMPTS[id]?.tier ?? "free";
    return <Badge tone="tier">{tier === "pro" ? pricing.tier_pro_name : pricing.tier_free_name}</Badge>;
  };

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <TrackOnMount event="tutorial_opened" props={{ tutorial: tut.slug, locale }} />

      <Link href={lp("/tutoriales")} className="text-xs font-medium text-zinc-500 hover:text-zinc-700">
        {t.back}
      </Link>

      <p className="text-eyebrow mt-6 text-zinc-500">
        {tut.code} · {t.level[tut.level]} · {tut.readingMinutes} {t.minutes}
      </p>
      <h1 className="text-h1 mt-3">{c.title}</h1>
      <span className="accent-rule mt-4" />
      <p className="mt-4 text-lg text-zinc-700">{c.summary}</p>

      <TutorialCover
        code={tut.code}
        word={c.coverWord}
        steps={tut.steps.length}
        size="hero"
        className="mt-8 rounded-[var(--radius-lg)] border border-zinc-200"
      />

      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        <span className="text-eyebrow mr-1 text-zinc-500">{t.tools_label}</span>
        {tut.tools.map((tool) => (
          <Link key={tool} href={lp(`/tutoriales?tool=${tool}`)}>
            <Badge>{TUTORIAL_TOOLS[tool].label}</Badge>
          </Link>
        ))}
      </div>

      {embed && (
        <section className="mt-10">
          <h2 className="text-eyebrow text-zinc-500">{t.video_h2}</h2>
          <div className="mt-3 aspect-video overflow-hidden rounded-[var(--radius-lg)] border border-zinc-200 bg-zinc-100">
            <iframe
              src={embed}
              title={c.title}
              className="h-full w-full"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-eyebrow text-zinc-500">{t.audience_h2}</h2>
        <p className="mt-3 text-zinc-700">{c.audience}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-eyebrow text-zinc-500">{t.outcome_h2}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {c.outcome.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              <span className="text-zinc-700">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <Card className="mt-10" padding="md">
        <h2 className="text-eyebrow text-zinc-500">{t.prompts_h2}</h2>
        <ul className="mt-3 divide-y divide-zinc-100">
          {promptIds.map((id) => (
            <li key={id} className="py-2.5 first:pt-0 last:pb-0">
              <TrackedLink
                event="tutorial_prompt_clicked"
                props={{ tutorial: tut.slug, prompt_id: id, locale }}
                href={lp(`/prompts/${id}`)}
                className="group flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
              >
                <span className="font-mono text-xs font-medium text-zinc-400">{id}</span>
                <span className="min-w-0 flex-1 text-zinc-800 group-hover:text-zinc-950 group-hover:underline">
                  {TUTORIAL_PROMPTS[id]?.title[locale] ?? id}
                </span>
                {tierBadge(id)}
              </TrackedLink>
            </li>
          ))}
        </ul>
      </Card>

      <section className="mt-14">
        <h2 className="text-xl font-bold tracking-tight">{t.steps_h2}</h2>
        <ol className="mt-6 space-y-10">
          {tut.steps.map((step, i) => {
            const s = step.copy[locale];
            return (
              <li key={i} className="border-t border-zinc-200 pt-6">
                <p className="font-mono text-xs font-medium text-zinc-400">
                  {t.step_label} {i + 1}
                </p>
                <h3 className="mt-1 text-lg font-bold tracking-tight text-zinc-900">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-zinc-700">{s.body}</p>

                {step.promptId && (
                  <TrackedLink
                    event="tutorial_prompt_clicked"
                    props={{ tutorial: tut.slug, prompt_id: step.promptId, locale }}
                    href={lp(`/prompts/${step.promptId}`)}
                    className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-md)] border border-zinc-200 bg-white p-4 transition hover:border-zinc-900"
                  >
                    <span className="font-mono text-xs font-medium text-zinc-400">{step.promptId}</span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-900">
                      {TUTORIAL_PROMPTS[step.promptId]?.title[locale] ?? step.promptId}
                    </span>
                    {tierBadge(step.promptId)}
                    <span className="w-full text-xs font-medium text-zinc-500 sm:w-auto">{t.open_prompt}</span>
                  </TrackedLink>
                )}

                {s.data && s.data.length > 0 && (
                  <div className="mt-4">
                    <p className="text-eyebrow text-zinc-500">{t.data_label}</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {s.data.map((d) => (
                        <li key={d} className="flex items-start gap-2">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" aria-hidden="true" />
                          <span className="text-zinc-700">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {s.expect && (
                  <div className="mt-4">
                    <p className="text-eyebrow text-zinc-500">{t.expect_label}</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-700">{s.expect}</p>
                  </div>
                )}

                {s.tip && (
                  <p className="mt-4 rounded-[var(--radius-md)] border-l-2 border-[var(--accent)] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                    <span className="font-semibold text-zinc-900">{t.tip_label}:</span> {s.tip}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <Card className="mt-14 sm:p-8">
        <h2 className="text-xl font-bold tracking-tight">{t.closing_h2}</h2>
        <span className="accent-rule mt-3" />
        <p className="mt-3 text-zinc-700">{c.closing}</p>
        <div className={`mt-6 grid gap-4 ${showPro ? "sm:grid-cols-2" : ""}`}>
          <div className="rounded-[var(--radius-md)] border border-zinc-200 p-5">
            <p className="font-semibold text-zinc-900">
              {t.free_h3} · {pricing.tier_free_price} {pricing.tier_free_period}
            </p>
            <p className="mt-1 text-sm text-zinc-600">{t.free_body}</p>
            <Button href={signupHref} className="mt-4">
              {t.free_cta}
            </Button>
          </div>
          {showPro && (
            <div className="rounded-[var(--radius-md)] border-2 border-zinc-900 p-5">
              <p className="font-semibold text-zinc-900">
                {pricing.tier_pro_name} · {pricing.tier_pro_price} {pricing.tier_pro_period}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {t.pro_body} {pricing.tier_pro_tagline}
              </p>
              <Button href={lp("/pricing")} variant="secondary" className="mt-4">
                {learn.cta_pricing}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {others.length > 0 && (
        <div className="mt-16 border-t border-zinc-200 pt-12">
          <h2 className="text-lg font-bold tracking-tight">{t.more_h2}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {others.map((o) => (
              <Card key={o.slug} href={lp(`/tutoriales/${o.slug}`)} padding="sm" className="p-5">
                <p className="text-eyebrow text-zinc-500">
                  {o.code} · {t.level[o.level]}
                </p>
                <p className="mt-1 font-bold leading-snug text-zinc-900">{o.copy[locale].title}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
