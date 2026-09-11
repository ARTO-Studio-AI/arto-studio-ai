import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeaturedPrompts, getStats } from "@/lib/supabase/queries";
import { getRecentBlogPosts, type RecentBlogPost } from "@/lib/learn-pages";
import { CATEGORY_STYLES, type Prompt } from "@/types/prompt";
import { isLocale, type Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { localeOf, pageMetadata } from "@/lib/seo";
import { getDictionary } from "@/i18n/dictionaries";

/* Round a precise prompt count to a tidy marketing-friendly figure.
 * Below 1k we show the exact number. Above, we round down to the
 * nearest 100 and stick a "+" so the public-facing claim never
 * overstates. Examples: 1842 → "1,800+", 3045 → "3,000+", 12 → "12". */
function formatPromptCount(n: number): string {
  if (n < 1000) return String(n);
  const floored = Math.floor(n / 100) * 100;
  return `${floored.toLocaleString("en-US")}+`;
}

/* Each vertical maps to the catalog filter on /prompts. The code stays as
 * the display label, category is the DB enum used in the query. The human
 * label comes from dict.home.verticals_labels so it shifts per locale. */
const VERTICALS = [
  { code: "BR", count: 250, category: "branding" as const },
  { code: "DG", count: 250, category: "graphic_design" as const },
  { code: "CW", count: 250, category: "copywriting" as const },
  { code: "FT", count: 250, category: "photography" as const },
  { code: "VD", count: 250, category: "video" as const },
  { code: "UX", count: 250, category: "ux_ui" as const },
  { code: "IL", count: 250, category: "illustration" as const },
  { code: "MK", count: 250, category: "marketing" as const },
  { code: "MU", count: 250, category: "music" as const },
  { code: "AR", count: 250, category: "architecture" as const },
  { code: "FA", count: 250, category: "fashion" as const },
  { code: "CP", count: 250, category: "creative_productivity" as const },
];

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("home", localeOf(locale));
}

