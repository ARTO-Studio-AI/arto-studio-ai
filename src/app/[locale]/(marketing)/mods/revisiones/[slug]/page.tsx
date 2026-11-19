import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, LOCALES, type Locale } from "@/i18n/config";
import { buildMetadata, clampDescription, localeOf, withBrand } from "@/lib/seo";
import { getReviewPage, REVIEW_LABELS, REVIEWS, type ReviewSection } from "@/lib/revisiones";

/* Pagina de un mod revisado (19 nov 2026). Plantilla unica: la misma de Project NOMAD en
 * artostudio.ai/mods/project-nomad/, para que todas las paginas de mods se vean igual (Victor).
 *   Cabecera lima: migas, eyebrow, titulo con la palabra clave en marcatexto rosa (letra negra),
 *   lead, meta, botones (azul con letra blanca y blanco con borde negro) y, a la derecha, el video
 *   vertical 9:16 con borde negro. Sin video, recuadro negro con el nombre en lima.
 *   Cuerpo blanco: secciones a la izquierda (veredicto en panel negro, fallas en tarjetas con
 *   insignia negra y punto lima) y la ficha rapida lima fija a la derecha.
 * Sobre lima la letra nunca es blanca. El texto sale de src/lib/revisiones.ts. */

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
    ogImage: page.media.video?.poster,
  });
}

const H2 = "text-[clamp(1.5rem,2.8vw,2rem)] font-extrabold leading-[1.08] tracking-[-0.03em]";
const BTN = "inline-flex items-center justify-center rounded-[var(--radius-sm)] border px-[18px] py-3 text-[15px] font-semibold leading-tight transition-colors";
const BTN_PRIMARY = `${BTN} border-transparent bg-[var(--accent)] font-bold text-white hover:bg-[var(--accent-hover)] hover:text-white`;
const BTN_SECONDARY = `${BTN} border-black bg-white text-black hover:bg-[var(--lime-hover)] hover:text-black`;

function Head({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className="text-eyebrow text-[var(--ink-2)]">{eyebrow}</p>
      <h2 className={H2}>{title}</h2>
      <span className="accent-rule" />
    </>
  );
}

