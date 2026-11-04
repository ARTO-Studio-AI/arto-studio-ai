import type { Locale } from "@/i18n/config";
import type { Category } from "@/types/prompt";
import { TUTORIALS } from "@/lib/tutorials-content";

/* Libreria de tutoriales (2026-11-05, tarea P0 de D28). Victor, 23 oct: «Los tutoriales son
 * vitales y tenemos que ser mucho más agresivos». Cada tutorial vive en el repo, en ES y EN en
 * paralelo, y enlaza a prompts que existen en el catalogo. Los titulos y el plan (free / pro) de
 * TUTORIAL_PROMPTS se verificaron contra la tabla prompts el 2026-11-05; si cambia un titulo en
 * el catalogo, se actualiza aqui. La ruta es /{locale}/tutoriales en los dos idiomas: el repo usa
 * un solo path por pagina para los dos locales (seo.ts) y /tutorials redirige aqui. */

export type TutorialTool = "claude" | "chatgpt" | "midjourney" | "canva" | "notion";
export type TutorialLevel = "beginner" | "intermediate";

/* Orden en que salen los filtros. */
export const TUTORIAL_TOOLS: Record<TutorialTool, { label: string }> = {
  claude: { label: "Claude" },
  chatgpt: { label: "ChatGPT" },
  midjourney: { label: "Midjourney" },
  canva: { label: "Canva" },
  notion: { label: "Notion" },
};

export interface TutorialPromptRef {
  tier: "free" | "pro";
  title: Record<Locale, string>;
}

/* Prompts que usan los tutoriales, verificados en el catalogo el 2026-11-05. */
export const TUTORIAL_PROMPTS: Record<string, TutorialPromptRef> = {
  "BR-0252": { tier: "pro", title: { es: "Nombre e identidad verbal para una cafetería independiente", en: "Name and verbal identity for an independent coffee shop" } },
  "MK-0256": { tier: "free", title: { es: "Perfil de Google Business que traiga visitas de tu zona", en: "Google Business profile that brings visits from your area" } },
  "MK-0251": { tier: "free", title: { es: "Plan de lanzamiento de 30 días para una cafetería de barrio", en: "30-day launch plan for a neighborhood coffee shop" } },
  "IL-0252": { tier: "free", title: { es: "Mascota sencilla para un negocio de barrio, lista para redes y empaque", en: "Simple mascot for a neighborhood business, ready for social media and packaging" } },
  "VD-0251": { tier: "free", title: { es: "Guion de reel de 30 segundos para presentar tu negocio", en: "30-second reel script to introduce your business" } },
  "CP-0251": { tier: "pro", title: { es: "Cotización en tres niveles para un proyecto creativo", en: "Three-tier quote for a creative project" } },
  "CW-0255": { tier: "pro", title: { es: "Propuesta comercial de una página para un cliente nuevo", en: "One-page sales proposal for a new client" } },
  "CP-0252": { tier: "pro", title: { es: "Onboarding de un cliente nuevo en una agencia chica: primeras dos semanas", en: "New client onboarding at a small agency: the first two weeks" } },
  "UX-0255": { tier: "pro", title: { es: "Portal de cliente sencillo para una agencia chica: pantallas y orden", en: "Simple client portal for a small agency: screens and order" } },
  "CP-0253": { tier: "pro", title: { es: "Cómo responder a cambios fuera de alcance sin perder al cliente", en: "How to handle out-of-scope requests without losing the client" } },
  "BR-0254": { tier: "pro", title: { es: "Identidad visual mínima para tu marca personal", en: "Minimum visual identity for your personal brand" } },
  "CW-0254": { tier: "pro", title: { es: "Bio profesional en tres largos para quien da servicios", en: "Professional bio in three lengths for service providers" } },
  "MK-0253": { tier: "free", title: { es: "Calendario de contenido de 4 semanas para quien trabaja solo", en: "4-week content calendar for people who work alone" } },
  "IL-0253": { tier: "pro", title: { es: "Ilustraciones para un carrusel educativo de Instagram de quien da servicios", en: "Illustrations for an educational Instagram carousel for service providers" } },
  "CW-0256": { tier: "pro", title: { es: "Tres mensajes de prospección por LinkedIn para quien vende servicios solo", en: "Three LinkedIn prospecting messages for solo service sellers" } },
};

