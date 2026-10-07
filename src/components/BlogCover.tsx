import Image from "next/image";
import type { Locale } from "@/i18n/config";
import { VERTICALS, type Category } from "@/types/prompt";

/* Portadas del blog (propuesta aprobada por Victor el 2026-10-07). Sustituyen las
 * imagenes generadas: un solo sistema grafico, hecho con HTML/CSS y los personajes del
 * design system de ARTO, en cuatro variantes que salen de la vertical del articulo.
 * Asi cada articulo nuevo tiene portada de marca desde el primer dia, sin generar nada.
 *   A personaje + palabra en serif · B diagrama del metodo sobre negro
 *   C codigo de la vertical en grande sobre acento · D mini interfaz antes/despues */

type Variant = "A" | "B" | "C" | "D";

const MAP: Record<Category, { v: Variant; es: string; en: string; char?: string }> = {
  branding: { v: "A", es: "Posicionar.", en: "Position.", char: "character-02" },
  photography: { v: "A", es: "Mirar.", en: "Look.", char: "character-04" },
  illustration: { v: "A", es: "Trazo.", en: "Line.", char: "character-05" },
  fashion: { v: "A", es: "Estilo.", en: "Style.", char: "character-01" },
  copywriting: { v: "B", es: "Voz.", en: "Voice." },
  marketing: { v: "B", es: "Mercado.", en: "Market." },
  ux_ui: { v: "C", es: "", en: "", char: "character-05" },
  graphic_design: { v: "C", es: "", en: "", char: "character-03" },
  video: { v: "C", es: "", en: "", char: "character-04" },
  music: { v: "C", es: "", en: "", char: "character-02" },
  creative_productivity: { v: "D", es: "Antes / después.", en: "Before / after." },
  architecture: { v: "D", es: "Del boceto al plano.", en: "Sketch to plan." },
};

const CHAR_SIZE: Record<string, [number, number]> = {
  "character-01": [290, 273],
  "character-02": [439, 273],
  "character-03": [280, 183],
  "character-04": [267, 273],
  "character-05": [267, 273],
};

function charSrc(name: string): string {
  return name === "character-01" ? "/brand/arto-character-01.png" : `/brand/characters/${name}.png`;
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
  const ratio = size === "hero" ? "aspect-[21/9]" : "aspect-[16/10]";
  const base = `relative w-full overflow-hidden ${ratio} ${className}`;
  const codeCls = "text-eyebrow absolute left-4 top-3.5";
  const wordCls = "absolute bottom-3 left-4 font-serif text-[clamp(28px,4vw,44px)] font-semibold italic leading-none tracking-[-0.01em]";
  const ch = m.char;
  const [w, h] = ch ? CHAR_SIZE[ch] : [0, 0];

  if (m.v === "A") {
    return (
      <div className={`${base} bg-[var(--paper)]`} aria-hidden="true">
        <span className="absolute inset-x-0 top-1/2 h-px bg-zinc-900/10" />
        <span className={`${codeCls} text-zinc-600`}>{label}</span>
        <span className={`${wordCls} text-zinc-900`}>{word}</span>
        {ch && <Image src={charSrc(ch)} alt="" width={w} height={h} className="absolute bottom-3.5 right-3.5 h-auto w-[40%] max-w-[220px]" />}
      </div>
    );
  }

  if (m.v === "B") {
    return (
      <div className={`${base} bg-zinc-900 text-white`} aria-hidden="true">
        <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <g fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1">
            <circle cx="232" cy="88" r="46" />
            <circle cx="232" cy="88" r="28" />
            <line x1="150" y1="88" x2="320" y2="88" />
            <line x1="232" y1="10" x2="232" y2="170" />
          </g>
          <circle cx="232" cy="88" r="10" fill="#ff4d00" />
          <g fontFamily="var(--font-brand-meta), sans-serif" fontSize="8" fill="#a1a1aa" letterSpacing="1.5">
            <text x="244" y="40">{locale === "es" ? "ESTRATEGIA" : "STRATEGY"}</text>
            <text x="244" y="150">{locale === "es" ? "NARRATIVA" : "NARRATIVE"}</text>
            <text x="276" y="84">DIGITAL</text>
          </g>
        </svg>
        <span className={`${codeCls} text-zinc-400`}>{label}</span>
        <span className={`${wordCls} text-white`}>{word}</span>
      </div>
    );
  }

  if (m.v === "C") {
    return (
      <div className={`${base} bg-[var(--accent)]`} aria-hidden="true">
        <span className={`${codeCls} text-zinc-900`}>{label}</span>
        <span className="absolute -bottom-6 -right-1.5 font-display text-[clamp(110px,16vw,170px)] font-extrabold leading-none tracking-[-0.06em] text-white/90">
          {vert.code}
        </span>
        {ch && <Image src={charSrc(ch)} alt="" width={w} height={h} className="absolute bottom-4 left-4 h-auto w-[26%] max-w-[140px]" />}
      </div>
    );
  }

  return (
    <div className={`${base} bg-[var(--sand)]`} aria-hidden="true">
      <span className={`${codeCls} text-zinc-600`}>{label}</span>
      <div className="absolute right-3.5 top-9 grid w-[58%] gap-1.5">
        {[80, 64].map((pct) => (
          <span key={`x${pct}`} className="relative block h-2 rounded bg-zinc-900/15" style={{ width: `${pct}%` }}>
            <span className="absolute -inset-x-[4%] top-1/2 h-0.5 -rotate-3 bg-[var(--accent)]" />
          </span>
        ))}
        {[88, 56].map((pct) => (
          <span key={`ok${pct}`} className="block h-2 rounded bg-zinc-900" style={{ width: `${pct}%` }} />
        ))}
      </div>
      <span className={`${wordCls} text-zinc-900`}>{word}</span>
    </div>
  );
}
