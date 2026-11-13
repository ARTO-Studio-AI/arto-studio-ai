/* Portada de tutorial (2026-11-05). Mismo sistema que BlogCover (Bauhaus geometrico, negro, lima
 * y un solo acento azul sobre blanco), con una composicion propia: una escalera con un bloque por paso
 * que termina en el punto de acento, el resultado. El codigo del tutorial va arriba y la palabra
 * en serif abajo. Sin imagenes generadas. */

const INK = "#000000";
const SAND = "#daf700"; // lima (marca v2.0)
const ACCENT = "#1e00ff"; // azul ultramar

interface Props {
  code: string;
  word: string;
  steps: number;
  /** "card" para listados (16:10) o "hero" para la cabecera del tutorial (21:9). */
  size?: "card" | "hero";
  className?: string;
}

export default function TutorialCover({ code, word, steps, size = "card", className = "" }: Props) {
  const n = Math.min(Math.max(steps, 2), 8);
  const w = 84 / n;
  const h = 64 / n;
  const ratio = size === "hero" ? "aspect-[21/9]" : "aspect-[16/10]";
  const wordSize = word.length > 10 ? "text-[clamp(24px,3vw,34px)]" : "text-[clamp(28px,4vw,44px)]";
  const label = `Tutorial · ${code}`;

  return (
    <div className={`relative w-full overflow-hidden bg-white ${ratio} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="absolute right-[5%] top-[9%] h-[64%] w-auto">
        <circle cx={24} cy={32} r={20} fill={SAND} />
        {Array.from({ length: n }, (_, i) => (
          <rect
            key={i}
            x={8 + i * w}
            y={92 - (i + 1) * h}
            width={w - 1.5}
            height={(i + 1) * h}
            fill={i % 2 === 0 ? INK : SAND}
          />
        ))}
        <circle cx={8 + (n - 1) * w + (w - 1.5) / 2} cy={92 - n * h - 11} r={8} fill={ACCENT} />
        <line x1={4} y1={92} x2={96} y2={92} stroke={INK} strokeWidth={0.8} />
      </svg>
      <span className="text-eyebrow absolute left-4 top-3.5 text-zinc-600">{label}</span>
      <span className={`absolute bottom-3 left-4 font-serif ${wordSize} font-semibold italic leading-none tracking-[-0.01em] text-zinc-900`}>
        {word}
      </span>
    </div>
  );
}
