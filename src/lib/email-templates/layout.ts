import { SITE_URL } from "@/lib/site-url";

/* Plantilla base de los correos. v1 (2026-10-07): papel calido, tarjeta blanca, acento
 * naranja, titulares pesados, citas en serif y etiquetas en mayusculas. v2 (2026-10-20,
 * pedido de Victor: «que tenga mas diseno, con los ajustes del branding»): la tarjeta abre
 * con el banner del canal (logotipo «arto Studio AI», la linea «Prompts, skills y agentes ·
 * para el mundo creativo» y cuatro personajes en las esquinas), que Victor pidio poner en
 * todos los correos porque le recuerda a la gente que es el producto. Imagen en ES y EN:
 * public/email/header-es.png y header-en.png (1200x500, se ve a 600x250).
 *
 * HTML de tablas con estilos en linea: es lo unico que respetan Gmail, Outlook y Apple
 * Mail. Las fuentes de marca se piden con fallback seguro (los clientes que no las cargan
 * usan Helvetica/Arial y Georgia); por eso el logotipo va como imagen y no como texto.
 *
 * Regla (Victor, 16 oct): todo correo de ASAI pasa por `layout()`. Un correo nuevo usa
 * `hero()` con un personaje y, si lista cosas, `checks()` o `tile()`. */

export const C = {
  paper: "#f4f2ee",
  white: "#ffffff",
  ink: "#18181b",
  ink2: "#52525b",
  ink3: "#a1a1aa",
  line: "#e4e4e7",
  accent: "#ff4d00",
  accentSoft: "#fff1ea",
  ok: "#16a34a",
  warn: "#d97706",
  bad: "#dc2626",
};

export const F = {
  display: "'Manrope','Helvetica Neue',Helvetica,Arial,sans-serif",
  body: "'Inter Tight','Helvetica Neue',Helvetica,Arial,sans-serif",
  meta: "'Geist','Helvetica Neue',Helvetica,Arial,sans-serif",
  serif: "'Cormorant Garamond',Georgia,'Times New Roman',serif",
};

/* Personajes de ARTO (public/brand). Ancho y alto en pixeles del archivo, para que cada
 * cliente reserve el espacio aunque bloquee imagenes. */
export const CHARACTERS = {
  hand: { src: "/brand/arto-character-01.png", w: 290, h: 273 },
  cloud: { src: "/brand/characters/character-02.png", w: 439, h: 273 },
  hat: { src: "/brand/characters/character-03.png", w: 280, h: 183 },
  bird: { src: "/brand/characters/character-04.png", w: 267, h: 273 },
  runner: { src: "/brand/characters/character-05.png", w: 267, h: 273 },
} as const;
export type Character = keyof typeof CHARACTERS;

/** Banner de cabecera (1200x500, a 600x250 en el correo). */
export const HEADER = { es: "/email/header-es.png", en: "/email/header-en.png", w: 600, h: 250 };

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function scoreColor(n: number): string {
  return n >= 7 ? C.ok : n >= 5 ? C.warn : C.bad;
}

export function eyebrow(text: string, color: string = C.ink2): string {
  return `<div style="font-family:${F.meta};font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:${color};font-weight:600;">${esc(text)}</div>`;
}

export function button(label: string, href: string, variant: "dark" | "light" | "accent" = "dark"): string {
  const bg = variant === "dark" ? C.ink : variant === "accent" ? C.accent : C.white;
  const fg = variant === "light" ? C.ink : C.white;
  const border = variant === "light" ? C.line : bg;
  return `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${fg};border:1px solid ${border};border-radius:999px;padding:13px 22px;font-family:${F.meta};font-size:14px;font-weight:600;text-decoration:none;margin:0 8px 8px 0;">${esc(label)}</a>`;
}

/** Imagen de un personaje a `height` pixeles de alto. */
export function character(name: Character, height: number, alt = ""): string {
  const c = CHARACTERS[name];
  const w = Math.round((c.w / c.h) * height);
  return `<img src="${SITE_URL}${c.src}" width="${w}" height="${height}" alt="${esc(alt)}" style="display:block;border:0;width:${w}px;height:${height}px;">`;
}

/**
 * Cabecera del cuerpo: etiqueta, titular con la palabra clave en Cormorant naranja,
 * personaje a la derecha e introduccion debajo. Todo el texto llega ya sin escapar.
 */
export function hero(opts: { eyebrow: string; title: string; accent: string; intro?: string; character?: Character }): string {
  const art = opts.character
    ? `<td class="hero-art" width="104" align="right" valign="top" style="padding:0 0 0 12px;">${character(opts.character, 92)}</td>`
    : "";
  const intro = opts.intro
    ? `<div style="font-family:${F.body};font-size:17px;line-height:27px;color:${C.ink2};margin:18px 0 0 0;">${esc(opts.intro)}</div>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top">
        ${eyebrow(opts.eyebrow, C.accent)}
        <div class="h1" style="font-family:${F.display};font-size:44px;line-height:48px;font-weight:800;letter-spacing:-1.5px;color:${C.ink};margin:14px 0 0 0;">${esc(opts.title)} <span style="font-family:${F.serif};font-style:italic;font-weight:600;font-size:52px;letter-spacing:-0.5px;color:${C.accent};">${esc(opts.accent)}</span></div>
      </td>${art}
    </tr></table>${intro}`;
}

