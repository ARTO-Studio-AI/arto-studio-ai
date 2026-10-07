import Image from "next/image";
import type { Locale } from "@/i18n/config";

/* Grafico del hero (propuesta aprobada por Victor el 2026-10-07): explica el producto en
 * tres pasos sin leer nada mas. 1) eliges un prompt, 2) lo pegas en tu IA, 3) lo mides
 * con el Brand Roast. Todo es HTML/CSS, sin imagenes generadas; el personaje es del
 * design system de ARTO. */

const COPY = {
  es: {
    aria: "Cómo funciona en tres pasos",
    s1k: "Elige · BR-0001",
    s1t: "Encontrar la tensión de una marca",
    s1p: "Actúa como estratega de marca. Analiza la categoría de [marca] y encuentra la tensión que ningún competidor está nombrando…",
    s2k: "Pégalo en tu IA",
    s2me: "Pegar prompt BR-0001",
    s2ai: "La categoría habla de frescura; nadie habla de la prisa de la mañana. Ahí está tu tensión…",
    s3k: "Mídelo con el Brand Roast",
    s3free: "Gratis",
    s3q: "“Una home que habla como informe trimestral.”",
    bars: ["Estr.", "Creat.", "Narr.", "Digital"],
  },
  en: {
    aria: "How it works in three steps",
    s1k: "Pick · BR-0001",
    s1t: "Find a brand's tension",
    s1p: "Act as a brand strategist. Analyze [brand]'s category and find the tension no competitor is naming…",
    s2k: "Paste it in your AI",
    s2me: "Paste prompt BR-0001",
    s2ai: "The category talks about freshness; nobody talks about the morning rush. That's your tension…",
    s3k: "Measure it with Brand Roast",
    s3free: "Free",
    s3q: "“A homepage that reads like a quarterly report.”",
    bars: ["Strat.", "Creat.", "Narr.", "Digital"],
  },
} as const;

const BAR_WIDTHS = [50, 50, 40, 50];

export default function HowItWorks({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  return (
    <div
      aria-label={c.aria}
      className="relative mt-10 grid gap-3.5 rounded-[var(--radius-lg)] bg-[var(--paper)] p-5 pt-8 sm:p-6 sm:pt-9 lg:mt-0"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[var(--radius-lg)] [background-image:radial-gradient(rgba(24,24,27,0.10)_1px,transparent_1px)] [background-size:16px_16px]"
      />
      <Image
        src="/brand/characters/character-03.png"
        alt=""
        width={280}
        height={183}
        className="absolute -top-11 right-6 z-10 h-auto w-20 sm:w-24"
        priority
      />

      <Step n={1}>
        <div className="text-eyebrow flex justify-between gap-2 text-zinc-400">
          <span>{c.s1k}</span>
          <span className="rounded-full border border-[#ffd2bf] bg-[var(--accent-soft)] px-2 text-[10px] text-[#b33600]">Free</span>
        </div>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug text-zinc-900">{c.s1t}</p>
        <p className="mt-1.5 text-[13px] leading-snug text-zinc-600">{c.s1p}</p>
      </Step>

      <Step n={2}>
        <div className="text-eyebrow flex justify-between gap-2 text-zinc-400">
          <span>{c.s2k}</span>
          <span className="hidden sm:inline">Claude · ChatGPT</span>
        </div>
        <div className="mt-2 grid gap-2">
          <span className="justify-self-end rounded-xl rounded-br-sm bg-zinc-900 px-3 py-2 font-mono text-xs text-white">{c.s2me}</span>
          <span className="max-w-[92%] rounded-xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-[13px] leading-snug text-zinc-900">{c.s2ai}</span>
        </div>
      </Step>

      <Step n={3}>
        <div className="text-eyebrow flex justify-between gap-2 text-zinc-400">
          <span>{c.s3k}</span>
          <span className="hidden sm:inline">{c.s3free}</span>
        </div>
        <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
          <span className="font-display text-[46px] font-extrabold leading-[0.9] tracking-[-0.04em] text-[var(--warn)] tabular-nums">4.8</span>
          <span className="font-serif text-lg italic leading-tight text-zinc-900">{c.s3q}</span>
          <div className="col-span-2 grid grid-cols-4 gap-2">
            {c.bars.map((label, i) => (
              <div key={label} className="grid gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">{label}</span>
                <span className="block h-[5px] overflow-hidden rounded-full bg-zinc-100">
                  <span className="block h-full bg-[var(--warn)]" style={{ width: `${BAR_WIDTHS[i]}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </Step>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="relative grid grid-cols-[28px_1fr] items-start gap-3">
      <span className="mt-2.5 grid h-7 w-7 place-items-center rounded-full bg-zinc-900 font-mono text-xs text-white">{n}</span>
      <div className="min-w-0 rounded-[var(--radius-md)] border border-zinc-200 bg-white px-4 py-3.5 shadow-[var(--shadow-sm)]">
        {children}
      </div>
    </div>
  );
}
