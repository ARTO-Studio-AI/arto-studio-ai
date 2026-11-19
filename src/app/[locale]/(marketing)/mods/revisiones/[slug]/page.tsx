import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui";
import { isLocale, LOCALES, type Locale } from "@/i18n/config";
import { buildMetadata, clampDescription, localeOf, withBrand } from "@/lib/seo";
import { getReviewPage, REVIEW_LABELS, REVIEWS, type FindingLevel } from "@/lib/revisiones";

/* Revision publica que vive en creative (19 nov 2026, REA). Mismo orden que la de Project NOMAD en
 * artostudio.ai: que es, recomendacion, lo que encontramos, como instalarlo, limites, ficha rapida.
 * El texto sale de src/lib/revisiones.ts. Marca v2.0: fondo lima, tarjetas blancas, paneles negros
 * con letra lima o blanca, boton azul con letra blanca. Sobre lima la letra nunca es blanca. */

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

const CONTACT = "contact@artogroup.com";

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => REVIEWS.filter((r) => getReviewPage(r.slug)).map((r) => ({ locale, slug: r.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = localeOf(localeParam);
  const review = getReviewPage(slug);
  const page = review?.page?.[locale];
  if (!review || !page) return {};
  return buildMetadata({
    locale,
    path: review.href,
    title: withBrand(page.metaTitle),
    description: clampDescription(page.metaDescription),
  });
}

function LevelChip({ level, label }: { level: FindingLevel; label: string }) {
  /* Medio: negro con letra lima. Bajo: blanco con borde y letra negra. */
  const cls = level === "medio" ? "bg-black text-[var(--lime)] border-black" : "bg-white text-black border-black";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${cls}`}>{label}</span>;
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--line)] py-12">
      <p className="text-eyebrow text-[var(--ink-2)]">{eyebrow}</p>
      <h2 className="text-h2 mt-2">{title}</h2>
      <span className="accent-rule mt-4" />
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function ReviewPage({ params }: Props) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const review = getReviewPage(slug);
  const p = review?.page?.[locale];
  if (!review || !p) notFound();
  const l = REVIEW_LABELS[locale];
  const lp = (path: string) => `/${locale}${path}`;
  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent(`${p.askLabel}: ${review.name} ${review.version}`)}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <Link href={lp("/mods")} className="text-sm text-[var(--ink-2)] hover:text-black">
        {p.back}
      </Link>

      <header className="mt-6">
        <p className="text-eyebrow text-[var(--ink-2)]">{l.eyebrow} · Creative</p>
        <h1 className="text-h1 mt-3">{p.h1}</h1>
        <span className="accent-rule mt-4" />
        <p className="mt-5 max-w-[60ch] text-lg text-[var(--ink-2)]">{p.lead}</p>
        <p className="mt-4 font-mono text-xs text-[var(--ink-2)]">{p.meta}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button href={p.repoUrl} external size="lg">
            {p.repoLabel}
          </Button>
          <Button href={mailto} external variant="secondary" size="lg">
            {p.askLabel}
          </Button>
        </div>
      </header>

      <div className="mt-12">
        <Section eyebrow={p.what.eyebrow} title={p.what.title}>
          <div className="grid gap-4 text-[17px] leading-relaxed">
            {p.what.paragraphs.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </Section>

        {/* Recomendacion en panel negro: letra blanca y lima sobre negro. */}
        <section className="asai-dark my-4 rounded-[var(--radius-lg)] bg-black p-6 text-white sm:p-8">
          <p className="text-eyebrow text-[var(--lime)]">{p.recommendation.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{p.recommendation.title}</h2>
          <ul className="mt-5 grid gap-2 text-[17px]">
            {p.recommendation.items.map((t) => (
              <li key={t} className="flex gap-3">
                <span className="text-[var(--lime)]">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-[60ch] text-[15px] text-white/85">{p.recommendation.note}</p>
        </section>

        <Section eyebrow={p.found.eyebrow} title={p.found.title}>
          <p className="max-w-[60ch] text-[17px]">{p.found.intro}</p>
          <ul className="mt-5 grid gap-2.5">
            {p.found.good.map((t) => (
              <li key={t} className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4 text-[15px]">
                <span className="font-bold text-[var(--accent-ink)]">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-10 text-xl font-extrabold">{p.found.findingsTitle}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {p.found.findings.map((f) => (
              <div key={f.title} className="rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-5">
                <LevelChip level={f.level} label={p.levels[f.level]} />
                <h4 className="mt-3 font-bold">{f.title}</h4>
                <p className="mt-1.5 text-[15px] text-[var(--ink-2)]">{f.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section eyebrow={p.install.eyebrow} title={p.install.title}>
          <ol className="grid gap-3">
            {p.install.steps.map((t, i) => (
              <li key={t} className="flex gap-4 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-4 text-[15px]">
                <span className="font-mono text-sm font-bold text-[var(--accent-ink)]">{i + 1}</span>
                <span className="min-w-0 break-words">{t}</span>
              </li>
            ))}
          </ol>
          <h3 className="mt-8 font-bold">{p.install.uninstallTitle}</h3>
          <p className="mt-1.5 break-words text-[15px]">{p.install.uninstall}</p>
          <p className="mt-6 max-w-[60ch] text-[15px] text-[var(--ink-2)]">
            {p.install.askNote}{" "}
            <a href={mailto} className="font-semibold text-[var(--accent-ink)] underline underline-offset-2">
              {CONTACT}
            </a>
            .
          </p>
        </Section>

        <Section eyebrow={p.limits.eyebrow} title={p.limits.title}>
          <ul className="grid list-disc gap-2 pl-5 text-[15px]">
            {p.limits.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mt-5 font-semibold">{p.limits.next}</p>
        </Section>

        <section className="rounded-[var(--radius-lg)] border-2 border-black bg-white p-6 sm:p-8">
          <h2 className="text-xl font-extrabold">{p.facts.title}</h2>
          <dl className="mt-4 grid gap-0 text-[15px]">
            {p.facts.rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-t border-[var(--line)] py-2.5 first:border-t-0">
                <dt className="text-[var(--ink-2)]">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href={p.repoUrl} external>
              {p.repoLabel}
            </Button>
            <Button href={mailto} external variant="secondary">
              {p.askLabel}
            </Button>
          </div>
        </section>

        <p className="mt-8 font-mono text-xs leading-relaxed text-[var(--ink-2)]">{p.disclaimer}</p>
        <div className="mt-8 text-center">
          <Link href={lp("/mods")} className="text-sm text-[var(--ink-2)] hover:text-black">
            {p.back}
          </Link>
        </div>
      </div>
    </div>
  );
}
