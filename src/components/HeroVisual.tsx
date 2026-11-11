import Link from "next/link";
import { HERO_VIDEO_POSTER, HERO_VIDEO_SRC } from "@/lib/hero-video";
import { buttonClass } from "@/components/ui";

/* Columna derecha del hero (marca ASAI v2.0, 11 nov 2026). Panel negro con el corredor lima y,
 * encima, la tarjeta azul del prompt del dia. Cuando HERO_VIDEO_SRC tenga un archivo, el panel
 * muestra el video en loop (sin audio) en lugar del corredor; con prefers-reduced-motion se
 * queda el poster. Reglas de color: sobre negro, letra blanca y acentos lima; sobre azul, letra
 * blanca y boton blanco con letra negra. */

export interface HeroPrompt {
  id: string;
  code: string;
  category: string;
  title: string;
  body: string;
  href: string;
  /** Segundo boton: el catalogo completo. */
  catalogHref: string;
}

interface Props {
  prompt: HeroPrompt;
  labels: { badge: string; eyebrow: string; copy: string; view: string };
}

export default function HeroVisual({ prompt, labels }: Props) {
  return (
    <div className="relative min-w-0 pb-36 sm:pb-28">
      <div className="asai-dark relative flex min-h-[340px] flex-col gap-4 overflow-hidden rounded-[24px] bg-black p-7 text-white sm:min-h-[420px] sm:p-9">
        <div className="relative z-10 flex items-start justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--lime)] bg-black px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime)]" aria-hidden="true" />
            {labels.badge}
          </span>
          <span className="font-mono text-xs text-[var(--lime)]">
            {prompt.code} · {prompt.category}
          </span>
        </div>
        {HERO_VIDEO_SRC ? (
          <video
            className="hero-video absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={HERO_VIDEO_POSTER}
            aria-hidden="true"
          >
            <source src={HERO_VIDEO_SRC} type="video/mp4" />
          </video>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG del corredor, sin optimizar */}
        <img
          src={HERO_VIDEO_POSTER}
          alt=""
          aria-hidden="true"
          width={210}
          height={209}
          className={`${HERO_VIDEO_SRC ? "hero-poster hidden" : ""} relative z-10 mr-2 h-auto w-36 self-end sm:w-48`}
        />
      </div>
      <div className="absolute bottom-0 left-4 right-4 z-20 flex flex-col gap-3 rounded-[var(--radius-lg)] bg-[var(--accent)] p-6 text-white shadow-[0_18px_50px_rgba(0,0,0,0.25)] sm:left-[-1.5rem] sm:right-10 lg:left-[-4rem]">
        <p className="text-eyebrow text-white">{labels.eyebrow}</p>
        <p className="font-display text-xl font-extrabold leading-tight tracking-[-0.02em] text-white">{prompt.title}</p>
        <p className="line-clamp-3 text-[15px] leading-snug text-white">{prompt.body}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={prompt.href} className={buttonClass("white", "sm")}>
            {labels.copy}
          </Link>
          <Link
            href={prompt.catalogHref}
            className="inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-white/60 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            {labels.view}
          </Link>
        </div>
      </div>
    </div>
  );
}
