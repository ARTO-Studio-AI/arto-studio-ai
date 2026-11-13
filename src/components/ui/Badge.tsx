import type { ReactNode } from "react";

/* Badge de la marca ASAI v2.0 (11 nov 2026). El estado lo dice el texto (Live / Soon / Free /
 * Pro), no el color. Letra negra sobre blanco o lima; letra blanca sobre negro y azul.
 *   live     blanco, borde negro, punto azul
 *   soon     lima, borde negro suave
 *   tier     lima, borde negro suave
 *   neutral  lima, sin borde
 *   inverse  negro con letra blanca y punto lima (Pro)
 *   accent   azul con letra blanca */

export type BadgeTone = "live" | "soon" | "tier" | "neutral" | "inverse" | "accent";

const TONES: Record<BadgeTone, { wrap: string; dot: string }> = {
  live: { wrap: "border-black bg-white text-black", dot: "bg-[var(--accent)]" },
  soon: { wrap: "border-black/25 bg-[var(--lime-hover)] text-black", dot: "bg-black/40" },
  tier: { wrap: "border-black/25 bg-[var(--lime)] text-black", dot: "bg-black" },
  neutral: { wrap: "border-transparent bg-[var(--lime-hover)] text-black", dot: "" },
  inverse: { wrap: "border-black bg-black text-white", dot: "bg-[var(--lime)]" },
  accent: { wrap: "border-[var(--accent)] bg-[var(--accent)] text-white", dot: "bg-white" },
};

interface Props {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  mono?: boolean;
  className?: string;
  title?: string;
}

export default function Badge({ children, tone = "neutral", dot, mono = true, className = "", title }: Props) {
  const t = TONES[tone];
  const showDot = dot ?? (tone !== "neutral");
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4 ${mono ? "font-mono uppercase tracking-[0.08em]" : ""} ${t.wrap} ${className}`}
    >
      {showDot && t.dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
