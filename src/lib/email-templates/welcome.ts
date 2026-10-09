import { SITE_URL } from "@/lib/site-url";
import { C, F, button, esc, eyebrow, layout } from "./layout";

/* Correo de bienvenida a la lista (2026-10-07). Sale a quien marco la casilla de
 * promociones (registro o roast). El contenido se edita desde /admin/emails y vive en
 * engine_config (clave email_welcome); aqui solo esta el diseno y los valores por
 * defecto. */

export interface WelcomeItem {
  title_es: string;
  title_en: string;
  body_es: string;
  body_en: string;
  url: string;
}

export interface WelcomeContent {
  subject_es: string;
  subject_en: string;
  headline_es: string;
  headline_en: string;
  accent_es: string;
  accent_en: string;
  intro_es: string;
  intro_en: string;
  items: WelcomeItem[];
  promo_enabled: boolean;
  promo_title_es: string;
  promo_title_en: string;
  promo_body_es: string;
  promo_body_en: string;
  promo_cta_es: string;
  promo_cta_en: string;
  promo_url: string;
}

export const WELCOME_DEFAULT: WelcomeContent = {
  subject_es: "Ya estás dentro de ARTO Studio AI",
  subject_en: "You're in: welcome to ARTO Studio AI",
  headline_es: "Ya estás",
  headline_en: "You're",
  accent_es: "dentro.",
  accent_en: "in.",
  intro_es:
    "Gracias por sumarte. Cada cierto tiempo te vamos a mandar prompts nuevos, guías para trabajar con IA como estratega y las promociones del sitio antes que a nadie.",
  intro_en:
    "Thanks for joining. Every so often we'll send you new prompts, guides to work with AI like a strategist, and the site's promotions before anyone else.",
  items: [
    {
      title_es: "3,000+ prompts de marca",
      title_en: "3,000+ brand prompts",
      body_es: "Escritos por estrategas de ARTO, en español e inglés, para 12 disciplinas creativas.",
      body_en: "Written by ARTO strategists, in English and Spanish, across 12 creative disciplines.",
      url: "/prompts",
    },
    {
      title_es: "Brand Roast gratis",
      title_en: "Free Brand Roast",
      body_es: "Leemos tu sitio y calificamos tu marca en 20 segundos, con evidencia de tu propio copy.",
      body_en: "We read your site and score your brand in 20 seconds, quoting your own copy.",
      url: "/roast",
    },
    {
      title_es: "Pack ARTO de Estrategia de Marca",
      title_en: "ARTO Brand Strategy Pack",
      body_es: "Cinco skills para Claude y ChatGPT. Sale la semana del 12 de octubre.",
      body_en: "Five skills for Claude and ChatGPT. Ships the week of October 12.",
      url: "/skills",
    },
  ],
  promo_enabled: true,
  promo_title_es: "Precio de lanzamiento para los primeros 50",
  promo_title_en: "Launch price for the first 50",
  promo_body_es: "Como estás en la lista, te avisamos primero cuando salga el pack, con el precio de lanzamiento.",
  promo_body_en: "Because you're on the list, you'll hear first when the pack ships, at the launch price.",
  promo_cta_es: "Ver qué trae el pack",
  promo_cta_en: "See what's in the pack",
  promo_url: "/skills",
};

function abs(url: string, lang: "es" | "en"): string {
  if (/^https?:\/\//i.test(url)) return url;
  const p = url.startsWith("/") ? url : `/${url}`;
  return `${SITE_URL}/${lang}${p}`;
}

export function welcomeEmail(content: WelcomeContent, lang: "es" | "en", unsubscribeUrl?: string) {
  const es = lang === "es";
  const L = (a: string, b: string): string => (es ? a : b);
  const reason = es
    ? "Recibes este correo porque te inscribiste a la lista de ARTO Studio AI."
    : "You're receiving this because you joined the ARTO Studio AI list.";

  const items = content.items
    .map(
      (it) => `
      <tr><td style="padding:16px 0;border-top:1px solid ${C.line};">
        <a href="${esc(abs(it.url, lang))}" style="text-decoration:none;">
          <div style="font-family:${F.display};font-size:19px;line-height:24px;font-weight:800;color:${C.ink};letter-spacing:-0.3px;">${esc(L(it.title_es, it.title_en))} <span style="color:${C.accent};">→</span></div>
          <div style="font-family:${F.body};font-size:15px;line-height:23px;color:${C.ink2};margin-top:4px;">${esc(L(it.body_es, it.body_en))}</div>
        </a>
      </td></tr>`,
    )
    .join("");

  const promo = content.promo_enabled
    ? `<div style="background:${C.ink};border-radius:12px;padding:26px 24px;margin:26px 0 0 0;">
        ${eyebrow(es ? "Para la lista" : "For the list", C.accent)}
        <div style="font-family:${F.display};font-size:24px;line-height:29px;font-weight:800;color:${C.white};letter-spacing:-0.5px;margin-top:10px;">${esc(L(content.promo_title_es, content.promo_title_en))}</div>
        <div style="font-family:${F.body};font-size:15px;line-height:23px;color:#d4d4d8;margin:10px 0 18px 0;">${esc(L(content.promo_body_es, content.promo_body_en))}</div>
        ${button(L(content.promo_cta_es, content.promo_cta_en), abs(content.promo_url, lang), "accent")}
      </div>`
    : "";

  const body = `
    ${eyebrow(es ? "Bienvenida" : "Welcome", C.accent)}
    <div class="h1" style="font-family:${F.display};font-size:46px;line-height:50px;font-weight:800;letter-spacing:-1.5px;color:${C.ink};margin:14px 0 0 0;">${esc(L(content.headline_es, content.headline_en))} <span style="font-family:${F.serif};font-style:italic;font-weight:600;font-size:54px;letter-spacing:-0.5px;color:${C.accent};">${esc(L(content.accent_es, content.accent_en))}</span></div>
    <div style="font-family:${F.body};font-size:17px;line-height:27px;color:${C.ink2};margin:18px 0 26px 0;">${esc(L(content.intro_es, content.intro_en))}</div>
    ${eyebrow(es ? "Lo que vas a encontrar" : "What you'll find")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${items}</table>
    ${promo}
    <div style="font-family:${F.serif};font-style:italic;font-size:20px;line-height:26px;color:${C.ink};margin:28px 0 0 0;">${es ? "Nos leemos pronto." : "Talk soon."}</div>
    <div style="font-family:${F.meta};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.ink2};margin-top:6px;">ARTO Studio AI</div>`;

  const text = [
    `${L(content.headline_es, content.headline_en)} ${L(content.accent_es, content.accent_en)}`,
    "",
    L(content.intro_es, content.intro_en),
    "",
    ...content.items.map((it) => `- ${L(it.title_es, it.title_en)}: ${L(it.body_es, it.body_en)} ${abs(it.url, lang)}`),
    "",
    content.promo_enabled ? `${L(content.promo_title_es, content.promo_title_en)}: ${L(content.promo_body_es, content.promo_body_en)} ${abs(content.promo_url, lang)}` : "",
    "",
    reason,
    unsubscribeUrl ? `${es ? "Darme de baja" : "Unsubscribe"}: ${unsubscribeUrl}` : "",
  ].join("\n");

  return {
    subject: L(content.subject_es, content.subject_en),
    html: layout({ lang, preheader: L(content.intro_es, content.intro_en).slice(0, 120), body, reason, unsubscribeUrl }),
    text,
  };
}
