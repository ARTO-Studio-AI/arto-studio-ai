import { DIFFICULTY_STYLES, type Difficulty } from "@/types/prompt";

/* Chip de dificultad: el nivel lo dicen 1 a 4 puntos. Sobre lima, puntos negros; el nivel
 * experto va en negro con puntos lima (nunca azul sobre negro). */
export default function DifficultyChip({ level, label }: { level: Difficulty; label: string }) {
  const d = DIFFICULTY_STYLES[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${d.chip}`} title={label}>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i <= d.dots ? (level === "expert" ? "bg-[var(--lime)]" : "bg-black") : level === "expert" ? "bg-white/35" : "bg-black/20"}`}
          />
        ))}
      </span>
      {label}
    </span>
  );
}
