import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEARN_PAGES, type LearnPageConfig } from "@/lib/learn-config";
import { getLearnPageBySlug } from "@/lib/learn-pages";
import { LOCALES, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { buildMetadata, clampDescription, localeOf, withBrand } from "@/lib/seo";
import { Button, Card } from "@/components/ui";

// Re-fetch dynamic blog posts every 60s. Literal required — segment
// configs must be statically analyzable.
export const revalidate = 60;
// New blog posts that arrive between static-param builds: render on
// demand, then cache via the revalidate above.
export const dynamicParams = true;

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// Pre-generate the locale × slug cross-product so /en/learn/branding
// and /es/learn/branding are both built at compile time. Only the 12
// hardcoded slugs are pre-rendered; Content Factory blog posts go
// through dynamicParams=true and the revalidate above.
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    LEARN_PAGES.map((p) => ({ locale, slug: p.slug })),
  );
}

async function getPage(slug: string): Promise<LearnPageConfig | null> {
  return getLearnPageBySlug(slug);
}

function pickTitle(page: LearnPageConfig, locale: Locale): string {
  return locale === "es" ? page.title_es : page.title_en;
}
function pickHero(page: LearnPageConfig, locale: Locale): string {
  return locale === "es" ? page.hero_es : page.hero_en;
}
function pickIntro(page: LearnPageConfig, locale: Locale): string {
  return locale === "es" ? page.intro_es : page.intro_en;
}
function pickUseCases(page: LearnPageConfig, locale: Locale): string[] {
  return locale === "es" ? page.use_cases_es : page.use_cases_en;
}
function pickMeta(page: LearnPageConfig, locale: Locale): string {
  return locale === "es" ? page.meta_description_es : page.meta_description_en;
}
function pickBody(page: LearnPageConfig, locale: Locale): string | undefined {
  const v = locale === "es" ? page.body_es : page.body_en;
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

/* Split the body into paragraphs. Claude emits blank lines as paragraph
 * breaks; we accept either \n\n or a single \n with empty content. */
function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((para) => para.replace(/\s+/g, " ").trim())
    .filter((para) => para.length > 0);
}

/* Parse markdown bold (**text**) in a paragraph string. Returns a flat
 * array of React nodes — plain strings interleaved with <strong>. Used
 * so the generator can mark load-bearing phrases without us needing a
 * full markdown engine. We DO NOT support any other syntax (no italics,
 * no links, no headings) to keep the input surface narrow. */
function renderWithBold(para: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  // Greedy match of **...** with non-greedy inner; reject empty or
  // accidental triple-star.
  const re = /\*\*([^*][^*]*?)\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(para)) !== null) {
    if (m.index > i) out.push(para.slice(i, m.index));
    out.push(<strong key={key++}>{m[1]}</strong>);
    i = m.index + m[0].length;
  }
  if (i < para.length) out.push(para.slice(i));
  return out.length > 0 ? out : [para];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  const locale = localeOf(localeParam);
  return buildMetadata({
    locale,
    path: `/learn/${page.slug}`,
    title: withBrand(pickTitle(page, locale)),
    description: clampDescription(pickMeta(page, locale)),
  });
}

export default async function LearnSlugPage({ params }: Props) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const page = await getPage(slug);
  if (!page) notFound();

  const t = getDictionary(locale).learn;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  const libraryHref = lp(`/prompts?category=${page.category}`);

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href={lp("/learn")}
        className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
      >
        {t.back_link}
      </Link>

      <h1 className="text-h1 mt-6">{pickHero(page, locale)}</h1>
      <span className="accent-rule mt-4" />

      {/* Hero image — content_items blog_posts always carry an image_url
        * written by the publisher. Hardcoded vertical guides usually
        * don't, so we only render this block when the field is set. */}
      {page.image_url && (
        <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
          <Image
            src={page.image_url}
            alt={pickHero(page, locale)}
            fill
            sizes="(min-width: 1024px) 768px, 100vw"
            priority
            className="object-cover"
          />
        </div>
      )}

      <p className="mt-8 text-zinc-700">{pickIntro(page, locale)}</p>

      {/* Long body (500-800 words). Rendered only for Content Factory
        * blog_posts. Each blank-line-separated chunk becomes a <p>. */}
      {(() => {
        const body = pickBody(page, locale);
        if (!body) return null;
        const paras = splitParagraphs(body);
        return (
          <div className="mt-6 space-y-4 text-zinc-700">
            {paras.map((para, i) => (
              <p key={i} className="leading-relaxed">
                {renderWithBold(para)}
              </p>
            ))}
          </div>
        );
      })()}

      <h2 className="text-eyebrow mt-12 text-zinc-500">{t.use_cases_h2}</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {pickUseCases(page, locale).map((uc) => (
          <li key={uc} className="flex items-start gap-2">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            <span className="text-zinc-700">{uc}</span>
          </li>
        ))}
      </ul>

      <Card className="mt-12 sm:p-8">
        <p className="text-eyebrow text-zinc-500">{t.catalog_eyebrow}</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight">{t.catalog_h2}</h2>
        <p className="mt-2 text-sm text-zinc-600">{t.catalog_body}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button href={libraryHref}>
            {t.catalog_browse_prefix} {page.slug.replace("-", " ")} {t.catalog_browse_suffix}
          </Button>
          <Button href={lp("/pricing")} variant="secondary">{t.cta_pricing}</Button>
        </div>
      </Card>

      <div className="mt-16 border-t border-zinc-200 pt-12">
        <h2 className="text-lg font-bold tracking-tight">{t.related_h2}</h2>
        <p className="mt-2 text-sm text-zinc-500">{t.related_body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {LEARN_PAGES.filter((p) => p.slug !== page.slug).slice(0, 6).map((p) => (
            <Link
              key={p.slug}
              href={lp(`/learn/${p.slug}`)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-mono text-[11px] text-zinc-700 transition hover:border-zinc-900"
            >
              {p.slug.replace("-", " ")}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
