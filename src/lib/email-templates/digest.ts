import { SITE_URL } from "@/lib/site-url";
import { VERTICALS, type Category } from "@/types/prompt";
import { C, F, button, esc, eyebrow, layout } from "./layout";

/* Resumen semanal de la lista (2026-10-16). Sustituye el HTML suelto que armaba
 * /api/cron/digest: en ingles, con emojis y con dos secciones internas (las busquedas
 * de los usuarios y la brecha del catalogo con su similarity) que se mandaban a toda la
 * lista. Regla de Victor del 16 oct: todo correo va con el diseno de marca. Aqui solo va
 * contenido publico: cinco prompts de la biblioteca, una linea editorial y la biblioteca.
 * Los prompts ya no son una seleccion editorial (ver src/lib/digest-selection.ts): el copy
 * no dice que los eligieron estrategas ni que estan probados. Sale los martes. */

export interface DigestPrompt {
  id: string;
  title_es: string;
  title_en: string;
  category: string;
  /** free, pro o enterprise. La etiqueta dice Gratis o Pro. */
  tier: string;
}

export interface DigestInput {
  lang: "es" | "en";
  prompts: DigestPrompt[];
  unsubscribeUrl: string;
}

const UTM = "utm_source=email&utm_medium=email&utm_campaign=digest";

/** Enlace con UTM; `content` identifica el prompt (o «biblioteca») en /admin/canales y PostHog. */
export function digestUrl(path: string, lang: "es" | "en", content: string): string {
  return `${SITE_URL}/${lang}${path}?${UTM}&utm_content=${encodeURIComponent(content)}`;
}

function categoryLabel(category: string, lang: "es" | "en"): string {
  const v = VERTICALS[category as Category];
  if (!v) return category.replace(/_/g, " ");
  return lang === "es" ? v.label_es : v.label_en;
}

const COPY = {
  es: {
    subject: "Lo que vale la pena abrir esta semana · ARTO Studio AI",
    preheader: "Cinco prompts de la biblioteca para abrir esta semana.",
    eyebrow: "Resumen semanal",
    h: "Esta semana en la",
    accent: "biblioteca.",
    intro: "Cinco prompts de la biblioteca que vale la pena abrir esta semana, listos para copiar en Claude o ChatGPT.",
    list: "Esta semana",
    free: "Gratis",
    pro: "Pro",
    cta: "Ver toda la biblioteca",
    sign: "Nos leemos el próximo martes.",
    reason: "Recibes este correo porque te inscribiste a la lista de ARTO Studio AI.",
    unsub: "Darme de baja",
    privacy: "Aviso de privacidad",
    sender: "ARTO Group · Agencia de marca desde 2009",
  },
  en: {
    subject: "Worth opening this week · ARTO Studio AI",
    preheader: "Five prompts from the library to open this week.",
    eyebrow: "Weekly digest",
    h: "This week in the",
    accent: "library.",
    intro: "Five prompts from the library worth opening this week, ready to paste into Claude or ChatGPT.",
    list: "This week",
    free: "Free",
    pro: "Pro",
    cta: "Browse the full library",
    sign: "Talk next Tuesday.",
    reason: "You're receiving this because you joined the ARTO Studio AI list.",
    unsub: "Unsubscribe",
    privacy: "Privacy",
    sender: "ARTO Group · Brand agency since 2009",
  },
} as const;

export function digestEmail({ lang, prompts, unsubscribeUrl }: DigestInput) {
  const t = COPY[lang];
  const tierLabel = (p: DigestPrompt) => (p.tier === "free" ? t.free : t.pro);
  const title = (p: DigestPrompt) => (lang === "es" ? p.title_es || p.title_en : p.title_en || p.title_es);

  const rows = prompts
    .map(
      (p) => `
      <tr><td style="padding:16px 0;border-top:1px solid ${C.line};">
        <a href="${esc(digestUrl(`/prompts/${p.id}`, lang, p.id))}" style="text-decoration:none;">
          <div style="font-family:${F.meta};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.ink3};">${esc(p.id)} · ${esc(categoryLabel(p.category, lang))} · <span style="color:${p.tier === "free" ? C.ink2 : C.accent};">${tierLabel(p)}</span></div>
          <div style="font-family:${F.display};font-size:19px;line-height:24px;font-weight:800;color:${C.ink};letter-spacing:-0.3px;margin-top:4px;">${esc(title(p))} <span style="color:${C.accent};">→</span></div>
        </a>
      </td></tr>`,
    )
    .join("");

  const libraryUrl = digestUrl("/prompts", lang, "biblioteca");
  const body = `
    ${eyebrow(t.eyebrow, C.accent)}
    <div class="h1" style="font-family:${F.display};font-size:42px;line-height:46px;font-weight:800;letter-spacing:-1.5px;color:${C.ink};margin:14px 0 0 0;">${t.h} <span style="font-family:${F.serif};font-style:italic;font-weight:600;font-size:50px;letter-spacing:-0.5px;color:${C.accent};">${t.accent}</span></div>
    <div style="font-family:${F.body};font-size:17px;line-height:27px;color:${C.ink2};margin:18px 0 26px 0;">${esc(t.intro)}</div>
    ${eyebrow(t.list)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows}</table>
    <div style="margin-top:26px;">${button(t.cta, libraryUrl, "dark")}</div>
    <div style="font-family:${F.serif};font-style:italic;font-size:20px;line-height:26px;color:${C.ink};margin:22px 0 0 0;">${t.sign}</div>
    <div style="font-family:${F.meta};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.ink2};margin-top:6px;">ARTO Studio AI</div>`;

  const text = [
    `${t.h} ${t.accent}`,
    "",
    t.intro,
    "",
    ...prompts.map((p) => `- ${title(p)} (${p.id}, ${categoryLabel(p.category, lang)}, ${tierLabel(p)}): ${digestUrl(`/prompts/${p.id}`, lang, p.id)}`),
    "",
    `${t.cta}: ${libraryUrl}`,
    "",
    t.sign,
    "ARTO Studio AI",
    "",
    "--",
    t.reason,
    t.sender,
    `${t.privacy}: ${SITE_URL}/${lang}/privacy`,
    `${t.unsub}: ${unsubscribeUrl}`,
  ].join("\n");

  return {
    subject: t.subject,
    html: layout({ lang, preheader: t.preheader, body, reason: t.reason, unsubscribeUrl }),
    text,
  };
}
