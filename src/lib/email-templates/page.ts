import { SITE_URL } from "@/lib/site-url";

/* Paginas simples de confirmacion y baja (2026-10-07), con la linea de la marca. Las
 * acciones van por POST desde un boton: los escaneres de enlaces de Outlook o Proofpoint
 * abren los GET y no deben confirmar ni dar de baja a nadie (auditoria de Fable, PR #76). */
export function actionPage(opts: {
  lang: "es" | "en";
  title: string;
  body: string;
  action?: { url: string; label: string };
  status?: number;
}): Response {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const form = opts.action
    ? `<form method="post" action="${esc(opts.action.url)}"><input type="hidden" name="via" value="page"><button type="submit" style="margin-top:22px;background:#18181b;color:#fff;border:0;border-radius:6px;padding:12px 18px;font:600 14px 'Geist',Helvetica,Arial,sans-serif;cursor:pointer;">${esc(opts.action.label)}</button></form>`
    : `<a href="${SITE_URL}/${opts.lang}" style="display:inline-block;margin-top:22px;color:#18181b;font:600 14px 'Geist',Helvetica,Arial,sans-serif;">${opts.lang === "es" ? "Ir a ARTO Studio AI" : "Go to ARTO Studio AI"} →</a>`;
  const html = `<!doctype html><html lang="${opts.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(opts.title)} · ARTO Studio AI</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600&family=Inter+Tight:wght@400;500&family=Manrope:wght@800&display=swap" rel="stylesheet"></head>
<body style="margin:0;background:#f4f2ee;font-family:'Inter Tight',Helvetica,Arial,sans-serif;color:#18181b;">
<main style="max-width:520px;margin:64px auto;padding:0 16px;">
<img src="${SITE_URL}/brand/arto-logo-black.png" width="78" height="27" alt="arto">
<div style="background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:36px 32px;margin-top:20px;">
<h1 style="font-family:'Manrope',Helvetica,Arial,sans-serif;font-weight:800;font-size:32px;letter-spacing:-1px;margin:0;">${esc(opts.title)}</h1>
<p style="font-size:16px;line-height:25px;color:#52525b;margin:14px 0 0 0;">${esc(opts.body)}</p>
${form}
</div></main></body></html>`;
  return new Response(html, { status: opts.status ?? 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
