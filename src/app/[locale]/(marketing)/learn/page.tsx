import type { Metadata } from "next";
import BlogCover from "@/components/BlogCover";
import { notFound } from "next/navigation";
import type { LearnPageConfig } from "@/lib/learn-config";
import { getAllLearnPages } from "@/lib/learn-pages";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localeOf, pageMetadata } from "@/lib/seo";
import { Button, Card } from "@/components/ui";
import { TUTORIALS_UI } from "@/lib/tutorials";

// Re-fetch dynamic blog posts every 60s so newly published Content
// Factory items appear without a redeploy. Literal required —
// Next.js segment configs must be statically analyzable.
export const revalidate = 60;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("learn", localeOf(locale));
}

export default async function LearnIndex({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = getDictionary(locale).learn;
  const tut = TUTORIALS_UI[locale];
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;

  // Merge hardcoded vertical guides + dynamic Content Factory blog posts.
  const pages = await getAllLearnPages();

  // Pick the locale-correct hero/intro per page (LearnPageConfig has *_en + *_es).
  const heroOf = (p: LearnPageConfig) => (locale === "es" ? p.hero_es : p.hero_en);
  const introOf = (p: LearnPageConfig) => (locale === "es" ? p.intro_es : p.intro_en);

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-eyebrow text-zinc-500">{t.eyebrow}</p>
      <h1 className="text-h1 mt-3">{t.h1}</h1>
      <span className="accent-rule mt-4" />
      <p className="mt-4 max-w-2xl text-zinc-700">{t.sub}</p>

      {/* Tutoriales (2026-11-05, D28): la entrada a /tutoriales va arriba de las guias. */}
      <Card href={lp("/tutoriales")} className="group mt-10" padding="md" highlight>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-eyebrow text-zinc-500">{tut.learn_eyebrow}</p>
            <h2 className="mt-2 text-xl font-extrabold leading-tight tracking-[-0.02em] text-zinc-900">{tut.learn_h2}</h2>
            <p className="mt-2 max-w-xl text-sm text-zinc-600">{tut.learn_body}</p>
          </div>
          <span className="shrink-0 text-sm font-medium text-zinc-900 group-hover:underline">{tut.learn_cta}</span>
        </div>
      </Card>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <Card key={page.slug} href={lp(`/learn/${page.slug}`)} padding="none" className="group overflow-hidden">
            {/* Portada de marca por vertical (2026-10-07): sustituye las imagenes generadas. */}
            <BlogCover category={page.category} locale={locale} className="border-b border-zinc-200" />
            <div className="p-6">
              <p className="text-eyebrow text-zinc-500">{t.card_eyebrow}</p>
              <h2 className="mt-2 text-xl font-extrabold leading-tight tracking-[-0.02em] text-zinc-900">{heroOf(page)}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-zinc-600">{introOf(page)}</p>
              <p className="mt-4 text-xs font-medium text-zinc-500 group-hover:text-zinc-900">
                {t.read_guide}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-16 text-center" padding="lg">
        <h2 className="text-xl font-bold tracking-tight">{t.cta_h2}</h2>
        <span className="accent-rule mx-auto mt-3" />
        <p className="mt-3 max-w-xl text-zinc-600 sm:mx-auto">{t.cta_body}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button href={lp("/prompts")}>{t.cta_browse}</Button>
          <Button href={lp("/pricing")} variant="secondary">{t.cta_pricing}</Button>
        </div>
      </Card>
    </section>
  );
}