function Section({ s, mailto }: { s: ReviewSection; mailto: string }) {
  if (s.kind === "verdict") {
    return (
      <section className="asai-dark grid gap-2.5 rounded-[var(--radius-lg)] bg-black p-7 text-white">
        <p className="text-eyebrow text-[var(--lime)]">{s.eyebrow}</p>
        <strong className="block text-[clamp(1.25rem,2.4vw,1.6rem)] font-extrabold leading-[1.2] tracking-[-0.02em]">{s.strong}</strong>
        <p>{s.body}</p>
      </section>
    );
  }
  const List = s.kind === "list" && s.ordered ? "ol" : "ul";
  return (
    <section className="grid gap-3">
      <Head eyebrow={s.eyebrow} title={s.title} />
      {s.kind === "text" && s.paragraphs.map((t) => <p key={t} className="max-w-[62ch]">{t}</p>)}
      {s.kind === "flags" && (
        <>
          <p className="max-w-[62ch]">{s.intro}</p>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {s.flags.map((f) => (
              <div key={f.title} className="grid content-start gap-2 rounded-[var(--radius-lg)] border border-black/30 bg-white p-[22px]">
                <span className="inline-flex items-center gap-1.5 justify-self-start rounded-full bg-black px-2.5 py-0.5 font-mono text-[10.5px] uppercase leading-[18px] tracking-[0.08em] text-white">
                  <span className="size-1.5 rounded-full bg-[var(--lime)]" aria-hidden />
                  {f.badge}
                </span>
                <h3 className="text-[19px] font-extrabold leading-[1.2] tracking-[-0.03em]">{f.title}</h3>
                <p className="text-[15px]">{f.body}</p>
              </div>
            ))}
          </div>
          {s.more && s.more.length > 0 && (
            <>
              {s.moreLabel && <p>{s.moreLabel}</p>}
              <ul className="grid max-w-[62ch] list-disc gap-2 pl-[22px] marker:font-bold marker:text-[var(--accent)]">
                {s.more.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </>
          )}
        </>
      )}
      {s.kind === "list" && (
        <>
          {s.intro && <p className="max-w-[62ch]">{s.intro}</p>}
          <List className={`grid max-w-[62ch] gap-2 pl-[22px] marker:font-bold marker:text-[var(--accent)] ${s.ordered ? "list-decimal" : "list-disc"}`}>
            {s.items.map((t) => <li key={t} className="break-words">{t}</li>)}
          </List>
          {s.outro?.map((t) => <p key={t} className="max-w-[62ch] break-words">{t}</p>)}
          {s.askNote && (
            <p className="max-w-[62ch]">
              {s.askNote}{" "}
              <a href={mailto} className="underline decoration-[var(--accent)] underline-offset-[3px]">
                {CONTACT}
              </a>
              .
            </p>
          )}
        </>
      )}
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
  const lp = (path: string) => `/${locale}${path}`;
  const mailto = `mailto:${CONTACT}?subject=${encodeURIComponent(`${p.askLabel}: ${review.name} ${review.version}`)}`;
  const actions = (
    <>
      <a href={p.repoUrl} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY}>
        {p.repoLabel}
      </a>
      <a href={mailto} className={BTN_SECONDARY}>
        {p.askLabel}
      </a>
    </>
  );

  return (
    <div className="text-black">
      {/* Cabecera lima con el video */}
      <section className="bg-[var(--lime)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-14">
          <div className="grid min-w-0 gap-5">
            <p className="font-mono text-[13px] text-[var(--ink-2)]">
              <Link href={lp("/")} className="hover:text-black hover:underline">
                ← {p.crumbs.home}
              </Link>{" "}
              /{" "}
              <Link href={lp("/mods")} className="hover:text-black hover:underline">
                {p.crumbs.mods}
              </Link>
            </p>
            <p className="text-eyebrow text-[var(--ink-2)]">{REVIEW_LABELS[locale].eyebrow} · Creative</p>
            <h1 className="text-balance text-[clamp(2.3rem,5.4vw,4.2rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">
              {p.h1} <span className="serif-accent">{p.h1Key}</span>
            </h1>
            <p className="max-w-[46ch] text-lg leading-relaxed">{p.lead}</p>
            <p className="font-mono text-[12.5px] text-[var(--ink-2)]">{p.meta}</p>
            <div className="flex flex-wrap gap-2.5">{actions}</div>
          </div>
          <figure className="grid justify-items-center gap-2.5">
            {p.media.video ? (
              <video
                controls
                preload="metadata"
                playsInline
                poster={p.media.video.poster}
                className="block aspect-[9/16] w-full max-w-[340px] rounded-[var(--radius-lg)] border-2 border-black bg-black"
              >
                <source src={p.media.video.src} type="video/mp4" />
              </video>
            ) : (
              <div className="flex aspect-[9/16] w-full max-w-[280px] flex-col justify-between rounded-[var(--radius-lg)] border-2 border-black bg-black p-6 lg:max-w-[340px]">
                <span className="text-eyebrow text-[var(--lime)]">{REVIEW_LABELS[locale].eyebrow}</span>
                <span className="text-6xl font-extrabold leading-none tracking-tight text-[var(--lime)]">{review.name}</span>
                <span className="font-mono text-xs text-[var(--lime)]">{p.media.tag}</span>
              </div>
            )}
            <figcaption className="text-center font-mono text-xs text-[var(--ink-2)]">{p.media.caption}</figcaption>
          </figure>
        </div>
      </section>

      {/* Cuerpo blanco con la ficha rapida a la derecha */}
      <div className="bg-white">
        <div className="mx-auto grid max-w-6xl items-start gap-14 px-6 pb-[72px] pt-14 text-base leading-relaxed lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="grid min-w-0 gap-10">
            {p.sections.map((s, i) => (
              <Section key={i} s={s} mailto={mailto} />
            ))}
          </article>
          <aside className="grid gap-3.5 lg:sticky lg:top-24">
            <div className="grid gap-3.5 rounded-[var(--radius-lg)] bg-[var(--lime)] p-[22px]">
              <p className="text-eyebrow text-[var(--ink-2)]">{p.facts.title}</p>
              <dl className="grid gap-2.5">
                {p.facts.rows.map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-2)]">{k}</dt>
                    <dd className="mt-0.5 break-words text-[15px] font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid gap-2.5">{actions}</div>
            </div>
            <p className="font-mono text-xs text-[var(--ink-3)]">{p.disclaimer}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