/** Lista con la casilla naranja de las piezas de la campana. Texto sin escapar. */
export function checks(items: string[]): string {
  const rows = items
    .map(
      (it) => `<tr>
        <td width="34" valign="top" style="padding:0 0 12px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="22" height="22" bgcolor="${C.accent}" align="center" valign="middle" style="width:22px;height:22px;background:${C.accent};border-radius:6px;color:${C.white};font-family:${F.meta};font-size:14px;line-height:22px;font-weight:700;">&#10003;</td></tr></table></td>
        <td valign="top" style="padding:1px 0 12px 0;font-family:${F.body};font-size:16px;line-height:23px;color:${C.ink};">${esc(it)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

/**
 * Dos tarjetas lado a lado (se apilan en el telefono). Cada una con personaje, titulo,
 * texto y enlace. Texto sin escapar.
 */
export function tiles(items: Array<{ character: Character; title: string; body: string; cta: string; href: string }>): string {
  const cell = (t: (typeof items)[number]) => `<div class="tile" style="display:inline-block;vertical-align:top;width:48%;min-width:220px;box-sizing:border-box;margin:0 0 12px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border-radius:14px;"><tr><td style="padding:20px 20px 18px 20px;">
        ${character(t.character, 44)}
        <div style="font-family:${F.display};font-size:18px;line-height:23px;font-weight:800;letter-spacing:-0.3px;color:${C.ink};margin-top:14px;">${esc(t.title)}</div>
        <div style="font-family:${F.body};font-size:14px;line-height:21px;color:${C.ink2};margin-top:6px;">${esc(t.body)}</div>
        <a href="${esc(t.href)}" style="display:inline-block;font-family:${F.meta};font-size:13px;font-weight:600;color:${C.accent};text-decoration:none;margin-top:12px;">${esc(t.cta)} &rarr;</a>
      </td></tr></table>
    </div>`;
  return `<div style="font-size:0;line-height:0;">${items.map((t, i) => (i % 2 === 1 ? `<div style="display:inline-block;width:4%;"></div>` : "") + cell(t)).join("")}</div>`;
}

/** Firma de cierre: frase en Cormorant y «ARTO Studio AI» en mayusculas. */
export function signoff(line: string): string {
  return `<div style="font-family:${F.serif};font-style:italic;font-size:21px;line-height:27px;color:${C.ink};margin:28px 0 0 0;">${esc(line)}</div>
    <div style="font-family:${F.meta};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.ink2};margin-top:6px;">ARTO Studio AI</div>`;
}

export interface LayoutInput {
  lang: "es" | "en";
  preheader: string;
  body: string;
  /** Pie: por que recibe el correo. */
  reason: string;
  unsubscribeUrl?: string;
}

const TAGLINE = {
  es: "Prompts, skills y agentes · para el mundo creativo",
  en: "Prompts, skills and agents · for the creative world",
};

export function layout({ lang, preheader, body, reason, unsubscribeUrl }: LayoutInput): string {
  const unsub = unsubscribeUrl
    ? ` · <a href="${esc(unsubscribeUrl)}" style="color:${C.ink2};text-decoration:underline;">${lang === "es" ? "Darme de baja" : "Unsubscribe"}</a>`
    : "";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>ARTO Studio AI</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Geist:wght@500;600&family=Inter+Tight:wght@400;500;600&family=Manrope:wght@800&display=swap" rel="stylesheet">
<style>
  @media (max-width:620px){
    .card{padding:28px 20px !important;}
    .h1{font-size:34px !important;line-height:38px !important;}
    .h1 span{font-size:40px !important;}
    .score{font-size:84px !important;}
    .hero-art img{width:64px !important;height:auto !important;}
    .hero-art{width:72px !important;}
    .tile{width:100% !important;}
  }
  a{color:${C.ink};}
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:28px 12px 36px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
      <tr><td style="background:#fafafa;border-radius:20px 20px 0 0;border:1px solid ${C.line};border-bottom:0;font-size:0;line-height:0;">
        <a href="${SITE_URL}/${lang}"><img src="${SITE_URL}${HEADER[lang]}" width="${HEADER.w}" alt="arto Studio AI · ${esc(TAGLINE[lang])}" style="display:block;border:0;width:100%;max-width:${HEADER.w}px;height:auto;border-radius:20px 20px 0 0;"></a>
      </td></tr>
      <tr><td class="card" style="background:${C.white};border-radius:0 0 20px 20px;padding:36px 36px 40px 36px;border:1px solid ${C.line};border-top:1px solid ${C.line};">
        ${body}
      </td></tr>
      <tr><td align="center" style="padding:26px 6px 0 6px;font-family:${F.meta};font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${C.ink2};">${esc(TAGLINE[lang])}</td></tr>
      <tr><td align="center" style="padding:12px 6px 0 6px;font-family:${F.body};font-size:12px;line-height:18px;color:${C.ink2};">
        ${esc(reason)}<br>
        ARTO Group · ${lang === "es" ? "Agencia creativa desde 2009" : "Creative agency since 2009"} · <a href="${SITE_URL}/${lang}/privacy" style="color:${C.ink2};text-decoration:underline;">${lang === "es" ? "Aviso de privacidad" : "Privacy"}</a>${unsub}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