export interface TutorialStepCopy {
  title: string;
  body: string;
  /* Que datos poner en el prompt. */
  data?: string[];
  /* Que esperar de la respuesta. */
  expect?: string;
  tip?: string;
}

export interface TutorialStep {
  promptId?: string;
  copy: Record<Locale, TutorialStepCopy>;
}

export interface TutorialCopy {
  title: string;
  summary: string;
  audience: string;
  outcome: string[];
  closing: string;
  /* Palabra en serif de la portada. */
  coverWord: string;
}

export interface Tutorial {
  code: string; // T01, T02...
  slug: string;
  publishedAt: string; // AAAA-MM-DD
  tools: TutorialTool[];
  level: TutorialLevel;
  readingMinutes: number;
  /* Vertical para el acento de la portada y el enlace al catalogo. */
  category: Category;
  /* URL de YouTube o Vimeo. Sin video, no se muestra el bloque. */
  video?: string;
  copy: Record<Locale, TutorialCopy>;
  steps: TutorialStep[];
}

export function isTutorialTool(value: unknown): value is TutorialTool {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TUTORIAL_TOOLS, value);
}

export function getAllTutorials(): Tutorial[] {
  return TUTORIALS;
}

export function getTutorial(slug: string): Tutorial | null {
  return TUTORIALS.find((t) => t.slug === slug) ?? null;
}

/* Filtro del indice. Un valor desconocido muestra todos, igual que sin filtro. */
export function filterTutorials(list: Tutorial[], tool: unknown): Tutorial[] {
  if (!isTutorialTool(tool)) return list;
  return list.filter((t) => t.tools.includes(tool));
}

/* Herramientas que aparecen en al menos un tutorial, en el orden de TUTORIAL_TOOLS. */
export function toolsInUse(list: Tutorial[]): TutorialTool[] {
  return (Object.keys(TUTORIAL_TOOLS) as TutorialTool[]).filter((tool) => list.some((t) => t.tools.includes(tool)));
}

/* IDs de prompts en el orden de los pasos, sin repetir. */
export function tutorialPromptIds(tutorial: Tutorial): string[] {
  const ids: string[] = [];
  for (const step of tutorial.steps) if (step.promptId && !ids.includes(step.promptId)) ids.push(step.promptId);
  return ids;
}

export function hasProPrompt(tutorial: Tutorial): boolean {
  return tutorialPromptIds(tutorial).some((id) => TUTORIAL_PROMPTS[id]?.tier === "pro");
}

/* URL embebible de YouTube o Vimeo, o null si no se reconoce. YouTube va por
 * youtube-nocookie para no poner cookies antes de que la persona le de play. */
export function videoEmbedUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const ytId = /^[A-Za-z0-9_-]{11}$/;
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return ytId.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[0] === "watch" ? (url.searchParams.get("v") ?? "") : ["embed", "shorts", "live"].includes(parts[0] ?? "") ? (parts[1] ?? "") : "";
    return ytId.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((p) => /^\d+$/.test(p));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

/* Textos de la interfaz. Viven aqui y no en dictionaries.ts para no chocar con los cambios
 * en paralelo a ese archivo; los precios si salen del diccionario de /pricing. */
