import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeaturedPrompts } from "@/lib/supabase/queries";
import { getHomeFigures } from "@/lib/home-figures-server";
import { VERTICAL_COUNT, formatPromptCount, type HomeTool } from "@/lib/home-figures";
import { EDIT_SKILLS, packageAvailable } from "@/lib/edit-bundle/catalog";
import { getRecentBlogPosts, type RecentBlogPost } from "@/lib/learn-pages";
import { CATEGORY_STYLES, VERTICALS as CATEGORY_LABELS, type Prompt } from "@/types/prompt";
import { isLocale, type Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { localeOf, pageMetadata } from "@/lib/seo";
import { getDictionary } from "@/i18n/dictionaries";
import { Badge, Button, Card } from "@/components/ui";
import Testimonials from "@/components/Testimonials";
import HowItWorks from "@/components/HowItWorks";
import HeroVisual, { type HeroPrompt } from "@/components/HeroVisual";
import { promptOfTheDayIndex } from "@/lib/hero-video";
import BlogCover from "@/components/BlogCover";
import { HOME_V2 } from "./home-v2-copy";
import { PROOF_PROJECTS } from "./work/projects";
import HomeSearch from "./HomeSearch";

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
      {eyebrow && <p className="text-eyebrow text-[var(--ink-2)]">{eyebrow}</p>}
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
        dark ? "asai-dark border-black bg-black text-white" : "border-[var(--line)] bg-white"
      }`}
    >
      {character && (
        <Image src={character.src} alt="" width={character.w} height={character.h} className="absolute right-4 top-4 h-auto w-16" />
      )}
      <p className={`text-eyebrow ${dark ? "text-[var(--lime)]" : "text-[var(--accent-ink)]"}`}>{eyebrow}</p>
      <h3 className="pr-16 text-2xl font-extrabold leading-tight">{title}</h3>
      <p className={`text-[15px] ${dark ? "text-white" : "text-[var(--ink-2)]"}`}>{body}</p>
      <ul className={`flex-1 space-y-1.5 text-sm ${dark ? "text-white" : "text-[var(--ink-2)]"}`}>
        {bullets.map((b) => (
          <li key={b}>
            <span className={`mr-2 ${dark ? "text-[var(--lime)]" : "text-[var(--accent)]"}`} aria-hidden="true">—</span>
            {b}
          </li>
        ))}
      </ul>
      <Button href={href} variant={dark ? "lime" : "secondary"} className="mt-1 self-start">
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
  // Total y herramientas salen de getHomeFigures, con cache de una hora (2026-11-05); antes
  // getStats() contaba en la base en cada visita.
  const [featuredRes, figuresRes, recentBlogsRes] = await Promise.allSettled([
    getFeaturedPrompts(6),
    getHomeFigures(),
    getRecentBlogPosts(6),
  ]);
  const featured: Prompt[] =
    featuredRes.status === "fulfilled" ? featuredRes.value : [];
  const promptsTotalRaw =
    figuresRes.status === "fulfilled" && figuresRes.value.promptsTotal > 0 ? figuresRes.value.promptsTotal : 3000;
  const promptsTotal = formatPromptCount(promptsTotalRaw);
  const tools: HomeTool[] = figuresRes.status === "fulfilled" ? figuresRes.value.tools : [];
  const recentBlogs: RecentBlogPost[] =
    recentBlogsRes.status === "fulfilled" ? recentBlogsRes.value : [];

  // Tiny interpolation — these dict keys carry "{n}" where the prompt
  // count belongs. We keep marketing copy in dictionaries.ts and inject
  // the live number here so the public-facing claim stays accurate as
  // the catalog grows.
  const withCount = (s: string) => s.replace(/\{n\}/g, promptsTotal);

  /* Franja de cifras (2026-11-05): nada escrito a mano que envejezca. Prompts de la base,
   * verticales del catalogo de tipos, skills con paquete descargable en el repo. El «15+» es
   * la cifra que el sitio ya usa para los anos de ARTO (seo.ts, dictionaries.ts). */
  const skillsAvailable = EDIT_SKILLS.filter((s) => packageAvailable(s.slug)).length;
  const figures = [
    { value: promptsTotal, label: v2.fig_prompts },
    { value: String(VERTICAL_COUNT), label: v2.fig_verticals },
    ...(skillsAvailable > 0 ? [{ value: String(skillsAvailable), label: v2.fig_skills }] : []),
    { value: v2.fig_years_value, label: v2.fig_years },
  ];

  /* Prompt del dia del hero (marca v2.0): uno de los destacados, cambia cada dia. Sin destacados
   * (base caida) sale la tarjeta de ejemplo del mockup y lleva al catalogo. */
  const potdIndex = promptOfTheDayIndex(featured.length);
  const potd = potdIndex >= 0 ? featured[potdIndex] : null;
  const heroPrompt: HeroPrompt = potd
    ? {
        id: potd.id,
        code: CATEGORY_LABELS[potd.category]?.code ?? potd.id.slice(0, 2),
        category: (locale === "es" ? CATEGORY_LABELS[potd.category]?.label_es : CATEGORY_LABELS[potd.category]?.label_en) ?? potd.category,
        title: locale === "es" ? potd.title_es : potd.title_en,
        body: potd.use_case?.trim() || (locale === "es" ? potd.title_en : potd.title_es),
        href: lp(`/prompts/${potd.id}`),
      }
    : {
        id: "",
        code: "CW",
        category: "Copywriting",
        title: v2.potd_fallback_title,
        body: v2.potd_fallback_body,
        href: lp("/prompts"),
      };

  // Pick the title in the active locale (Prompt type has both title_en and title_es).
  const promptTitle = (p: Prompt) => (locale === "es" ? p.title_es : p.title_en);
  const promptSubtitle = (p: Prompt) => (locale === "es" ? p.title_en : p.title_es);

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* HERO v2 (2026-10-07): titular con palabra en serif. Ilustracion de siluetas
        * (estilo A, aprobado por Victor el 2026-10-10) en la columna derecha; el grafico de
        * tres pasos baja a su propia seccion justo debajo. */}
      <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.02fr_1fr] lg:gap-12">
        <div className="grid min-w-0 gap-5">
          <p className="text-eyebrow text-[var(--accent-ink)]">{v2.eyebrow}</p>
          <h1 className="text-display">
            {v2.h1_before} <span className="serif-accent">{v2.h1_accent}</span> {v2.h1_after}
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-black">{v2.lead}</p>
          <div className="flex flex-wrap gap-2.5">
            <Button href={lp("/prompts")}>{v2.cta_prompts}</Button>
            <Button href={lp("/roast")} variant="secondary">{v2.cta_roast}</Button>
          </div>
          <p className="font-mono text-xs text-[var(--ink-2)]">{withCount(v2.fine)}</p>
        </div>
        {/* Marca v2.0: sale la luna naranja. Panel negro con el corredor (o el video en loop cuando
          * exista) y la tarjeta azul del prompt del dia. */}
        <HeroVisual
          prompt={heroPrompt}
          labels={{ badge: v2.potd_badge, eyebrow: v2.potd_eyebrow, copy: v2.potd_copy, view: v2.potd_view }}
        />
      </section>

      {/* PARA QUIEN ES (2026-11-05): justo debajo del hero. Textos de las tarjetas aprobados por
        * Victor; cada una lleva a la parte de la biblioteca que le sirve a ese publico. */}
      <section className="border-t border-[var(--line)] py-16">
        <SectionHead eyebrow={v2.who_eyebrow} title={v2.who_h2} className="mb-10" />
        <div className="grid gap-4 md:grid-cols-2">
          {v2.who_cards.map((c) => (
            <div
              key={c.title}
              className="flex flex-col gap-3.5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]"
            >
              <h3 className="text-2xl font-extrabold leading-tight">{c.title}</h3>
              <p className="flex-1 text-[15px] text-[var(--ink-2)]">{c.body}</p>
              <Button href={lp(c.href)} variant="secondary" className="mt-1 self-start">
                {c.cta}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* BUSCADOR ABIERTO, CIFRAS Y HERRAMIENTAS (2026-11-05). El buscador es un form GET a
        * /prompts?q=, funciona sin JS. Las herramientas salen de los ai_model reales del catalogo,
        * solo texto, sin logos de marcas. */}
      <section className="border-t border-[var(--line)] py-16">
        <div className="asai-dark grid gap-4 rounded-[24px] bg-black p-6 text-white sm:p-10">
          <h2 className="text-h2 text-white">{v2.search_h2}</h2>
          <HomeSearch
            locale={locale}
            label={v2.search_label}
            placeholder={v2.search_placeholder}
            button={v2.search_button}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-white">
            <span>{v2.search_try}</span>
            {v2.search_examples.map((ex) => (
              <Link
                key={ex}
                href={lp(`/prompts?q=${encodeURIComponent(ex)}`)}
                className="inline-flex min-h-[36px] items-center rounded-full border border-white bg-white px-3.5 text-[13px] text-black hover:bg-[var(--lime)]"
              >
                {ex}
              </Link>
            ))}
          </div>
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {figures.map((f) => (
            <div key={f.label} className="flex min-w-0 flex-col-reverse justify-end gap-1 border-l-2 border-[var(--accent)] pl-4">
              <dt className="text-sm text-[var(--ink-2)]">{f.label}</dt>
              <dd className="font-display text-3xl font-extrabold tracking-[-0.02em] text-black sm:text-4xl">{f.value}</dd>
            </div>
          ))}
        </dl>

        {tools.length > 0 && (
          <div className="mt-10">
            <p className="text-eyebrow text-[var(--ink-2)]">{v2.tools_eyebrow}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {tools.map((tool) => (
                <li
                  key={tool.key}
                  className="rounded-full bg-[var(--lime-hover)] px-3.5 py-1.5 text-sm text-black"
                >
                  {tool.label}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--ink-2)]">{v2.tools_note}</p>
          </div>
        )}
      </section>

      {/* COMO FUNCIONA: el grafico de tres pasos que antes ocupaba el hero */}
      <section className="grid items-center gap-10 border-t border-[var(--line)] py-16 lg:grid-cols-[1fr_1fr] lg:gap-12">
        <SectionHead eyebrow={v2.how_eyebrow} title={v2.how_h2} />
        <HowItWorks locale={locale} />
      </section>

      {/* DISPONIBLE HOY: biblioteca, roast y el pack de la proxima semana */}
      <section className="border-t border-[var(--line)] py-16">
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
        <section className="border-t border-[var(--line)] py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <SectionHead title={t.featured_h2} />
            <Link href={lp("/prompts")} className="whitespace-nowrap text-sm text-[var(--ink-2)] hover:text-[var(--accent)]">
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
                    <span className="font-mono text-[10px] text-[var(--ink-2)]">{p.id}</span>
                    {style && <Badge tone="neutral" mono={false} className="capitalize">{catLabel}</Badge>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-black">{promptTitle(p)}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[var(--ink-2)]">{promptSubtitle(p)}</p>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* VERTICALS GRID */}
      <section className="border-t border-[var(--line)] py-16">
        <SectionHead title={t.verticals_h2} className="mb-8" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {VERTICALS.map((v) => (
            <Link
              key={v.code}
              href={lp(`/prompts?category=${v.category}`)}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--line)] bg-white px-4 py-3 transition hover:border-black hover:shadow-[var(--shadow-sm)]"
            >
              <div>
                <p className="font-mono text-[11px] font-medium text-[var(--ink-2)]">{v.code}</p>
                <p className="text-sm font-medium text-black">{t.verticals_labels[v.category]}</p>
              </div>
              <p className="font-mono text-xs text-[var(--ink-2)]">{v.count}</p>
            </Link>
          ))}
        </div>
        <div className="mt-6">
          <Link href={lp("/learn")} className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--accent)]">
            {t.verticals_cta}
          </Link>
        </div>
      </section>

      {/* SOCIAL PROOF: proyectos reales de /work (imagenes que ya existen) */}
      <section className="border-t border-[var(--line)] py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <SectionHead eyebrow={t.proof_eyebrow} title={t.proof_h2} />
          <Link href={lp("/work")} className="whitespace-nowrap text-sm text-[var(--ink-2)] hover:text-[var(--accent)]">
            {t.proof_cta}
          </Link>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PROOF_PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link href={lp("/work")} className="group block" title={`${p.name} · ${p.client}`}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--lime-hover)]">
                  <Image
                    src={p.image}
                    alt={`${p.name}, ${p.client}`}
                    fill
                    sizes="(min-width: 640px) 16vw, 33vw"
                    className="object-cover grayscale transition group-hover:grayscale-0"
                  />
                </div>
                <p className="mt-2 truncate font-mono text-[11px] text-[var(--ink-2)] group-hover:text-[var(--accent)]">{p.client}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Testimonials locale={locale} />

      {/* THE ARTO METHOD */}
      <section className="border-t border-[var(--line)] py-16">
        <SectionHead eyebrow={t.method_eyebrow} title={t.method_h2} className="mb-10" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {t.method_pillars.map((p) => (
            <Card key={p.n} padding="sm" className="p-5">
              <span className="font-mono text-xs font-medium text-[var(--ink-2)]">{p.n}</span>
              <h3 className="mt-1 font-bold">{p.title}</h3>
              <p className="mt-1 text-sm text-[var(--ink-2)]">{p.desc}</p>
            </Card>
          ))}
        </div>
        <div className="mt-6">
          <Link href={lp("/pricing")} className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--accent)]">
            {t.method_cta}
          </Link>
        </div>
      </section>

      {/* DIFFERENTIATORS */}
      <section className="border-t border-[var(--line)] py-16">
        <SectionHead eyebrow={t.diff_eyebrow} title={t.diff_h2} className="mb-10" />
        <div className="grid gap-6 sm:grid-cols-3">
          {t.diff_items.map((d) => (
            <Card key={d.title} padding="sm" className="p-5">
              <h3 className="font-bold">{d.title}</h3>
              <p className="mt-2 text-sm text-[var(--ink-2)]">{d.desc}</p>
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
        <section className="border-t border-[var(--line)] py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <SectionHead eyebrow={t.blogs_h2} title={v2.blogs_h2} />
              <p className="mt-3 max-w-xl text-sm text-[var(--ink-2)]">{t.blogs_subtitle}</p>
            </div>
            <Link href={lp("/learn")} className="whitespace-nowrap text-sm text-[var(--ink-2)] hover:text-[var(--accent)]">
              {t.blogs_see_all}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentBlogs.map((b) => (
              <Card key={b.slug} href={lp(`/learn/${b.slug}`)} padding="none" className="group overflow-hidden">
                <BlogCover category={b.category} locale={locale} className="border-b border-[var(--line)]" />
                <div className="p-4">
                  <h3 className="font-display text-lg font-extrabold leading-tight tracking-[-0.02em] text-black line-clamp-2">
                    {locale === "es" ? b.title_es : b.title_en}
                  </h3>
                  <p className="mt-2 text-xs text-[var(--ink-2)] line-clamp-2">
                    {locale === "es" ? b.meta_description_es : b.meta_description_en}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* CITA del metodo (serif, propuesta 2026-10-07) */}
      <section className="border-t border-[var(--line)] py-16">
        <div className="asai-dark grid gap-5 rounded-[24px] bg-black px-8 py-12 text-white sm:px-12 sm:py-14">
          <p className="text-eyebrow text-[var(--lime)]">{v2.quote_eyebrow}</p>
          <p className="max-w-[30ch] font-display text-[clamp(26px,3.4vw,44px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-white">{v2.quote}</p>
          <p className="font-mono text-xs text-[var(--lime)]">{v2.quote_by}</p>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="border-t border-[var(--line)] py-16">
        <SectionHead title={t.compare_h2} className="mb-8" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--ink-2)]">
                {t.compare_th.map((h) => (
                  <th key={h} className="py-3 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[var(--ink-2)]">
              {t.compare_rows.map(([alt, limit, asai]) => (
                <tr key={alt} className="border-b border-[var(--line)]">
                  <td className="py-3 pr-4 font-medium text-black">{alt}</td>
                  <td className="py-3 pr-4">{limit}</td>
                  <td className="py-3 font-medium text-black">{asai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ — purchase-friction questions, native accordion (no client JS) */}
      <section className="border-t border-[var(--line)] py-16">
        <SectionHead title={t.faq_h2} className="mb-8" />
        <div className="mx-auto max-w-3xl divide-y divide-[var(--line)]">
          {t.faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-black marker:content-none">
                {item.q}
                <span className="text-[var(--ink-2)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-[var(--line)] py-16">
        <h2 className="text-h2">{t.final_h2}</h2>
        <span className="accent-rule mt-4" />
        <p className="mt-4 max-w-xl text-[var(--ink-2)]">{t.final_body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href={`/${locale}/roast`}>{t.final_cta_roast}</Button>
          <Button href={lp("/pricing")} variant="secondary">{t.final_cta_pricing}</Button>
        </div>
      </section>
    </div>
  );
}
