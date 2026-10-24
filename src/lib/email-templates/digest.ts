import { SITE_URL } from "@/lib/site-url";
import { VERTICALS, type Category } from "@/types/prompt";
import { C, F, button, esc, eyebrow, hero, layout, signoff, tiles } from "./layout";

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
  /** free, pro o enterprise. La etiqueta dice Gratis solo para free; pro y enterprise dicen Pro. */
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
    list: "Cinco prompts",
    free: "Gratis",
    pro: "Pro",
    open: "Abrir prompt",
    cta: "Ver toda la biblioteca",
    studio: "Del estudio",
    roastT: "Brand Roast gratis",
    roastB: "Tu marca calificada en 20 segundos, con citas de tu propio copy.",
    roastC: "Hacer mi roast",
    packT: "Pack ARTO de Estrategia de Marca",
    packB: "Cinco skills para Claude y ChatGPT. Anótate y te avisamos primero.",
    packC: "Unirme a la lista",
    sign: "Nos leemos el próximo martes.",
    reason: "Recibes este correo porque te inscribiste a la lista de ARTO Studio AI.",
    unsub: "Darme de baja",
    privacy: "Aviso de privacidad",
    sender: "ARTO Group · Agencia creativa desde 2009",
  },
  en: {
    subject: "Worth opening this week · ARTO Studio AI",
    preheader: "Five prompts from the library to open this week.",
    eyebrow: "Weekly digest",
    h: "This week in the",
    accent: "library.",
    intro: "Five prompts from the library worth opening this week, ready to paste into Claude or ChatGPT.",
    list: "Five prompts",
    free: "Free",
    pro: "Pro",
    open: "Open prompt",
    cta: "Browse the full library",
    studio: "From the studio",
    roastT: "Free Brand Roast",
    roastB: "Your brand scored in 20 seconds, quoting your own copy.",
    roastC: "Roast my brand",
    packT: "ARTO Brand Strategy Pack",
    packB: "Five skills for Claude and ChatGPT. Join the list and hear first.",
    packC: "Join the list",
    sign: "Talk next Tuesday.",
    reason: "You're receiving this because you joined the ARTO Studio AI list.",
    unsub: "Unsubscribe",
    privacy: "Privacy",
    sender: "ARTO Group · Creative agency since 2009",
  },
} as const;

export function digestEmail({ lang, prompts, unsubscribeUrl }: DigestInput) {
  const t = COPY[lang];
  const tierLabel = (p: DigestPrompt) => (p.tier === "free" ? t.free : t.pro);
  const title = (p: DigestPrompt) => (lang === "es" ? p.title_es || p.title_en : p.title_en || p.title_es);

  const pill = (p: DigestPrompt) =>
    p.tier === "free"
      ? `<span style="display:inline-block;border:1px solid ${C.line};color:${C.ink2};border-radius:999px;padding:2px 9px;font-size:10px;letter-spacing:1.4px;">${tierLabel(p)}</span>`
      : `<span style="display:inline-block;background:${C.accent};color:${C.white};border-radius:999px;padding:3px 10px;font-size:10px;letter-spacing:1.4px;">${tierLabel(p)}</span>`;

  const cards = prompts
    .map((p, i) => {
      const url = digestUrl(`/prompts/${p.id}`, lang, p.id);
      return `
      <tr><td style="padding:0 0 12px 0;">
        <a href="${esc(url)}" style="text-decoration:none;display:block;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:14px;"><tr>
          <td width="58" valign="top" style="padding:18px 0 18px 18px;font-family:${F.serif};font-style:italic;font-weight:600;font-size:34px;line-height:34px;color:${C.accent};">${String(i + 1).padStart(2, "0")}</td>
          <td valign="top" style="padding:18px 18px 18px 6px;">
            <div style="font-family:${F.meta};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${C.ink3};font-weight:600;">${esc(categoryLabel(p.category, lang))} &nbsp;${pill(p)}</div>
            <div style="font-family:${F.display};font-size:18px;line-height:24px;font-weight:800;color:${C.ink};letter-spacing:-0.3px;margin-top:7px;">${esc(title(p))}</div>
            <div style="font-family:${F.meta};font-size:13px;font-weight:600;color:${C.accent};margin-top:9px;">${t.open} &rarr; <span style="color:${C.ink3};font-weight:500;letter-spacing:1px;">${esc(p.id)}</span></div>
          </td>
        </tr></table>
        </a>
      </td></tr>`;
    })
    .join("");

  const libraryUrl = digestUrl("/prompts", lang, "biblioteca");
  const body = `
    ${hero({ eyebrow: t.eyebrow, title: t.h, accent: t.accent, intro: t.intro })}
    <div style="margin:28px 0 12px 0;">${eyebrow(t.list)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
    <div style="margin-top:14px;">${button(t.cta, libraryUrl, "dark")}</div>
    <div style="border-top:1px solid ${C.line};margin:28px 0 18px 0;padding-top:26px;">${eyebrow(t.studio, C.accent)}</div>
    ${tiles([
      { character: "hat", title: t.roastT, body: t.roastB, cta: t.roastC, href: digestUrl("/roast", lang, "roast") },
      { character: "runner", title: t.packT, body: t.packB, cta: t.packC, href: digestUrl("/skills", lang, "pack") },
    ])}
    ${signoff(t.sign)}`;

  const text = [
    `${t.h} ${t.accent}`,
    "",
    t.intro,
    "",
    ...prompts.map((p) => `- ${title(p)} (${p.id}, ${categoryLabel(p.category, lang)}, ${tierLabel(p)}): ${digestUrl(`/prompts/${p.id}`, lang, p.id)}`),
    "",
    `${t.cta}: ${libraryUrl}`,
    "",
    `${t.studio}:`,
    `- ${t.roastT}: ${t.roastB} ${digestUrl("/roast", lang, "roast")}`,
    `- ${t.packT}: ${t.packB} ${digestUrl("/skills", lang, "pack")}`,
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
