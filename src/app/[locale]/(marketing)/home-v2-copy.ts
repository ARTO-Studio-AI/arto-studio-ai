import type { Locale } from "@/i18n/config";

/* Copy del home v2 (propuesta aprobada por Victor el 2026-10-07). Vive aparte del
 * diccionario general para no tocar las claves que usan otras paginas. */
export const HOME_V2: Record<Locale, {
  eyebrow: string;
  h1_before: string;
  h1_accent: string;
  lead: string;
  cta_prompts: string;
  cta_roast: string;
  fine: string;
  tiers_h2: string;
  lib_eyebrow: string;
  lib_title: string;
  lib_body: string;
  lib_bullets: string[];
  lib_cta: string;
  roast_eyebrow: string;
  roast_title: string;
  roast_body: string;
  roast_bullets: string[];
  roast_cta: string;
  pack_eyebrow: string;
  pack_title: string;
  pack_body: string;
  pack_bullets: string[];
  pack_cta: string;
  blogs_h2: string;
  quote: string;
  quote_eyebrow: string;
  quote_by: string;
}> = {
  es: {
    eyebrow: "Por ARTO Group · Agencia de marca desde 2009",
    h1_before: "El estudio creativo que nunca",
    h1_accent: "duerme.",
    lead: "Elige un prompt hecho por estrategas de ARTO, pégalo en Claude o ChatGPT y entrega trabajo de marca el mismo día. En español y en inglés.",
    cta_prompts: "Explorar prompts gratis",
    cta_roast: "Roastea tu marca",
    fine: "Cuenta gratis con tu correo · {n} prompts · 12 verticales creativas",
    tiers_h2: "Tres formas de empezar.",
    lib_eyebrow: "Gratis con cuenta",
    lib_title: "Biblioteca de prompts",
    lib_body: "{n} prompts bilingües en 12 verticales, escritos con la metodología de ARTO.",
    lib_bullets: ["Español e inglés, lado a lado", "Búsqueda inteligente por proyecto", "Favoritos y colecciones"],
    lib_cta: "Ver catálogo",
    roast_eyebrow: "Gratis",
    roast_title: "Brand Roast",
    roast_body: "Leemos tu sitio y calificamos tu marca en Estrategia, Creatividad, Narrativa y Digital, con citas de tu propio copy.",
    roast_bullets: ["Resultado en unos 20 segundos", "Evidencia del sitio real", "Imagen lista para compartir"],
    roast_cta: "Roastear mi marca",
    pack_eyebrow: "La próxima semana",
    pack_title: "Pack ARTO de Estrategia de Marca",
    pack_body: "Cinco skills para Claude y ChatGPT: posicionamiento, tabla NOT, brief creativo, voz y tono, y roast.",
    pack_bullets: ["Sale la semana del 12 de octubre", "Precio de lanzamiento para los primeros 50"],
    pack_cta: "Avísame primero",
    blogs_h2: "Guías para trabajar con IA como estratega.",
    quote: "“Un prompt bueno no es una instrucción. Es una decisión de estrategia escrita para que la IA la ejecute.”",
    quote_eyebrow: "El método ARTO",
    quote_by: "ARTO Group · 98 marcas en Latinoamérica desde 2009",
  },
  en: {
    eyebrow: "By ARTO Group · Brand agency since 2009",
    h1_before: "The creative studio that never",
    h1_accent: "sleeps.",
    lead: "Pick a prompt written by ARTO strategists, paste it into Claude or ChatGPT, and ship brand work the same day. In English and Spanish.",
    cta_prompts: "Browse free prompts",
    cta_roast: "Roast your brand",
    fine: "Free account with your email · {n} prompts · 12 creative verticals",
    tiers_h2: "Three ways to start.",
    lib_eyebrow: "Free with an account",
    lib_title: "Prompt library",
    lib_body: "{n} bilingual prompts across 12 verticals, written with ARTO's methodology.",
    lib_bullets: ["English and Spanish, side by side", "Smart search by project", "Favorites and collections"],
    lib_cta: "Browse the catalog",
    roast_eyebrow: "Free",
    roast_title: "Brand Roast",
    roast_body: "We read your website and score your brand on Strategy, Creativity, Narrative and Digital, quoting your own copy.",
    roast_bullets: ["Results in about 20 seconds", "Evidence from your real site", "Image ready to share"],
    roast_cta: "Roast my brand",
    pack_eyebrow: "Next week",
    pack_title: "ARTO Brand Strategy Pack",
    pack_body: "Five skills for Claude and ChatGPT: positioning, NOT table, creative brief, voice and tone, and roast.",
    pack_bullets: ["Ships the week of October 12", "Launch price for the first 50"],
    pack_cta: "Tell me first",
    blogs_h2: "Guides to work with AI like a strategist.",
    quote: "“A good prompt is not an instruction. It's a strategy decision written for the AI to execute.”",
    quote_eyebrow: "The ARTO method",
    quote_by: "ARTO Group · 98 brands across Latin America since 2009",
  },
};
