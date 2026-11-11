import type { Locale } from "@/i18n/config";

/* Copy del home v2 (propuesta aprobada por Victor el 2026-10-07). Vive aparte del
 * diccionario general para no tocar las claves que usan otras paginas. */
export const HOME_V2: Record<Locale, {
  eyebrow: string;
  h1_before: string;
  h1_accent: string;
  h1_after: string;
  lead: string;
  potd_badge: string;
  potd_eyebrow: string;
  potd_copy: string;
  potd_view: string;
  potd_body: string;
  potd_fallback_title: string;
  potd_fallback_body: string;
  cta_prompts: string;
  cta_roast: string;
  fine: string;
  hero_alt: string;
  how_eyebrow: string;
  how_h2: string;
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
  /* Para quien es, buscador abierto, cifras y herramientas (2026-11-05). Los textos de las dos
   * tarjetas son los aprobados por Victor, literales. href va sin locale; la pagina lo antepone. */
  who_eyebrow: string;
  who_h2: string;
  who_cards: { title: string; body: string; cta: string; href: string }[];
  search_h2: string;
  search_label: string;
  search_placeholder: string;
  search_button: string;
  search_try: string;
  search_examples: string[];
  fig_prompts: string;
  fig_verticals: string;
  fig_skills: string;
  fig_years_value: string;
  fig_years: string;
  tools_eyebrow: string;
  tools_note: string;
}> = {
  es: {
    eyebrow: "Por ARTO Group · Agencia creativa desde 2009",
    // Titular decidido por Victor el 11 nov 2026 (marca v2.0).
    h1_before: "Lo que usamos en ARTO,",
    h1_accent: "listo",
    h1_after: "para copiar.",
    lead: "Te damos los prompts, skills y sistemas de IA que usamos en ARTO, probados y listos para copiar. Para emprendedores y equipos chicos que quieren trabajar más rápido.",
    potd_badge: "Prompt del día",
    potd_eyebrow: "Lo usas hoy",
    potd_copy: "Abrir el prompt",
    potd_view: "Ver el catálogo",
    potd_body: "Ábrelo, cópialo y pégalo en Claude o ChatGPT con tus datos. Listo en minutos.",
    potd_fallback_title: "Tu propuesta hoy, con un solo prompt",
    potd_fallback_body: "Pega tus notas de la llamada tal cual. Pide tres secciones: lo que entendiste, lo que propones y lo que cuesta.",
    cta_prompts: "Explorar prompts gratis",
    cta_roast: "Roastea tu marca",
    hero_alt: "Ilustración: un personaje con un ojo por cabeza trabaja en su laptop, sentado sobre una luna naranja.",
    how_eyebrow: "Cómo funciona",
    how_h2: "Del prompt al resultado, en tres pasos.",
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
    pack_eyebrow: "Muy pronto",
    pack_title: "Pack ARTO de Estrategia de Marca",
    pack_body: "Cinco skills para Claude y ChatGPT: posicionamiento, tabla NOT, brief creativo, voz y tono, y roast.",
    pack_bullets: ["Te avisamos por correo el día que salga", "Precio de lanzamiento para los primeros 50"],
    pack_cta: "Avísame primero",
    blogs_h2: "Guías para trabajar con IA como estratega.",
    quote: "“Un prompt bueno no es una instrucción. Es una decisión de estrategia escrita para que la IA la ejecute.”",
    quote_eyebrow: "El método ARTO",
    quote_by: "ARTO Group · 98 marcas en Latinoamérica desde 2009",
    who_eyebrow: "Para quién es",
    who_h2: "Para quien hace trabajo creativo con poco equipo, o con ninguno.",
    who_cards: [
      {
        title: "Trabajas solo o estás por arrancar",
        body: "Vendes un servicio sin equipo, o estás por lanzar tu propio proyecto, y quieres una marca que no suene a lo que escribe cualquiera con IA.",
        cta: "Empieza por tu posicionamiento",
        href: "/prompts?q=posicionamiento",
      },
      {
        title: "Tienes una agencia chica",
        body: "Tu equipo cubre más perfiles de los que tiene y los fees vienen apretados. Usa el método de ARTO para entregar más con el mismo equipo.",
        cta: "Ver prompts de productividad creativa",
        href: "/prompts?category=creative_productivity",
      },
    ],
    search_h2: "¿Qué tienes que entregar hoy?",
    search_label: "Buscar en la biblioteca de prompts",
    search_placeholder: "Naming, brief, guion…",
    search_button: "Buscar",
    search_try: "Prueba con:",
    search_examples: ["naming", "brief", "guion", "pitch"],
    fig_prompts: "prompts publicados",
    fig_verticals: "verticales creativas",
    fig_skills: "skills disponibles",
    fig_years_value: "15+",
    fig_years: "años de ARTO como agencia creativa",
    tools_eyebrow: "Funcionan con",
    tools_note: "Ordenadas por cuántos prompts del catálogo hay para cada una.",
  },
  en: {
    eyebrow: "By ARTO Group · Creative agency since 2009",
    // Headline decided by Victor on 11 Nov 2026 (brand v2.0).
    h1_before: "What we use at ARTO,",
    h1_accent: "ready",
    h1_after: "to copy.",
    lead: "We give you the prompts, skills and AI systems we use at ARTO, tested and ready to copy. For entrepreneurs and small teams who want to work faster.",
    potd_badge: "Prompt of the day",
    potd_eyebrow: "Use it today",
    potd_copy: "Open the prompt",
    potd_view: "Browse the catalog",
    potd_body: "Open it, copy it and paste it into Claude or ChatGPT with your details. Done in minutes.",
    potd_fallback_title: "Your proposal today, with one prompt",
    potd_fallback_body: "Paste your call notes as they are. Ask for three sections: what you understood, what you propose and what it costs.",
    cta_prompts: "Browse free prompts",
    cta_roast: "Roast your brand",
    hero_alt: "Illustration: a character with an eye for a head works on a laptop, sitting on an orange moon.",
    how_eyebrow: "How it works",
    how_h2: "From prompt to result, in three steps.",
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
    pack_eyebrow: "Coming soon",
    pack_title: "ARTO Brand Strategy Pack",
    pack_body: "Five skills for Claude and ChatGPT: positioning, NOT table, creative brief, voice and tone, and roast.",
    pack_bullets: ["We'll email you the day it ships", "Launch price for the first 50"],
    pack_cta: "Tell me first",
    blogs_h2: "Guides to work with AI like a strategist.",
    quote: "“A good prompt is not an instruction. It's a strategy decision written for the AI to execute.”",
    quote_eyebrow: "The ARTO method",
    quote_by: "ARTO Group · 98 brands across Latin America since 2009",
    who_eyebrow: "Who it's for",
    who_h2: "For people doing creative work with a small team, or none.",
    who_cards: [
      {
        title: "You work solo or you're about to launch",
        body: "You sell a service without a team, or you're about to launch your own project, and you want a brand that doesn't sound like everyone else's AI output.",
        cta: "Start with your positioning",
        href: "/prompts?q=positioning",
      },
      {
        title: "You run a small agency",
        body: "Your team covers more roles than it has people, and fees keep getting squeezed. Use ARTO's method to deliver more with the same team.",
        cta: "See creative productivity prompts",
        href: "/prompts?category=creative_productivity",
      },
    ],
    search_h2: "What do you need to ship today?",
    search_label: "Search the prompt library",
    search_placeholder: "Naming, brief, script…",
    search_button: "Search",
    search_try: "Try:",
    search_examples: ["naming", "brief", "script", "pitch"],
    fig_prompts: "published prompts",
    fig_verticals: "creative verticals",
    fig_skills: "skills available",
    fig_years_value: "15+",
    fig_years: "years of ARTO as a creative agency",
    tools_eyebrow: "Works with",
    tools_note: "Sorted by how many prompts in the catalog are written for each one.",
  },
};
