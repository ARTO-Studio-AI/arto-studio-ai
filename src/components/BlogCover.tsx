import type { Locale } from "@/i18n/config";
import { VERTICALS, type Category } from "@/types/prompt";

/* Portadas del blog. Sistema hecho con HTML/SVG, sin imagenes generadas (decision de
 * Victor del 2026-10-07): cada articulo nuevo tiene portada de marca desde el primer dia.
 * Estilo F «Bauhaus geometrico», aprobado el 2026-10-10: formas planas (circulos, medios
 * circulos, bloques y lineas) en tinta, arena y un solo acento, sobre papel. Seis
 * composiciones; cada vertical toma una, y la segunda vertical que repite composicion la
 * usa en espejo. El codigo de la vertical va arriba y la palabra en serif abajo. */

type Comp = 1 | 2 | 3 | 4 | 5 | 6;

const MAP: Record<Category, { c: Comp; mirror?: boolean; es: string; en: string }> = {
  branding: { c: 1, es: "Posicionar.", en: "Position." },
  music: { c: 1, mirror: true, es: "Ritmo.", en: "Rhythm." },
  illustration: { c: 2, es: "Trazo.", en: "Line." },
  graphic_design: { c: 2, mirror: true, es: "Forma.", en: "Form." },
  fashion: { c: 3, es: "Estilo.", en: "Style." },
  ux_ui: { c: 3, mirror: true, es: "Interfaz.", en: "Interface." },
  photography: { c: 4, es: "Mirar.", en: "Look." },
  video: { c: 4, mirror: true, es: "Movimiento.", en: "Motion." },
  copywriting: { c: 5, es: "Voz.", en: "Voice." },
  architecture: { c: 5, mirror: true, es: "Del boceto al plano.", en: "Sketch to plan." },
  marketing: { c: 6, es: "Mercado.", en: "Market." },
  creative_productivity: { c: 6, mirror: true, es: "Antes / después.", en: "Before / after." },
};

const INK = "#18181b";
const SAND = "#e9e3d8";
const ACCENT = "#ff4d00";
const PAPER = "#f4f2ee";

/* Composiciones en una caja de 100 x 100. */
function Shapes({ c }: { c: Comp }) {
  switch (c) {
    case 1: // una fila que se rompe: el que se distingue
      return (
        <>
          <path d="M0 100 A50 50 0 0 1 100 100 Z" fill={SAND} />
          {[6, 18, 30, 42, 82, 94].map((x) => (
            <circle key={x} cx={x} cy={46} r={4.5} fill={INK} />
          ))}
          <circle cx={62} cy={46} r={14} fill={ACCENT} />
          <line x1={0} y1={46} x2={100} y2={46} stroke={INK} strokeWidth={0.6} />
        </>
      );
    case 2: // arco y sol
      return (
        <>
          <rect x={8} y={8} width={84} height={84} fill={SAND} />
          <path d="M14 92 A36 36 0 0 1 86 92 Z" fill={INK} />
          <circle cx={50} cy={34} r={13} fill={ACCENT} />
          {[20, 26, 32].map((x) => (
            <line key={x} x1={x} y1={8} x2={x} y2={40} stroke={INK} strokeWidth={0.8} />
          ))}
        </>
      );
    case 3: // bloques y cuarto de circulo
      return (
        <>
          <rect x={44} y={4} width={52} height={52} fill={INK} />
          <rect x={4} y={56} width={60} height={40} fill={SAND} />
          <path d="M44 56 L44 26 A30 30 0 0 0 14 56 Z" fill={ACCENT} />
          <circle cx={70} cy={30} r={12} fill={PAPER} />
          <line x1={4} y1={96} x2={96} y2={96} stroke={INK} strokeWidth={0.8} />
        </>
      );
    case 4: // lente y luna
      return (
        <>
          <circle cx={48} cy={52} r={40} fill={SAND} />
          <circle cx={62} cy={44} r={34} fill={PAPER} />
          <circle cx={82} cy={78} r={10} fill={ACCENT} />
          <path d="M8 52 A40 40 0 0 1 48 12 L48 52 Z" fill={INK} />
          {[88, 92, 96].map((x) => (
            <line key={x} x1={x} y1={4} x2={x} y2={40} stroke={INK} strokeWidth={0.8} />
          ))}
        </>
      );
    case 5: // escalera de bloques
      return (
        <>
          <rect x={56} y={74} width={40} height={20} fill={INK} />
          <rect x={36} y={54} width={60} height={20} fill={SAND} />
          <rect x={16} y={34} width={80} height={20} fill={INK} />
          <circle cx={26} cy={20} r={11} fill={ACCENT} />
          <line x1={4} y1={94} x2={96} y2={94} stroke={INK} strokeWidth={0.8} />
        </>
      );
    default: // rejilla con un punto distinto
      return (
        <>
          <rect x={4} y={4} width={92} height={92} fill={SAND} />
          {[0, 1, 2].flatMap((r) =>
            [0, 1, 2].map((k) =>
              r === 1 && k === 2 ? (
                <circle key={`${r}${k}`} cx={78} cy={50} r={12} fill={ACCENT} />
              ) : (
                <rect key={`${r}${k}`} x={14 + k * 28} y={14 + r * 28} width={16} height={16} fill={INK} />
              ),
            ),
          )}
          <path d="M4 96 A20 20 0 0 1 44 96 Z" fill={PAPER} />
        </>
      );
  }
}

interface Props {
  category: Category | null | undefined;
  locale: Locale;
  /** "card" para listados (16:10) o "hero" para la cabecera del articulo (21:9). */
  size?: "card" | "hero";
  className?: string;
}

export default function BlogCover({ category, locale, size = "card", className = "" }: Props) {
  const cat: Category = category && MAP[category] ? category : "creative_productivity";
  const m = MAP[cat];
  const vert = VERTICALS[cat];
  const label = `${locale === "es" ? vert.label_es : vert.label_en} · ${vert.code}`;
  const word = locale === "es" ? m.es : m.en;
  // Las palabras largas («Del boceto al plano.») bajan de tamano para no cortarse en tarjetas.
  const wordSize = word.length > 12 ? "text-[clamp(22px,2.6vw,30px)]" : "text-[clamp(28px,4vw,44px)]";
  const ratio = size === "hero" ? "aspect-[21/9]" : "aspect-[16/10]";

  return (
    <div className={`relative w-full overflow-hidden bg-[var(--paper)] ${ratio} ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        className="absolute right-[5%] top-[9%] h-[64%] w-auto"
        style={m.mirror ? { transform: "scaleX(-1)" } : undefined}
      >
        <Shapes c={m.c} />
      </svg>
      <span className="text-eyebrow absolute left-4 top-3.5 text-zinc-600">{label}</span>
      <span className={`absolute bottom-3 left-4 font-serif ${wordSize} font-semibold italic leading-none tracking-[-0.01em] text-zinc-900`}>
        {word}
      </span>
    </div>
  );
}
