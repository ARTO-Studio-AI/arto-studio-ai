"use client";

import { useState, useEffect, Suspense, Component, type ErrorInfo, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { RoastLang, RoastResult } from "@/lib/roast-types";
import { track } from "@/lib/analytics";

/* Brand Roast v2 (2026-10-06)
 * - Bilingue: espanol por defecto, ingles con ?lang=en o por el navegador.
 * - Nunca muestra un roast de plantilla. Antes, si el API fallaba (504 con cualquier
 *   URL), la pagina inventaba un roast con frases al azar y lo presentaba como
 *   analisis; lo mismo en los enlaces compartidos y en el historial. Ahora hay un
 *   estado de error con reintento, el enlace compartido solo muestra calificaciones
 *   y el historial vuelve a llenar el formulario.
 * - Muestra la frase de cabecera y la evidencia que trae el v2 del API. */

type Lang = RoastLang;

const T = {
  es: {
    nav_work: "Trabajo",
    nav_prompts: "Prompts",
    nav_pricing: "Precios",
    nav_cta: "Prompts gratis",
    eyebrow: "Herramienta gratuita de ARTO Studio AI",
    h1: "Brand Roast",
    hero: "Un análisis honesto de tu marca, calificado en Estrategia, Creatividad, Narrativa y Digital, con la metodología con la que ARTO trabaja marcas desde 2009.",
    hero_sub: "Sin rodeos. Sin consejos genéricos. Leemos tu sitio y te decimos lo que nadie se atreve.",
    form_h2: "Cuéntanos de tu marca",
    form_sub: "Entre más contexto, más afilado el roast. Con la URL leemos tu sitio real.",
    brand: "Nombre de la marca *",
    brand_ph: "p. ej. Panadería La Espiga",
    url: "Sitio web",
    url_hint: "(recomendado: lo leemos de verdad)",
    url_ph: "tumarca.com",
    industry: "Sector *",
    industry_ph: "Elige tu sector",
    size: "Tamaño",
    size_ph: "Elige el tamaño",
    desc: "Describe tu marca en pocas líneas",
    desc_ph: "¿Qué hace tu marca? ¿Para quién? ¿Qué te hace distinto (o no)?",
    submit: "Roastea mi marca",
    disclaimer: "Gratis. Sin registro. Es una opinión estratégica, no una auditoría formal.",
    history: "Roasts anteriores",
    history_hint: "Toca uno para volver a correrlo.",
    analyzing: "Analizando",
    stages_url: ["Leyendo tu sitio...", "Revisando el posicionamiento...", "Evaluando la dirección creativa...", "Escuchando tu narrativa...", "Auditando lo digital...", "Calculando el ARTO Score..."],
    stages_nourl: ["Revisando el posicionamiento...", "Evaluando la dirección creativa...", "Escuchando tu narrativa...", "Auditando lo digital...", "Calculando el ARTO Score..."],
    wait_note: "Tarda unos 20 segundos. Vale la pena.",
    err_title: "No pudimos terminar tu roast",
    err_body: "El análisis falló de nuestro lado. Inténtalo de nuevo en unos segundos.",
    err_rate: "Llegaste al límite de roasts por hora. Vuelve en un rato.",
    err_retry: "Intentar de nuevo",
    err_back: "Editar datos",
    score_for: "ARTO Score de",
    weighted: "Ponderado: Estrategia 30% + Creatividad 25% + Narrativa 25% + Digital 20%",
    pillars: { strategy: "Estrategia", creativity: "Creatividad", narrative: "Narrativa", digital: "Digital" },
    share_label: "Comparte tu roast",
    copy: "Copiar enlace",
    copied: "¡Copiado!",
    download: "Descarga la imagen para Instagram",
    share_text: (b: string, s: number) => `Mi marca "${b}" sacó ${s}/10 en el Brand Roast de ARTO. ¿La tuya lo hace mejor?`,
    gate_h: "Desbloquea el reporte completo",
    gate_body: "Déjanos tu correo para ver el análisis por pilar, el veredicto, la evidencia y por dónde empezar.",
    gate_ph: "tu@empresa.com",
    gate_btn: "Ver reporte completo",
    gate_err: "Escribe un correo válido.",
    gate_note: "Cero spam. Te podemos mandar ideas de marca y novedades de ARTO.",
    verdict: "El veredicto",
    evidence: "En qué nos basamos",
    start: "Por dónde empezar",
    site_note: "Leímos tu sitio para este análisis.",
    shared_note: "Así le fue a esta marca. El análisis completo solo lo ve quien la roasteó.",
    cta_shared_h: "¿Tu marca lo hace mejor?",
    cta_shared_body: "Haz tu propio roast gratis: leemos tu sitio y lo calificamos con la metodología real de ARTO.",
    cta_shared_btn: "Roastea mi marca",
    cta_h: "¿Y ahora qué?",
    cta_body: "Empieza hoy con más de 3,000 prompts de marca y marketing hechos por estrategas de ARTO. Si prefieres que lo arreglemos contigo, escríbenos.",
    cta_prompts: "Explorar prompts gratis",
    cta_contact: "Hablar con ARTO",
    cta_again: "Roastear otra marca",
    contact_subject: "Brand Roast: quiero mejorar mi marca",
    footer: "Un producto de ARTO Group. Diseño, cultura y tecnología desde 2009.",
    crash_h: "Algo salió mal",
    crash_btn: "Intentar de nuevo",
  },
  en: {
    nav_work: "Work",
    nav_prompts: "Prompts",
    nav_pricing: "Pricing",
    nav_cta: "Free prompts",
    eyebrow: "Free tool by ARTO Studio AI",
    h1: "Brand Roast",
    hero: "An honest analysis of your brand, scored across Strategy, Creativity, Narrative and Digital, with the methodology ARTO has used on brands since 2009.",
    hero_sub: "No sugarcoating. No generic advice. We read your site and tell you what nobody else will.",
    form_h2: "Tell us about your brand",
    form_sub: "The more context, the sharper the roast. With the URL we read your actual site.",
    brand: "Brand name *",
    brand_ph: "e.g. Acme Coffee",
    url: "Website",
    url_hint: "(recommended: we actually read it)",
    url_ph: "yourbrand.com",
    industry: "Industry *",
    industry_ph: "Select your industry",
    size: "Company size",
    size_ph: "Select size",
    desc: "Describe your brand in a few lines",
    desc_ph: "What does your brand do? Who is it for? What makes you different (or not)?",
    submit: "Roast my brand",
    disclaimer: "Free. No signup. A strategic opinion, not a formal audit.",
    history: "Previous roasts",
    history_hint: "Tap one to run it again.",
    analyzing: "Analyzing",
    stages_url: ["Reading your website...", "Scanning brand positioning...", "Evaluating creative direction...", "Listening to your narrative...", "Auditing digital presence...", "Calculating ARTO Score..."],
    stages_nourl: ["Scanning brand positioning...", "Evaluating creative direction...", "Listening to your narrative...", "Auditing digital presence...", "Calculating ARTO Score..."],
    wait_note: "It takes about 20 seconds. Worth it.",
    err_title: "We couldn't finish your roast",
    err_body: "The analysis failed on our side. Please try again in a few seconds.",
    err_rate: "You've hit the hourly roast limit. Come back in a bit.",
    err_retry: "Try again",
    err_back: "Edit details",
    score_for: "ARTO Score for",
    weighted: "Weighted: Strategy 30% + Creativity 25% + Narrative 25% + Digital 20%",
    pillars: { strategy: "Strategy", creativity: "Creativity", narrative: "Narrative", digital: "Digital" },
    share_label: "Share your roast",
    copy: "Copy link",
    copied: "Copied!",
    download: "Download image for Instagram",
    share_text: (b: string, s: number) => `My brand "${b}" scored ${s}/10 on ARTO's Brand Roast. Think yours can do better?`,
    gate_h: "Unlock your full report",
    gate_body: "Enter your email to see the breakdown by pillar, the verdict, the evidence and where to start.",
    gate_ph: "you@company.com",
    gate_btn: "Unlock full report",
    gate_err: "Please enter a valid email address.",
    gate_note: "No spam. We may send you branding ideas and ARTO updates.",
    verdict: "The verdict",
    evidence: "What we based it on",
    start: "Where to start",
    site_note: "We read your website for this analysis.",
    shared_note: "Here's how this brand scored. Only whoever ran the roast sees the full analysis.",
    cta_shared_h: "Think your brand can do better?",
    cta_shared_body: "Get your own free roast: we read your site and score it with ARTO's real methodology.",
    cta_shared_btn: "Roast my brand",
    cta_h: "Now what?",
    cta_body: "Start today with 3,000+ brand and marketing prompts written by ARTO strategists. If you'd rather fix it with us, get in touch.",
    cta_prompts: "Browse free prompts",
    cta_contact: "Talk to ARTO",
    cta_again: "Roast another brand",
    contact_subject: "Brand Roast: I want to improve my brand",
    footer: "A product by ARTO Group. Design, Culture & Technology since 2009.",
    crash_h: "Something went wrong",
    crash_btn: "Try again",
  },
} as const;

type Dict = (typeof T)[Lang];

/* Los valores se mandan al modelo tal cual (en ingles); solo cambia la etiqueta. */
const INDUSTRIES: Array<{ group: [string, string]; items: Array<[string, string, string]> }> = [
  {
    group: ["Tecnología", "Technology"],
    items: [
      ["SaaS / B2B Software", "SaaS / Software B2B", "SaaS / B2B Software"],
      ["Consumer Tech", "Tecnología de consumo / Apps", "Consumer Tech / Apps"],
      ["Fintech", "Fintech", "Fintech"],
      ["Healthtech", "Healthtech / MedTech", "Healthtech / MedTech"],
      ["Edtech", "Edtech", "Edtech"],
      ["Proptech", "Proptech", "Proptech"],
      ["AI / Data", "IA / Datos", "AI / Data"],
    ],
  },
  {
    group: ["Consumo y retail", "Consumer & Retail"],
    items: [
      ["E-commerce", "E-commerce / Retail", "E-commerce / Retail"],
      ["Fashion & Beauty", "Moda y belleza", "Fashion & Beauty"],
      ["Food & Beverage", "Alimentos y bebidas", "Food & Beverage"],
      ["Restaurants", "Restaurantes y cafeterías", "Restaurants & Cafés"],
      ["CPG", "Consumo masivo", "CPG / Consumer Goods"],
      ["Luxury", "Lujo y premium", "Luxury & Premium"],
    ],
  },
  {
    group: ["Servicios", "Services"],
    items: [
      ["Agency", "Agencia / Servicios creativos", "Agency / Creative Services"],
      ["Professional Services", "Servicios profesionales", "Professional Services"],
      ["Legal", "Legal / Consultoría", "Legal / Consulting"],
      ["Finance", "Finanzas / Inversión", "Finance / Investment"],
      ["Real Estate", "Bienes raíces / Arquitectura", "Real Estate / Architecture"],
      ["Education", "Educación / Capacitación", "Education / Training"],
      ["Health & Wellness", "Salud y bienestar", "Health & Wellness"],
      ["Travel & Hospitality", "Turismo y hospitalidad", "Travel & Hospitality"],
    ],
  },
  {
    group: ["Industria", "Industry"],
    items: [
      ["Manufacturing", "Manufactura / Industrial", "Manufacturing / Industrial"],
      ["Automotive", "Automotriz", "Automotive"],
      ["Energy", "Energía / Sustentabilidad", "Energy / Sustainability"],
      ["Construction", "Construcción / Ingeniería", "Construction / Engineering"],
      ["Logistics", "Logística", "Logistics / Supply Chain"],
    ],
  },
  {
    group: ["Medios y cultura", "Media & Culture"],
    items: [
      ["Entertainment", "Entretenimiento / Medios", "Entertainment / Media"],
      ["Sports & Fitness", "Deporte y fitness", "Sports & Fitness"],
      ["Arts & Culture", "Arte, cultura y diseño", "Arts, Culture & Design"],
      ["NGO / Social Impact", "ONG / Impacto social", "NGO / Social Impact"],
      ["Politics & Public Sector", "Política / Sector público", "Politics & Public Sector"],
    ],
  },
];

function industryLabel(value: string, lang: Lang): string {
  for (const g of INDUSTRIES) {
    const hit = g.items.find(([v]) => v === value);
    if (hit) return lang === "es" ? hit[1] : hit[2];
  }
  return value === "Other" && lang === "es" ? "Otro" : value;
}

const SIZES: Array<[string, string, string]> = [
  ["solo", "Solo / Freelance (1)", "Solo / Freelancer (1)"],
  ["micro", "Micro (2 a 10 personas)", "Micro (2–10 people)"],
  ["small", "Pequeña (11 a 50)", "Small (11–50 people)"],
  ["medium", "Mediana (51 a 200)", "Mid-size (51–200 people)"],
  ["large", "Grande (201 a 1,000)", "Large (201–1,000 people)"],
  ["enterprise", "Corporativo (1,000+)", "Enterprise (1,000+)"],
];

/* ── Normalizador defensivo ───────────────────────────────
 * El v2 del API ya valida la salida en el servidor; esto solo protege la UI de
 * clientes viejos o cache. Nunca rellena texto inventado: si falta algo esencial,
 * regresa null y la pagina muestra el estado de error. */
function normalizeRoastResult(raw: unknown): RoastResult | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pillar = (name: string) => {
    const p = (r[name] ?? {}) as { score?: unknown; roast?: unknown };
    if (typeof p.score !== "number" || !Number.isFinite(p.score)) return null;
    return { score: p.score, roast: typeof p.roast === "string" ? p.roast : "" };
  };
  const strategy = pillar("strategy");
  const creativity = pillar("creativity");
  const narrative = pillar("narrative");
  const digital = pillar("digital");
  if (!strategy || !creativity || !narrative || !digital) return null;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
  const overall =
    typeof r.overall === "number" && Number.isFinite(r.overall)
      ? r.overall
      : Math.round((strategy.score * 0.3 + creativity.score * 0.25 + narrative.score * 0.25 + digital.score * 0.2) * 10) / 10;
  return {
    strategy,
    creativity,
    narrative,
    digital,
    overall,
    verdict: typeof r.verdict === "string" ? r.verdict : "",
    improvements: strings(r.improvements),
    headline: typeof r.headline === "string" ? r.headline : undefined,
    evidence: strings(r.evidence),
  };
}

