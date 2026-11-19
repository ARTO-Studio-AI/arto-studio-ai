import Image from "next/image";
import type { Locale } from "@/i18n/config";
import { formatReviewDate, REVIEW_LABELS, reviewHref, type Review } from "@/lib/revisiones";

/* Tarjeta de una revision publica (Project NOMAD, REA). Marca v2.0: tarjeta blanca sobre lima, boton
 * azul con letra blanca, recuadro con borde negro. Toda la tarjeta lleva a la revision. Sin poster
 * de video (REA), el recuadro es negro con el nombre en lima (lima sobre negro, nunca letra blanca
 * sobre lima). */
export default function ReviewCard({ review, locale }: { review: Review; locale: Locale }) {
  const c = review.copy[locale];
  const l = REVIEW_LABELS[locale];
  return (
    <a
      href={reviewHref(review, locale)}
      className="group grid gap-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-sm)] transition-colors hover:border-black sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:gap-8 sm:p-6"
    >
      {review.poster ? (
        <div className="relative w-full max-w-[140px] overflow-hidden rounded-[var(--radius-md)] border-2 border-black bg-black sm:max-w-none">
          <Image
            src={review.poster.src}
            alt=""
            width={review.poster.w}
            height={review.poster.h}
            className="aspect-[9/16] h-auto w-full object-cover"
            sizes="200px"
          />
          {c.video && (
            <span className="absolute bottom-3 left-3 rounded-full bg-black/80 px-2.5 py-1.5 font-mono text-[11px] text-white">▶ {c.video}</span>
          )}
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full max-w-[200px] flex-col justify-between rounded-[var(--radius-md)] border-2 border-black bg-black p-4 sm:aspect-[9/16] sm:max-w-none">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--lime)]">{l.eyebrow}</span>
          <span className="text-4xl font-extrabold leading-none tracking-tight text-[var(--lime)] sm:text-5xl">{review.name}</span>
          {c.tag && <span className="font-mono text-[11px] text-[var(--lime)]">{c.tag}</span>}
        </div>
      )}
      <div className="grid min-w-0 gap-3.5">
        <p className="text-eyebrow text-[var(--accent-ink)]">
          {l.reviewed} {formatReviewDate(review.reviewedOn, locale)} · {l.version} {review.version}
        </p>
        <h3 className="text-2xl font-extrabold leading-tight sm:text-3xl">{c.title}</h3>
        <p className="max-w-[56ch] text-[15px] text-[var(--ink-2)]">{c.body}</p>
        <p className="max-w-[56ch] border-l-[3px] border-[var(--accent)] pl-3.5 font-semibold text-black">{c.verdict}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-3 text-[15px] font-bold text-white group-hover:bg-[var(--accent-hover)]">
            {c.cta}
          </span>
          <span className="font-mono text-xs text-[var(--ink-2)]">
            {review.author} · {l.notAffiliated}
          </span>
        </div>
      </div>
    </a>
  );
}