export const TUTORIALS_UI: Record<
  Locale,
  {
    eyebrow: string;
    h1: string;
    sub: string;
    filter_label: string;
    filter_all: string;
    empty: string;
    level: Record<TutorialLevel, string>;
    minutes: string;
    prompts_count: (n: number) => string;
    read: string;
    back: string;
    audience_h2: string;
    outcome_h2: string;
    prompts_h2: string;
    steps_h2: string;
    step_label: string;
    data_label: string;
    expect_label: string;
    tip_label: string;
    open_prompt: string;
    video_h2: string;
    tools_label: string;
    closing_h2: string;
    free_h3: string;
    free_body: string;
    free_cta: string;
    pro_body: string;
    more_h2: string;
    learn_eyebrow: string;
    learn_h2: string;
    learn_body: string;
    learn_cta: string;
  }
> = {
  es: {
    eyebrow: "Tutoriales",
    h1: "Tutoriales de IA para trabajo real",
    sub: "Paso a paso, con los prompts exactos de la biblioteca de ARTO. Cada tutorial te dice qué datos poner, qué esperar y cómo seguir. Empieza por el que se parezca a tu semana.",
    filter_label: "Herramienta",
    filter_all: "Todas",
    empty: "Todavía no hay tutoriales con esta herramienta.",
    level: { beginner: "Principiante", intermediate: "Intermedio" },
    minutes: "min de lectura",
    prompts_count: (n) => (n === 1 ? "1 prompt" : `${n} prompts`),
    read: "Ver tutorial →",
    back: "← Todos los tutoriales",
    audience_h2: "Para quién es",
    outcome_h2: "Qué vas a tener al final",
    prompts_h2: "Prompts que usa",
    steps_h2: "Paso a paso",
    step_label: "Paso",
    data_label: "Qué datos poner",
    expect_label: "Qué esperar",
    tip_label: "Tip",
    open_prompt: "Abrir prompt →",
    video_h2: "Video",
    tools_label: "Herramientas",
    closing_h2: "Ahora te toca",
    free_h3: "Cuenta gratis",
    free_body: "Con tu cuenta abres los prompts gratis de este tutorial y guardas tus favoritos.",
    free_cta: "Crear cuenta gratis",
    pro_body: "Este tutorial usa prompts Pro.",
    more_h2: "Más tutoriales",
    learn_eyebrow: "Nuevo · Tutoriales",
    learn_h2: "Tutoriales paso a paso con los prompts de ARTO",
    learn_body: "Abre tu negocio, cotiza un proyecto o arma tu marca personal: cada tutorial te lleva de la idea al resultado con prompts del catálogo.",
    learn_cta: "Ver tutoriales →",
  },
  en: {
    eyebrow: "Tutorials",
    h1: "AI tutorials for real work",
    sub: "Step by step, with the exact prompts from the ARTO library. Each tutorial tells you what to fill in, what to expect and what comes next. Start with the one that looks like your week.",
    filter_label: "Tool",
    filter_all: "All",
    empty: "There are no tutorials with this tool yet.",
    level: { beginner: "Beginner", intermediate: "Intermediate" },
    minutes: "min read",
    prompts_count: (n) => (n === 1 ? "1 prompt" : `${n} prompts`),
    read: "Read tutorial →",
    back: "← All tutorials",
    audience_h2: "Who it is for",
    outcome_h2: "What you will have at the end",
    prompts_h2: "Prompts it uses",
    steps_h2: "Step by step",
    step_label: "Step",
    data_label: "What to fill in",
    expect_label: "What to expect",
    tip_label: "Tip",
    open_prompt: "Open prompt →",
    video_h2: "Video",
    tools_label: "Tools",
    closing_h2: "Your turn",
    free_h3: "Free account",
    free_body: "Your account opens the free prompts in this tutorial and saves your favorites.",
    free_cta: "Create free account",
    pro_body: "This tutorial uses Pro prompts.",
    more_h2: "More tutorials",
    learn_eyebrow: "New · Tutorials",
    learn_h2: "Step-by-step tutorials with ARTO prompts",
    learn_body: "Open your business, quote a project or build your personal brand: each tutorial takes you from the idea to the result with prompts from the catalog.",
    learn_cta: "See tutorials →",
  },
};
