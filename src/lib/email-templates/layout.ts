import { SITE_URL } from "@/lib/site-url";

/* Plantilla base de los correos (2026-10-07). Misma linea que el sitio: papel calido,
 * tarjeta blanca, acento naranja, titulares pesados, citas en serif y etiquetas en
 * mayusculas. HTML de tablas con estilos en linea: es lo unico que respetan Gmail,
 * Outlook y Apple Mail. Las fuentes de marca se piden con fallback seguro (los clientes
 * que no las cargan usan Helvetica/Arial y Georgia). */

export const C = {
  paper: "#f4f2ee",
  white: "#ffffff",
  ink: "#18181b",
  ink2: "#52525b",
  ink3: "#a1a1aa",
  line: "#e4e4e7",
  accent: "#ff4d00",
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
  return `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:${fg};border:1px solid ${border};border-radius:6px;padding:12px 18px;font-family:${F.meta};font-size:14px;font-weight:600;text-decoration:none;margin:0 8px 8px 0;">${esc(label)}</a>`;
}

export interface LayoutInput {
  lang: "es" | "en";
  preheader: string;
  body: string;
  /** Pie: por que recibe el correo. */
  reason: string;
  unsubscribeUrl?: string;
}

export function layout({ lang, preheader, body, reason, unsubscribeUrl }: LayoutInput): string {
  const logo = `${SITE_URL}/brand/arto-logo-black.png`;
  const unsub = unsubscribeUrl
    ? ` · <a href="${esc(unsubscribeUrl)}" style="color:${C.ink2};text-decoration:underline;">${lang === "es" ? "Darme de baja" : "Unsubscribe"}</a>`
    : "";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>ARTO Studio AI</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Geist:wght@500;600&family=Inter+Tight:wght@400;500;600&family=Manrope:wght@800&display=swap" rel="stylesheet">
<style>
  @media (max-width:620px){ .card{padding:28px 20px !important;} .h1{font-size:34px !important;} .score{font-size:84px !important;} }
  a{color:${C.ink};}
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
      <tr><td style="padding:0 4px 18px 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><a href="${SITE_URL}/${lang}"><img src="${logo}" width="78" height="27" alt="arto" style="display:block;border:0;"></a></td>
          <td align="right" style="font-family:${F.meta};font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:${C.ink2};">Creative 24/7</td>
        </tr></table>
      </td></tr>
      <tr><td class="card" style="background:${C.white};border-radius:16px;padding:40px 36px;border:1px solid ${C.line};">
        ${body}
      </td></tr>
      <tr><td style="padding:22px 6px 0 6px;font-family:${F.body};font-size:12px;line-height:18px;color:${C.ink2};">
        ${esc(reason)}<br>
        ARTO Group · ${lang === "es" ? "Agencia de marca desde 2009" : "Brand agency since 2009"} · <a href="${SITE_URL}/${lang}/privacy" style="color:${C.ink2};text-decoration:underline;">${lang === "es" ? "Aviso de privacidad" : "Privacy"}</a>${unsub}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
