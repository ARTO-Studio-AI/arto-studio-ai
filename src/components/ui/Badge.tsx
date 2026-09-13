import type { ReactNode } from "react";

/* Badge monocromo con punto de acento. Sin familias de color: el estado
 * lo dice el texto (Live / Soon / Free / Pro), no el verde o el ambar. */

export type BadgeTone = "live" | "soon" | "tier" | "neutral" | "inverse";

const TONES: Record<BadgeTone, { wrap: string; dot: string }> = {
  live: { wrap: "border-zinc-300 bg-white text-zinc-900", dot: "bg-[var(--accent)]" },
  soon: { wrap: "border-zinc-200 bg-zinc-50 text-zinc-500", dot: "bg-zinc-300" },
  tier: { wrap: "border-zinc-200 bg-zinc-100 text-zinc-700", dot: "bg-zinc-400" },
  neutral: { wrap: "border-transparent bg-zinc-100 text-zinc-600", dot: "" },
  inverse: { wrap: "border-zinc-900 bg-zinc-900 text-white", dot: "bg-[var(--accent)]" },
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