export default async function HomePage({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const dict = getDictionary(locale);
  const t = dict.home;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;

  // Pull featured prompts + live total count + latest blog posts in
  // parallel. Each call has its own graceful fallback so a single
  // upstream hiccup doesn't blank-page the home.
  const [featuredRes, statsRes, recentBlogsRes] = await Promise.allSettled([
    getFeaturedPrompts(6),
    getStats(),
    getRecentBlogPosts(6),
  ]);
  const featured: Prompt[] =
    featuredRes.status === "fulfilled" ? featuredRes.value : [];
  const promptsTotalRaw =
    statsRes.status === "fulfilled" ? statsRes.value.total : 3000;
  const promptsTotal = formatPromptCount(promptsTotalRaw);
  const recentBlogs: RecentBlogPost[] =
    recentBlogsRes.status === "fulfilled" ? recentBlogsRes.value : [];

  // Tiny interpolation — these dict keys carry "{n}" where the prompt
  // count belongs. We keep marketing copy in dictionaries.ts and inject
  // the live number here so the public-facing claim stays accurate as
  // the catalog grows.
  const withCount = (s: string) => s.replace(/\{n\}/g, promptsTotal);

  // Pick the title in the active locale (Prompt type has both title_en and title_es).
  const promptTitle = (p: Prompt) => (locale === "es" ? p.title_es : p.title_en);
  const promptSubtitle = (p: Prompt) => (locale === "es" ? p.title_en : p.title_es);

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* HERO */}
      <section className="py-16 sm:py-24">
        <div className="flex flex-col items-start gap-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              {t.eyebrow}
            </p>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {t.hero_h1_line1}
              <br />
              <span className="text-neutral-400">{t.hero_h1_line2}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg font-medium text-neutral-800">{t.hero_subbenefit}</p>
            <p className="mt-4 max-w-xl text-base text-neutral-600">{t.hero_body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={lp("/prompts")}
                className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
              >
                {t.hero_cta_free}
              </Link>
              <Link
                href="/roast"
                className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
              >
                {t.hero_cta_roast}
              </Link>
              <Link
                href={lp("/pricing")}
                className="rounded-md px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:text-neutral-900"
              >
                {t.hero_cta_pricing}
              </Link>
            </div>
            <p className="mt-3 text-xs text-neutral-500">{t.hero_microcopy}</p>
            <p className="mt-6 border-t border-neutral-200 pt-4 text-sm text-neutral-500">{t.hero_trust}</p>
          </div>
          <div className="hidden md:block">
            <Image
              src="/brand/arto-character-01.png"
              alt="ARTO"
              width={280}
              height={280}
              priority
              className="h-auto w-[260px] lg:w-[300px]"
            />
          </div>
        </div>
      </section>

      {/* THREE TIERS */}
      <section className="border-t border-neutral-200 py-16">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          {t.tiers_eyebrow}
        </p>
        <h2 className="mb-10 text-2xl font-bold tracking-tight sm:text-3xl">{t.tiers_h2}</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-xl border-2 border-neutral-900 bg-white p-6">
            <div className="mb-3">
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                {dict.nav.badge_live}
              </span>
            </div>
            <h3 className="text-lg font-bold">{t.tier_library_title}</h3>
            <p className="mt-1 text-sm text-neutral-500">{t.tier_library_blurb}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-neutral-600">
              {t.tier_library_bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <Link
              href={lp("/prompts")}
              className="mt-5 block rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-neutral-700"
            >
              {t.tier_library_cta}
            </Link>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="mb-3">
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {locale === "es" ? "Pronto" : "Coming soon"}
              </span>
            </div>
            <h3 className="text-lg font-bold">{t.tier_skills_title}</h3>
            <p className="mt-1 text-sm text-neutral-500">{t.tier_skills_blurb}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-neutral-600">
              {t.tier_skills_bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <Link
              href={lp("/skills")}
              className="mt-5 block rounded-md border border-neutral-300 px-4 py-2 text-center text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
            >
              {t.tier_skills_cta}
            </Link>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="mb-3">
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {locale === "es" ? "Pronto" : "Coming soon"}
              </span>
            </div>
            <h3 className="text-lg font-bold">{t.tier_agents_title}</h3>
            <p className="mt-1 text-sm text-neutral-500">{t.tier_agents_blurb}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-neutral-600">
              {t.tier_agents_bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <Link
              href={lp("/agents")}
              className="mt-5 block rounded-md border border-neutral-300 px-4 py-2 text-center text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
            >
              {t.tier_agents_cta}
            </Link>
          </div>
        </div>
      </section>

      {/* THE ARTO METHOD */}
      <section className="border-t border-neutral-200 py-16">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          {t.method_eyebrow}
        </p>
        <h2 className="mb-10 text-2xl font-bold tracking-tight sm:text-3xl">{t.method_h2}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {t.method_pillars.map((p) => (
            <div key={p.n} className="rounded-lg border border-neutral-200 bg-white p-5">
              <span className="text-xs font-bold text-neutral-400">{p.n}</span>
              <h3 className="mt-1 font-bold">{p.title}</h3>
              <p className="mt-1 text-sm text-neutral-500">{p.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Link href={lp("/pricing")} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
            {t.method_cta}
          </Link>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section className="border-t border-neutral-200 py-16">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          {t.diff_eyebrow}
        </p>
        <h2 className="mb-10 text-2xl font-bold tracking-tight sm:text-3xl">{t.diff_h2}</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {t.diff_items.map((d) => (
            <div key={d.title} className="rounded-lg border border-neutral-200 bg-white p-5">
              <h3 className="font-bold">{d.title}</h3>
              <p className="mt-2 text-sm text-neutral-500">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BRAND ROAST CTA */}
      <section className="border-t border-neutral-200 py-16">
        <div className="rounded-xl border border-neutral-200 bg-white p-8 sm:p-10">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            {t.roast_eyebrow}
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.roast_h2}</h2>
          <p className="mt-3 max-w-xl text-neutral-600">{t.roast_body}</p>
          <Link
            href="/roast"
            className="mt-6 inline-block rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            {t.roast_cta}
          </Link>
        </div>
      </section>

      {/* FEATURED PROMPTS — live from Supabase */}
      {featured.length > 0 && (
        <section className="border-t border-neutral-200 py-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="mr-1">✨</span> {t.featured_h2}
            </h2>
            <Link href={lp("/prompts")} className="text-sm text-neutral-500 hover:text-neutral-900">
              {withCount(t.featured_see_all)}
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => {
              const style = CATEGORY_STYLES[p.category];
              const catLabel = p.category.replace(/_/g, " ");
              return (
                <Link
                  key={p.id}
                  href={lp(`/prompts/${p.id}`)}
                  className="rounded-lg border border-neutral-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-neutral-400">{p.id}</span>
                    {style && (
                      <span className={`rounded-full ${style.chip} px-2 py-0.5 text-[10px] font-medium capitalize`}>
                        {catLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-neutral-900">
                    {promptTitle(p)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-500">{promptSubtitle(p)}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* VERTICALS GRID */}
      <section className="border-t border-neutral-200 py-16">
        <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">{t.verticals_h2}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {VERTICALS.map((v) => (
            <Link
              key={v.code}
              href={lp(`/prompts?category=${v.category}`)}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 transition hover:border-neutral-400 hover:shadow-sm"
            >
              <div>
                <p className="text-xs font-bold text-neutral-400">{v.code}</p>
                <p className="text-sm font-medium text-neutral-900">
                  {t.verticals_labels[v.category]}
                </p>
              </div>
              <p className="text-xs text-neutral-400">{v.count}</p>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Link href={lp("/learn")} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
            {t.verticals_cta}
          </Link>
        </div>
      </section>

      {/* LATEST FROM /LEARN
        *
        * Most recent blog_posts the Content Factory has published.
        * Each card shows the brand-faithful image generated alongside
        * the post + the locale-correct title. Rendered only when there
        * is at least one post with an image; the helper filters out
        * imageless rows so the grid never breaks. */}
      {recentBlogs.length > 0 && (
        <section className="border-t border-neutral-200 py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.blogs_h2}</h2>
              <p className="mt-2 max-w-xl text-sm text-neutral-500">{t.blogs_subtitle}</p>
            </div>
            <Link
              href={lp("/learn")}
              className="whitespace-nowrap text-sm text-neutral-500 hover:text-neutral-900"
            >
              {t.blogs_see_all}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentBlogs.map((b) => (
              <Link
                key={b.slug}
                href={lp(`/learn/${b.slug}`)}
                className="group overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-sm"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                  <Image
                    src={b.image_url}
                    alt={locale === "es" ? b.title_es : b.title_en}
                    fill
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                    className="object-cover transition group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold leading-snug text-neutral-900 line-clamp-2">
                    {locale === "es" ? b.title_es : b.title_en}
                  </h3>
                  <p className="mt-2 text-xs text-neutral-500 line-clamp-2">
                    {locale === "es" ? b.meta_description_es : b.meta_description_en}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* COMPARISON TABLE */}
      <section className="border-t border-neutral-200 py-16">
        <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">{t.compare_h2}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-400">
                {t.compare_th.map((h) => (
                  <th key={h} className="py-3 pr-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-neutral-600">
              {t.compare_rows.map(([alt, limit, asai]) => (
                <tr key={alt} className="border-b border-neutral-100">
                  <td className="py-3 pr-4 font-medium text-neutral-900">{alt}</td>
                  <td className="py-3 pr-4">{limit}</td>
                  <td className="py-3 font-medium text-neutral-900">{asai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ — purchase-friction questions, native accordion (no client JS) */}
      <section className="border-t border-neutral-200 py-16">
        <h2 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">{t.faq_h2}</h2>
        <div className="mx-auto max-w-3xl divide-y divide-neutral-200">
          {t.faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-neutral-900 marker:content-none">
                {item.q}
                <span className="text-neutral-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-neutral-200 py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.final_h2}</h2>
        <p className="mt-3 max-w-xl text-neutral-600">{t.final_body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/roast"
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            {t.final_cta_roast}
          </Link>
          <Link
            href={lp("/pricing")}
            className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
          >
            {t.final_cta_pricing}
          </Link>
        </div>
      </section>
    </div>
  );
}
