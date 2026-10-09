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
import { Badge, Button, Card } from "@/components/ui";
import Testimonials from "@/components/Testimonials";
import HowItWorks from "@/components/HowItWorks";
import BlogCover from "@/components/BlogCover";
import { HOME_V2 } from "./home-v2-copy";
import { PROOF_PROJECTS } from "./work/projects";

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

function SectionHead({ eyebrow, title, className = "" }: { eyebrow?: string; title: string; className?: string }) {
  return (
    <div className={className}>
      {eyebrow && <p className="text-eyebrow text-zinc-500">{eyebrow}</p>}
      <h2 className="text-h2 mt-2">{title}</h2>
      <span className="accent-rule mt-4" />
    </div>
  );
}

function ProductCard({
  eyebrow,
  title,
  body,
  bullets,
  cta,
  href,
  character,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  cta: string;
  href: string;
  character?: { src: string; w: number; h: number };
  dark?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col gap-3.5 overflow-hidden rounded-[var(--radius-lg)] border p-6 shadow-[var(--shadow-sm)] ${
        dark ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white"
      }`}
    >
      {character && (
        <Image src={character.src} alt="" width={character.w} height={character.h} className="absolute right-4 top-4 h-auto w-16" />
      )}
      <p className="text-eyebrow text-[var(--accent)]">{eyebrow}</p>
      <h3 className="pr-16 text-2xl font-extrabold leading-tight">{title}</h3>
      <p className={`text-[15px] ${dark ? "text-zinc-300" : "text-zinc-600"}`}>{body}</p>
      <ul className={`flex-1 space-y-1.5 text-sm ${dark ? "text-zinc-300" : "text-zinc-600"}`}>
        {bullets.map((b) => (
          <li key={b}>
            <span className="mr-2 text-[var(--accent)]" aria-hidden="true">—</span>
            {b}
          </li>
        ))}
      </ul>
      <Button href={href} variant={dark ? "secondary" : "secondary"} className="mt-1 self-start">
        {cta}
      </Button>
    </div>
  );
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
  const v2 = HOME_V2[locale];
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
      {/* HERO v2 (2026-10-07): titular con palabra en serif y grafico de tres pasos que
        * explica el producto al entrar. */}
      <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.02fr_1fr] lg:gap-12">
        <div className="grid min-w-0 gap-5">
          <p className="text-eyebrow text-[var(--accent)]">{v2.eyebrow}</p>
          <h1 className="text-display">
            {v2.h1_before} <span className="serif-accent">{v2.h1_accent}</span>
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-zinc-600">{v2.lead}</p>
          <div className="flex flex-wrap gap-2.5">
            <Button href={lp("/prompts")}>{v2.cta_prompts}</Button>
            <Button href={lp("/roast")} variant="secondary">{v2.cta_roast}</Button>
          </div>
          <p className="font-mono text-xs text-zinc-400">{withCount(v2.fine)}</p>
        </div>
        <HowItWorks locale={locale} />
      </section>

      {/* DISPONIBLE HOY: biblioteca, roast y el pack de la proxima semana */}
      <section className="border-t border-zinc-200 py-16">
        <SectionHead eyebrow={t.tiers_eyebrow} title={v2.tiers_h2} className="mb-10" />
        <div className="grid gap-4 md:grid-cols-3">
          <ProductCard
            eyebrow={v2.lib_eyebrow}
            title={v2.lib_title}
            body={withCount(v2.lib_body)}
            bullets={v2.lib_bullets}
            cta={v2.lib_cta}
            href={lp("/prompts")}
            character={{ src: "/brand/arto-character-01.png", w: 290, h: 273 }}
          />
          <ProductCard
            eyebrow={v2.roast_eyebrow}
            title={v2.roast_title}
            body={v2.roast_body}
            bullets={v2.roast_bullets}
            cta={v2.roast_cta}
            href={lp("/roast")}
            character={{ src: "/brand/characters/character-04.png", w: 267, h: 273 }}
          />
          <ProductCard
            dark
            eyebrow={v2.pack_eyebrow}
            title={v2.pack_title}
            body={v2.pack_body}
            bullets={v2.pack_bullets}
            cta={v2.pack_cta}
            href={lp("/skills")}
          />
        </div>
      </section>

      {/* FEATURED PROMPTS — live from Supabase */}
      {featured.length > 0 && (
        <section className="border-t border-zinc-200 py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <SectionHead title={t.featured_h2} />
            <Link href={lp("/prompts")} className="whitespace-nowrap text-sm text-zinc-500 hover:text-zinc-900">
              {withCount(t.featured_see_all)}
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => {
              const style = CATEGORY_STYLES[p.category];
              const catLabel = p.category.replace(/_/g, " ");
              return (
                <Card key={p.id} href={lp(`/prompts/${p.id}`)} padding="sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-500">{p.id}</span>
                    {style && <Badge tone="neutral" mono={false} className="capitalize">{catLabel}</Badge>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-900">{promptTitle(p)}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{promptSubtitle(p)}</p>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* VERTICALS GRID */}
      <section className="border-t border-zinc-200 py-16">
        <SectionHead title={t.verticals_h2} className="mb-8" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {VERTICALS.map((v) => (
            <Link
              key={v.code}
              href={lp(`/prompts?category=${v.category}`)}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-400 hover:shadow-[var(--shadow-sm)]"
            >
              <div>
                <p className="font-mono text-[11px] font-medium text-zinc-500">{v.code}</p>
                <p className="text-sm font-medium text-zinc-900">{t.verticals_labels[v.category]}</p>
              </div>
              <p className="font-mono text-xs text-zinc-500">{v.count}</p>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Link href={lp("/learn")} className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            {t.verticals_cta}
          </Link>
        </div>
      </section>

      {/* SOCIAL PROOF: proyectos reales de /work (imagenes que ya existen) */}
      <section className="border-t border-zinc-200 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <SectionHead eyebrow={t.proof_eyebrow} title={t.proof_h2} />
          <Link href={lp("/work")} className="whitespace-nowrap text-sm text-zinc-500 hover:text-zinc-900">
            {t.proof_cta}
          </Link>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PROOF_PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link href={lp("/work")} className="group block" title={`${p.name} · ${p.client}`}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] border border-zinc-200 bg-zinc-100">
                  <Image
                    src={p.image}
                    alt={`${p.name}, ${p.client}`}
                    fill
                    sizes="(min-width: 640px) 16vw, 33vw"
                    className="object-cover grayscale transition group-hover:grayscale-0"
                  />
                </div>
                <p className="mt-2 truncate font-mono text-[11px] text-zinc-500 group-hover:text-zinc-900">{p.client}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Testimonials locale={locale} />

      {/* THE ARTO METHOD */}
      <section className="border-t border-zinc-200 py-16">
        <SectionHead eyebrow={t.method_eyebrow} title={t.method_h2} className="mb-10" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {t.method_pillars.map((p) => (
            <Card key={p.n} padding="sm" className="p-5">
              <span className="font-mono text-xs font-medium text-zinc-500">{p.n}</span>
              <h3 className="mt-1 font-bold">{p.title}</h3>
              <p className="mt-1 text-sm text-zinc-500">{p.desc}</p>
            </Card>
          ))}
        </div>
        <div className="mt-6">
          <Link href={lp("/pricing")} className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            {t.method_cta}
          </Link>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section className="border-t border-zinc-200 py-16">
        <SectionHead eyebrow={t.diff_eyebrow} title={t.diff_h2} className="mb-10" />
        <div className="grid gap-6 sm:grid-cols-3">
          {t.diff_items.map((d) => (
            <Card key={d.title} padding="sm" className="p-5">
              <h3 className="font-bold">{d.title}</h3>
              <p className="mt-2 text-sm text-zinc-500">{d.desc}</p>
            </Card>
          ))}
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
        <section className="border-t border-zinc-200 py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <SectionHead eyebrow={t.blogs_h2} title={v2.blogs_h2} />
              <p className="mt-3 max-w-xl text-sm text-zinc-500">{t.blogs_subtitle}</p>
            </div>
            <Link href={lp("/learn")} className="whitespace-nowrap text-sm text-zinc-500 hover:text-zinc-900">
              {t.blogs_see_all}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentBlogs.map((b) => (
              <Card key={b.slug} href={lp(`/learn/${b.slug}`)} padding="none" className="group overflow-hidden">
                <BlogCover category={b.category} locale={locale} className="border-b border-zinc-200" />
                <div className="p-4">
                  <h3 className="font-display text-lg font-extrabold leading-tight tracking-[-0.02em] text-zinc-900 line-clamp-2">
                    {locale === "es" ? b.title_es : b.title_en}
                  </h3>
                  <p className="mt-2 text-xs text-zinc-500 line-clamp-2">
                    {locale === "es" ? b.meta_description_es : b.meta_description_en}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* CITA del metodo (serif, propuesta 2026-10-07) */}
      <section className="border-t border-zinc-200 py-16">
        <div className="grid gap-3.5 rounded-[var(--radius-lg)] bg-[var(--paper)] p-8">
          <p className="text-eyebrow text-zinc-500">{v2.quote_eyebrow}</p>
          <p className="max-w-[34ch] font-serif text-[clamp(24px,3vw,34px)] font-medium italic leading-tight text-zinc-900">{v2.quote}</p>
          <p className="font-mono text-xs text-zinc-400">{v2.quote_by}</p>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="border-t border-zinc-200 py-16">
        <SectionHead title={t.compare_h2} className="mb-8" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                {t.compare_th.map((h) => (
                  <th key={h} className="py-3 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-zinc-600">
              {t.compare_rows.map(([alt, limit, asai]) => (
                <tr key={alt} className="border-b border-zinc-100">
                  <td className="py-3 pr-4 font-medium text-zinc-900">{alt}</td>
                  <td className="py-3 pr-4">{limit}</td>
                  <td className="py-3 font-medium text-zinc-900">{asai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ — purchase-friction questions, native accordion (no client JS) */}
      <section className="border-t border-zinc-200 py-16">
        <SectionHead title={t.faq_h2} className="mb-8" />
        <div className="mx-auto max-w-3xl divide-y divide-zinc-200">
          {t.faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-zinc-900 marker:content-none">
                {item.q}
                <span className="text-zinc-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-zinc-200 py-16">
        <h2 className="text-h2">{t.final_h2}</h2>
        <span className="accent-rule mt-4" />
        <p className="mt-4 max-w-xl text-zinc-600">{t.final_body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href={`/${locale}/roast`}>{t.final_cta_roast}</Button>
          <Button href={lp("/pricing")} variant="secondary">{t.final_cta_pricing}</Button>
        </div>
      </section>
    </div>
  );
}
