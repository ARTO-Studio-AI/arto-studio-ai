import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { LearnPageConfig } from "@/lib/learn-config";
import { getAllLearnPages } from "@/lib/learn-pages";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localeOf, pageMetadata } from "@/lib/seo";

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
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;

  // Merge hardcoded vertical guides + dynamic Content Factory blog posts.
  const pages = await getAllLearnPages();

  // Pick the locale-correct hero/intro per page (LearnPageConfig has *_en + *_es).
  const heroOf = (p: LearnPageConfig) => (locale === "es" ? p.hero_es : p.hero_en);
  const introOf = (p: LearnPageConfig) => (locale === "es" ? p.intro_es : p.intro_en);

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{t.eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{t.h1}</h1>
      <p className="mt-3 max-w-2xl text-neutral-700">{t.sub}</p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <Link
            key={page.slug}
            href={lp(`/learn/${page.slug}`)}
            className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-sm"
          >
            {/* Brand image — rendered if the page has an image_url
              * (Content Factory blog_posts or merged hardcoded+dynamic
              * verticals). Falls back to gracefully omitting the
              * thumbnail when the entry has no image yet. */}
            {page.image_url && (
              <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                <Image
                  src={page.image_url}
                  alt={heroOf(page)}
                  fill
                  sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
                  className="object-cover transition group-hover:scale-[1.02]"
                />
              </div>
            )}
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                {t.card_eyebrow}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-neutral-900">{heroOf(page)}</h2>
              <p className="mt-2 line-clamp-3 text-sm text-neutral-600">{introOf(page)}</p>
              <p className="mt-4 text-xs font-medium text-neutral-500 group-hover:text-neutral-900">
                {t.read_guide}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-16 rounded-xl border border-neutral-200 bg-white p-8 text-center">
        <h2 className="text-xl font-bold tracking-tight">{t.cta_h2}</h2>
        <p className="mt-2 max-w-xl text-neutral-600 sm:mx-auto">{t.cta_body}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={lp("/prompts")}
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            {t.cta_browse}
          </Link>
          <Link
            href={lp("/pricing")}
            className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
          >
            {t.cta_pricing}
          </Link>
        </div>
      </div>
    </section>
  );
}