/* ── Animated counter hook ───────────────────────────── */

function useCountUp(target: number, duration = 1200) {
  // Antes se marcaba "ya empezo" en el primer render, cuando ScoreBar todavia pasa 0
  // (aun no es visible): al llegar el score real ya no animaba y el pilar se quedaba
  // en 0/10. Ahora anima cada vez que cambia el objetivo.
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    let frame = 0;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target * 10) / 10);
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return target === 0 ? 0 : value;
}

/* ── Score bar component (animated) ──────────────────── */

function ScoreBar({ label, score, roast, delay = 0 }: { label: string; score: number; roast?: string; delay?: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-amber-500" : "bg-red-500";
  const [visible, setVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const displayScore = useCountUp(visible ? score : 0);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delay);
    const t2 = setTimeout(() => setBarWidth(pct), delay + 100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [delay, pct]);

  return (
    <div
      className={`rounded-xl border border-border bg-white p-6 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest">{label}</h3>
        <span className="text-2xl font-bold tracking-tight">{displayScore}/10</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {roast && <p className="mt-4 text-sm leading-relaxed text-muted">{roast}</p>}
    </div>
  );
}

/* ── Overall score display (animated) ────────────────── */

function OverallScoreDisplay({ score }: { score: number }) {
  const animated = useCountUp(score, 1500);
  const color = score >= 7 ? "text-emerald-500" : score >= 5 ? "text-amber-500" : "text-red-500";

  return (
    <div className="mt-6 inline-flex items-baseline gap-1">
      <span className={`text-7xl font-bold tracking-tight ${color}`}>{animated}</span>
      <span className="text-2xl font-bold text-zinc-300">/10</span>
    </div>
  );
}

/* ── History ─────────────────────────────────────────── */

interface RoastHistoryEntry {
  brandName: string;
  industry: string;
  websiteUrl?: string;
  overall: number;
  date: string;
  s: number;
  c: number;
  n: number;
  d: number;
}

const HISTORY_KEY = "arto_roast_history";
const LANG_KEY = "arto_roast_lang";

function loadHistory(): RoastHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RoastHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveToHistory(entry: RoastHistoryEntry): RoastHistoryEntry[] {
  const history = loadHistory();
  const filtered = history.filter((h) => !(h.brandName === entry.brandName && h.industry === entry.industry));
  const updated = [entry, ...filtered].slice(0, 20);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* almacenamiento bloqueado: el historial es una comodidad */
  }
  return updated;
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignorar */
  }
}

/* ── Share helpers ───────────────────────────────────── */

function buildShareUrl(brand: string, result: RoastResult, lang: Lang): string {
  const params = new URLSearchParams({
    brand,
    score: String(result.overall),
    s: String(result.strategy.score),
    c: String(result.creativity.score),
    n: String(result.narrative.score),
    d: String(result.digital.score),
    lang,
  });
  return `${window.location.origin}/roast?${params.toString()}`;
}

/* El enlace compartido solo trae calificaciones. No se inventa ningun texto de
 * analisis, y no lleva la frase de cabecera: sin firma, cualquiera podria fabricar
 * un enlace con una frase ofensiva bajo la marca de ARTO (auditoria de Fable). */
function parseSharedResult(params: URLSearchParams): { brand: string; result: RoastResult } | null {
  const brand = params.get("brand");
  const nums = ["score", "s", "c", "n", "d"].map((k) => params.get(k));
  if (!brand || nums.some((v) => v === null)) return null;
  const [overall, s, c, n, d] = nums.map(Number);
  if ([overall, s, c, n, d].some((v) => isNaN(v) || v < 0 || v > 10)) return null;
  return {
    brand: brand.slice(0, 100),
    result: {
      overall,
      strategy: { score: s, roast: "" },
      creativity: { score: c, roast: "" },
      narrative: { score: n, roast: "" },
      digital: { score: d, roast: "" },
      verdict: "",
      improvements: [],
    },
  };
}

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

type ShareChannel = "x" | "linkedin" | "whatsapp" | "copy_link" | "download_square" | "download_story";

function SocialSharePanel({ brand, result, lang, t }: { brand: string; result: RoastResult; lang: Lang; t: Dict }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = buildShareUrl(brand, result, lang);
  const shareText = result.headline ? `${t.share_text(brand, result.overall)} "${result.headline}"` : t.share_text(brand, result.overall);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const shared = (channel: ShareChannel) => track("roast_shared", { channel, overall: result.overall });

  async function copyLink() {
    shared("copy_link");
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const socials: { label: string; channel: ShareChannel; color: string; href: string; icon: ReactNode }[] = [
    {
      label: "X / Twitter",
      channel: "x",
      color: "hover:bg-black hover:text-white hover:border-black",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: "LinkedIn",
      channel: "linkedin",
      color: "hover:bg-[#0077b5] hover:text-white hover:border-[#0077b5]",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
    {
      label: "WhatsApp",
      channel: "whatsapp",
      color: "hover:bg-[#25d366] hover:text-white hover:border-[#25d366]",
      href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      ),
    },
  ];

  const ogBase = `/roast/og?brand=${encodeURIComponent(brand)}&score=${result.overall}&s=${result.strategy.score}&c=${result.creativity.score}&n=${result.narrative.score}&d=${result.digital.score}`;

  return (
    <div className="mt-6 flex flex-col items-center gap-4">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">{t.share_label}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => shared(s.channel)}
            className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors ${s.color}`}
          >
            {s.icon}
            {s.label}
          </a>
        ))}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100"
        >
          {copied ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              {t.copied}
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="13" height="13" x="9" y="9" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {t.copy}
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <p className="w-full text-center text-xs text-zinc-400">{t.download}</p>
        {(
          [
            ["download_square", "square", "Feed 1:1"],
            ["download_story", "story", "Story 9:16"],
          ] as const
        ).map(([channel, format, label]) => (
          <button
            key={format}
            type="button"
            onClick={() => {
              shared(channel);
              downloadImage(`${ogBase}&format=${format}`, `roast-${brand}-${format}.png`);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium transition-colors hover:bg-zinc-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Inner component (uses useSearchParams) ──────────── */

type ErrorKind = "failed" | "rate";

function BrandRoastInner() {
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Lang>("es");
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<RoastResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [stage, setStage] = useState(0);
  const [stageList, setStageList] = useState<readonly string[]>(T.es.stages_nourl);
  const [isSharedView, setIsSharedView] = useState(false);
  const [email, setEmail] = useState("");
  const [emailUnlocked, setEmailUnlocked] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [history, setHistory] = useState<RoastHistoryEntry[]>([]);
  const t = T[lang];

  // Idioma: ?lang= manda; si no, lo ultimo que eligio la persona; si no, el navegador.
  useEffect(() => {
    const fromUrl = searchParams.get("lang");
    const stored = storageGet(LANG_KEY);
    const nav = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "es";
    const next: Lang =
      fromUrl === "en" || fromUrl === "es"
        ? fromUrl
        : stored === "en" || stored === "es"
        ? stored
        : nav.startsWith("en")
        ? "en"
        : "es";
    setLang(next);
  }, [searchParams]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const savedEmail = storageGet("arto_roast_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setEmailUnlocked(true);
    }
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    const shared = parseSharedResult(searchParams);
    if (shared) {
      setBrandName(shared.brand);
      setResult(shared.result);
      setIsSharedView(true);
    }
  }, [searchParams]);

  function switchLang(next: Lang) {
    setLang(next);
    storageSet(LANG_KEY, next);
  }

  function runRoast() {
    if (!brandName.trim() || !industry.trim()) return;

    const hasUrl = websiteUrl.trim().length > 0;
    const stages = hasUrl ? T[lang].stages_url : T[lang].stages_nourl;
    setStageList(stages);
    setResult(null);
    setError(null);
    setIsSharedView(false);
    setAnalyzing(true);
    setStage(0);
    track("roast_started", {
      industry,
      company_size: companySize || "unspecified",
      has_url: hasUrl,
      has_description: description.trim().length > 0,
    });

    let currentStage = 0;
    const stageInterval = setInterval(() => {
      currentStage++;
      if (currentStage < stages.length) setStage(currentStage);
    }, 3200);

    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 70_000);

    fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandName, websiteUrl, industry, companySize, description, lang }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 429) throw new Error("rate");
        if (!res.ok) throw new Error(`status-${res.status}`);
        const data = await res.json();
        if (data?.source !== "ai") throw new Error("not-ai");
        const roastResult = normalizeRoastResult(data?.result);
        if (!roastResult) throw new Error("invalid");
        setResult(roastResult);
        track("roast_completed", { industry, overall: roastResult.overall, source: "ai" });
        setHistory(
          saveToHistory({
            brandName,
            industry,
            websiteUrl: websiteUrl || undefined,
            overall: roastResult.overall,
            date: new Date().toISOString(),
            s: roastResult.strategy.score,
            c: roastResult.creativity.score,
            n: roastResult.narrative.score,
            d: roastResult.digital.score,
          })
        );
      })
      .catch((e: unknown) => {
        const kind: ErrorKind = e instanceof Error && e.message === "rate" ? "rate" : "failed";
        setError(kind);
        track("roast_completed", { industry, overall: 0, source: kind === "rate" ? "rate_limited" : "error" });
      })
      .finally(() => {
        clearInterval(stageInterval);
        clearTimeout(abortTimer);
        setAnalyzing(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runRoast();
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setBrandName("");
    setIndustry("");
    setCompanySize("");
    setWebsiteUrl("");
    setDescription("");
    setStage(0);
    setIsSharedView(false);
    window.history.replaceState({}, "", `/roast?lang=${lang}`);
  }

  const contactHref = `mailto:contact@artogroup.com?subject=${encodeURIComponent(
    `${t.contact_subject}${brandName ? ` (${brandName})` : ""}`
  )}`;

  const LangToggle = (
    <div className="inline-flex rounded-full border border-border p-0.5 text-xs font-medium" role="group" aria-label="Idioma / Language">
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-3 py-1 transition-colors ${lang === l ? "bg-foreground text-white" : "text-muted hover:text-foreground"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href={`/${lang}`} className="flex items-center gap-3">
            <Image src="/brand/arto-logo-black.png" alt="ARTO" width={80} height={24} className="h-6 w-auto" />
            <span className="text-sm font-medium tracking-wide text-muted">Creative 24/7</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link href={`/${lang}/work`} className="text-sm text-muted hover:text-foreground transition-colors">
              {t.nav_work}
            </Link>
            <Link href={`/${lang}/prompts`} className="text-sm text-muted hover:text-foreground transition-colors">
              {t.nav_prompts}
            </Link>
            <Link href={`/${lang}/pricing`} className="text-sm text-muted hover:text-foreground transition-colors">
              {t.nav_pricing}
            </Link>
            {LangToggle}
            <Link
              href={`/${lang}/prompts`}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              {t.nav_cta}
            </Link>
          </div>

          <div className="flex items-center gap-3 md:hidden">
            {LangToggle}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {mobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="8" x2="20" y2="8" />
                    <line x1="4" y1="16" x2="20" y2="16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border px-6 py-4 md:hidden">
            <div className="flex flex-col gap-4">
              <Link href={`/${lang}/work`} className="text-sm text-muted hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
                {t.nav_work}
              </Link>
              <Link href={`/${lang}/prompts`} className="text-sm text-muted hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
                {t.nav_prompts}
              </Link>
              <Link href={`/${lang}/pricing`} className="text-sm text-muted hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
                {t.nav_pricing}
              </Link>
              <Link
                href={`/${lang}/prompts`}
                className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav_cta}
              </Link>
            </div>
          </div>
        )}
      </nav>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="border-b border-border bg-foreground text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-24">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-zinc-400">{t.eyebrow}</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">{t.h1}</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-400">{t.hero}</p>
            <p className="mt-2 text-sm text-zinc-500">{t.hero_sub}</p>
          </div>
        </section>

        <section className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-20">
            {/* Form */}
            {!result && !analyzing && !error && (
              <div className="mx-auto max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t.form_h2}</h2>
                <p className="mt-2 text-muted">{t.form_sub}</p>
                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="brandName" className="block text-sm font-medium">{t.brand}</label>
                      <input
                        id="brandName"
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder={t.brand_ph}
                        required
                        maxLength={100}
                        className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                      />
                    </div>
                    <div>
                      <label htmlFor="websiteUrl" className="block text-sm font-medium">
                        {t.url}
                        <span className="ml-1 text-xs font-normal text-zinc-400">{t.url_hint}</span>
                      </label>
                      {/* type=text: el navegador rechazaba "marca.com" sin https:// con type=url */}
                      <input
                        id="websiteUrl"
                        type="text"
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder={t.url_ph}
                        maxLength={200}
                        className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="industry" className="block text-sm font-medium">{t.industry}</label>
                      <select
                        id="industry"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        required
                        className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground bg-white"
                      >
                        <option value="">{t.industry_ph}</option>
                        {INDUSTRIES.map((g) => (
                          <optgroup key={g.group[1]} label={lang === "es" ? g.group[0] : g.group[1]}>
                            {g.items.map(([value, es, en]) => (
                              <option key={value} value={value}>
                                {lang === "es" ? es : en}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <option value="Other">{lang === "es" ? "Otro" : "Other"}</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="companySize" className="block text-sm font-medium">{t.size}</label>
                      <select
                        id="companySize"
                        value={companySize}
                        onChange={(e) => setCompanySize(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground bg-white"
                      >
                        <option value="">{t.size_ph}</option>
                        {SIZES.map(([value, es, en]) => (
                          <option key={value} value={value}>
                            {lang === "es" ? es : en}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium">{t.desc}</label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t.desc_ph}
                      rows={4}
                      maxLength={500}
                      className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-full bg-foreground px-8 py-4 text-base font-medium text-white transition-colors hover:bg-zinc-800"
                  >
                    {t.submit}
                  </button>
                  <p className="text-center text-xs text-zinc-400">{t.disclaimer}</p>
                </form>

                {history.length > 0 && (
                  <div className="mt-12 border-t border-border pt-10">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted">{t.history}</h3>
                    <p className="mt-1 text-xs text-zinc-400">{t.history_hint}</p>
                    <div className="mt-4 space-y-3">
                      {history.map((entry, i) => {
                        const scoreColor =
                          entry.overall >= 7 ? "text-emerald-500" : entry.overall >= 5 ? "text-amber-500" : "text-red-500";
                        return (
                          <button
                            key={`${entry.brandName}-${i}`}
                            type="button"
                            onClick={() => {
                              setBrandName(entry.brandName);
                              setIndustry(entry.industry);
                              setWebsiteUrl(entry.websiteUrl ?? "");
                              setDescription("");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-zinc-50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{entry.brandName}</p>
                              <p className="text-xs text-muted">
                                {industryLabel(entry.industry, lang)} &middot;{" "}
                                {new Date(entry.date).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                            <span className={`ml-4 text-lg font-bold ${scoreColor}`}>{entry.overall}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analyzing */}
            {analyzing && (
              <div className="mx-auto max-w-2xl text-center py-12 md:py-20 animate-fade-in" aria-live="polite">
                <div className="mx-auto mb-8 h-16 w-16 animate-spin rounded-full border-4 border-zinc-200 border-t-foreground" />
                <h2 className="text-2xl font-bold tracking-tight">
                  {t.analyzing} {brandName}...
                </h2>
                <p className="mt-4 text-lg text-muted">{stageList[stage]}</p>
                <div className="mt-8 mx-auto max-w-sm">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-foreground transition-all duration-700"
                      style={{ width: `${((stage + 1) / stageList.length) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="mt-6 text-xs text-zinc-400">{t.wait_note}</p>
              </div>
            )}

            {/* Error */}
            {error && !analyzing && (
              <div className="mx-auto max-w-lg rounded-2xl border border-border bg-zinc-50 p-8 text-center md:p-10" role="alert">
                <h2 className="text-xl font-bold tracking-tight">{t.err_title}</h2>
                <p className="mt-2 text-sm text-muted">{error === "rate" ? t.err_rate : t.err_body}</p>
                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  {error === "failed" && (
                    <button
                      type="button"
                      onClick={runRoast}
                      className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                    >
                      {t.err_retry}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="rounded-full border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-white"
                  >
                    {t.err_back}
                  </button>
                </div>
              </div>
            )}

            {/* Results */}
            {result && !analyzing && (
              <div className="animate-fade-in">
                <div className="mb-12 text-center">
                  <p className="text-sm font-medium uppercase tracking-widest text-muted">{t.score_for}</p>
                  <h2 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{brandName}</h2>
                  {!isSharedView && <p className="mt-1 text-sm text-muted">{industryLabel(industry, lang)}</p>}
                  <OverallScoreDisplay score={result.overall} />
                  {result.headline && (
                    <p className="mx-auto mt-6 max-w-2xl text-xl font-semibold leading-snug tracking-tight md:text-2xl">
                      {result.headline}
                    </p>
                  )}
                  <p className="mx-auto mt-3 max-w-md text-sm text-muted">{t.weighted}</p>
                  {!isSharedView && <SocialSharePanel brand={brandName} result={result} lang={lang} t={t} />}
                </div>

                {isSharedView ? (
                  <>
                    <p className="mx-auto mb-6 max-w-lg text-center text-sm text-muted">{t.shared_note}</p>
                    <div className="grid gap-6 md:grid-cols-2">
                      <ScoreBar label={t.pillars.strategy} score={result.strategy.score} delay={0} />
                      <ScoreBar label={t.pillars.creativity} score={result.creativity.score} delay={150} />
                      <ScoreBar label={t.pillars.narrative} score={result.narrative.score} delay={300} />
                      <ScoreBar label={t.pillars.digital} score={result.digital.score} delay={450} />
                    </div>
                  </>
                ) : !emailUnlocked ? (
                  <div className="mx-auto max-w-lg">
                    <div className="rounded-2xl border border-border bg-zinc-50 p-8 text-center md:p-10">
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-bold tracking-tight">{t.gate_h}</h3>
                      <p className="mt-2 text-sm text-muted">{t.gate_body}</p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const inputEl = e.currentTarget.querySelector("input[type=email]") as HTMLInputElement | null;
                          const value = (inputEl?.value || email).trim();
                          if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                            setEmailError(t.gate_err);
                            return;
                          }
                          setEmail(value);
                          setEmailError("");
                          storageSet("arto_roast_email", value);
                          setEmailUnlocked(true);
                          track("roast_email_submitted", { industry, overall: result.overall });
                          fetch("/api/roast/email", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: value, brandName }),
                          }).catch(() => {});
                        }}
                        className="mt-6"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setEmailError("");
                            }}
                            placeholder={t.gate_ph}
                            aria-label={t.gate_ph}
                            className="flex-1 rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 whitespace-nowrap"
                          >
                            {t.gate_btn}
                          </button>
                        </div>
                        {emailError && <p className="mt-2 text-xs text-red-500">{emailError}</p>}
                      </form>
                      <p className="mt-4 text-xs text-zinc-400">{t.gate_note}</p>
                    </div>

                    <div className="mt-6 select-none pointer-events-none" aria-hidden="true">
                      <div className="grid gap-6 md:grid-cols-2 blur-md opacity-50">
                        <div className="rounded-xl border border-border bg-white p-6 h-32" />
                        <div className="rounded-xl border border-border bg-white p-6 h-32" />
                        <div className="rounded-xl border border-border bg-white p-6 h-32" />
                        <div className="rounded-xl border border-border bg-white p-6 h-32" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-6 md:grid-cols-2">
                      <ScoreBar label={t.pillars.strategy} score={result.strategy.score} roast={result.strategy.roast} delay={0} />
                      <ScoreBar label={t.pillars.creativity} score={result.creativity.score} roast={result.creativity.roast} delay={150} />
                      <ScoreBar label={t.pillars.narrative} score={result.narrative.score} roast={result.narrative.roast} delay={300} />
                      <ScoreBar label={t.pillars.digital} score={result.digital.score} roast={result.digital.roast} delay={450} />
                    </div>

                    <div className="mt-12 rounded-2xl border border-border bg-zinc-50 p-8 md:p-10">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted">{t.verdict}</h3>
                      <p className="mt-4 text-lg font-medium leading-relaxed">{result.verdict}</p>
                    </div>

                    {result.evidence && result.evidence.length > 0 && (
                      <div className="mt-8 rounded-2xl border border-border p-8 md:p-10">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted">{t.evidence}</h3>
                        <ul className="mt-4 space-y-3">
                          {result.evidence.map((ev, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400" aria-hidden="true" />
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-8 rounded-2xl border border-border p-8 md:p-10">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted">{t.start}</h3>
                      <ul className="mt-4 space-y-4">
                        {result.improvements.map((imp, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-white">
                              {i + 1}
                            </span>
                            <span className="text-sm leading-relaxed text-muted">{imp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {/* CTA */}
                <div className="mt-12 rounded-2xl bg-foreground p-8 text-center text-white md:p-12">
                  <h3 className="text-2xl font-bold tracking-tight md:text-3xl">{isSharedView ? t.cta_shared_h : t.cta_h}</h3>
                  <p className="mx-auto mt-4 max-w-lg text-zinc-400">{isSharedView ? t.cta_shared_body : t.cta_body}</p>
                  <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    {isSharedView ? (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-zinc-100"
                      >
                        {t.cta_shared_btn}
                      </button>
                    ) : (
                      <>
                        <Link
                          href={`/${lang}/prompts`}
                          className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-zinc-100"
                        >
                          {t.cta_prompts}
                        </Link>
                        <a
                          href={contactHref}
                          className="inline-flex items-center justify-center rounded-full border border-zinc-600 px-8 py-3.5 text-base font-medium transition-colors hover:bg-zinc-800"
                        >
                          {t.cta_contact}
                        </a>
                        <button
                          type="button"
                          onClick={handleReset}
                          className="inline-flex items-center justify-center px-4 py-3.5 text-sm font-medium text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline"
                        >
                          {t.cta_again}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-foreground text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <Image src="/brand/arto-logo-black.png" alt="ARTO" width={60} height={18} className="h-4 w-auto invert" />
              <span className="text-xs tracking-wide text-zinc-500">Creative 24/7</span>
            </div>
            <p className="text-xs text-zinc-500">{t.footer}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Error boundary ────────────────────────────────────── */

class RoastErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BrandRoast] Error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
          <h1 className="text-2xl font-bold">{T.es.crash_h} / {T.en.crash_h}</h1>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: "" });
              window.location.href = "/roast";
            }}
            className="mt-6 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-white"
          >
            {T.es.crash_btn} / {T.en.crash_btn}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function BrandRoast() {
  return (
    <RoastErrorBoundary>
      <Suspense fallback={null}>
        <BrandRoastInner />
      </Suspense>
    </RoastErrorBoundary>
  );
}
