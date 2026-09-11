import { DIFFICULTY_STYLES, type Difficulty } from "@/types/prompt";

/* Chip de dificultad monocromo: el nivel lo dicen 1 a 4 puntos, el activo en acento. */
export default function DifficultyChip({ level, label }: { level: Difficulty; label: string }) {
  const d = DIFFICULTY_STYLES[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${d.chip}`} title={label}>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i <= d.dots ? (level === "expert" ? "bg-[var(--accent)]" : "bg-zinc-700") : level === "expert" ? "bg-zinc-600" : "bg-zinc-300"}`}
          />
        ))}
      </span>
      {label}
    </span>
  );
}
