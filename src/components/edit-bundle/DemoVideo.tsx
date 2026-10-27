"use client";

import { useEffect, useRef } from "react";

/* Demo de un skill del ARTO Edit Bundle #1: loop corto, sin audio, vertical 9:16.
 * React no pinta el atributo `muted` en el HTML del servidor, y sin el los navegadores
 * moviles no hacen autoplay; por eso se fuerza en el efecto. Si la demo aun no se
 * sincroniza, se ve el poster o un recuadro neutro con la etiqueta (el build no truena). */

interface Props {
  video: string | null;
  poster: string | null;
  label: string;
  missingLabel: string;
  className?: string;
}

export default function DemoVideo({ video, poster, label, missingLabel, className = "" }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.pause();
      return;
    }
    el.play().catch(() => {
      /* el navegador no dejo reproducir; queda el poster */
    });
  }, [video]);

  const frame = `relative aspect-[9/16] w-full overflow-hidden rounded-[var(--radius-md)] bg-zinc-900 ${className}`;

  if (!video) {
    return (
      <div className={frame} role="img" aria-label={label}>
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-zinc-800 to-zinc-950 p-4 text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-400">{missingLabel}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={frame}>
      <video
        ref={ref}
        src={video}
        poster={poster ?? undefined}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={label}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
