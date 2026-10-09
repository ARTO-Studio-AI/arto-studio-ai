import type { RoastLang, RoastResult } from "@/lib/roast-types";
import { SITE_URL } from "@/lib/site-url";
import { C, F, button, esc, eyebrow, layout, scoreColor } from "./layout";

/* Correo "Tu Brand Roast" (2026-10-07). Transaccional: lo pidio la persona al dejar su
 * correo para ver el reporte. Lleva el roast completo, la imagen del resultado y los
 * botones para descargar y compartir; termina invitando a los prompts. */

export interface RoastReportInput {
  lang: RoastLang;
  brand: string;
  industry?: string;
  result: RoastResult;
  /** Query firmada del enlace compartido (roast-share), sin "?". */
  shareQuery: string;
}

export function roastReportEmail({ lang, brand, result, shareQuery }: RoastReportInput) {
  const es = lang === "es";
  const shareUrl = `${SITE_URL}/${lang}/roast?${shareQuery}`;
  const img = (format: string) => `${SITE_URL}/roast/og?${shareQuery}&format=${format}`;
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const xText = es
    ? `Mi marca "${brand}" sacó ${result.overall}/10 en el Brand Roast de ARTO. ¿Y la tuya?`
    : `My brand "${brand}" scored ${result.overall}/10 on ARTO's Brand Roast. What about yours?`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(shareUrl)}`;
  const t = es
    ? {
        subject: `Tu Brand Roast: ${brand} sacó ${result.overall}/10`,
        pre: result.headline || `El análisis completo de ${brand}, listo para compartir.`,
        eyebrow: "Tu Brand Roast",
        scoreFor: "ARTO Score de",
        pillars: ["Estrategia", "Creatividad", "Narrativa", "Digital"],
        verdict: "El veredicto",
        evidence: "En qué nos basamos",
        start: "Por dónde empezar",
        shareH: "Compártelo",
        shareBody: "Descarga la imagen para Instagram o comparte el enlace: se ve con tu resultado y una invitación a que otros hagan el suyo.",
        feed: "Descargar feed 1:1",
        story: "Descargar story 9:16",
        nextH: "¿Y ahora qué?",
        nextBody: "Empieza hoy con más de 3,000 prompts de marca escritos por estrategas de ARTO. Si prefieres que lo arreglemos contigo, contesta este correo.",
        prompts: "Explorar prompts gratis",
        again: "Roastear otra marca",
        reason: "Recibes este correo porque pediste tu reporte del Brand Roast en creative.artostudio.ai.",
      }
    : {
        subject: `Your Brand Roast: ${brand} scored ${result.overall}/10`,
        pre: result.headline || `The full analysis of ${brand}, ready to share.`,
        eyebrow: "Your Brand Roast",
        scoreFor: "ARTO Score for",
        pillars: ["Strategy", "Creativity", "Narrative", "Digital"],
        verdict: "The verdict",
        evidence: "What we based it on",
        start: "Where to start",
        shareH: "Share it",
        shareBody: "Download the image for Instagram or share the link: it shows your result and invites others to roast theirs.",
        feed: "Download feed 1:1",
        story: "Download story 9:16",
        nextH: "Now what?",
        nextBody: "Start today with 3,000+ brand prompts written by ARTO strategists. If you'd rather fix it with us, just reply to this email.",
        prompts: "Browse free prompts",
        again: "Roast another brand",
        reason: "You're receiving this because you requested your Brand Roast report on creative.artostudio.ai.",
      };

  const pillars: Array<[string, { score: number; roast: string }]> = [
    [t.pillars[0], result.strategy],
    [t.pillars[1], result.creativity],
    [t.pillars[2], result.narrative],
    [t.pillars[3], result.digital],
  ];

  const pillarRows = pillars
    .map(
      ([label, p]) => `
      <tr><td style="padding:18px 0;border-top:1px solid ${C.line};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>${eyebrow(label)}</td>
          <td align="right" style="font-family:${F.display};font-size:24px;font-weight:800;color:${C.ink};">${p.score}<span style="font-family:${F.meta};font-size:12px;color:${C.ink3};font-weight:500;">/10</span></td>
        </tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 10px 0;"><tr>
          <td width="${Math.max(4, p.score * 10)}%" style="height:6px;background:${scoreColor(p.score)};border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>
          <td style="height:6px;background:#f4f4f5;border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
        <div style="font-family:${F.body};font-size:15px;line-height:23px;color:${C.ink2};">${esc(p.roast)}</div>
      </td></tr>`,
    )
    .join("");

  const evidence = (result.evidence ?? [])
    .map((e) => `<li style="margin:0 0 8px 0;">${esc(e)}</li>`)
    .join("");
  const improvements = result.improvements
    .map(
      (imp, i) => `<tr><td valign="top" style="padding:0 12px 12px 0;"><div style="width:24px;height:24px;border-radius:12px;background:${C.ink};color:${C.white};font-family:${F.meta};font-size:12px;line-height:24px;text-align:center;">${i + 1}</div></td><td style="padding:0 0 12px 0;font-family:${F.body};font-size:15px;line-height:23px;color:${C.ink2};">${esc(imp)}</td></tr>`,
    )
    .join("");

  const body = `
    ${eyebrow(t.eyebrow, C.accent)}
    <a href="${esc(shareUrl)}" style="display:block;margin:18px 0 24px 0;"><img src="${esc(img("default"))}" width="526" alt="${esc(`${brand} ${result.overall}/10`)}" style="display:block;width:100%;max-width:526px;height:auto;border-radius:12px;border:1px solid ${C.line};"></a>
    ${eyebrow(t.scoreFor)}
    <div class="h1" style="font-family:${F.display};font-size:40px;line-height:44px;font-weight:800;letter-spacing:-1px;color:${C.ink};margin:6px 0 0 0;">${esc(brand)}</div>
    <div class="score" style="font-family:${F.display};font-size:104px;line-height:100px;font-weight:800;letter-spacing:-4px;color:${scoreColor(result.overall)};margin:4px 0 0 0;">${result.overall}<span style="font-family:${F.meta};font-size:22px;letter-spacing:0;color:${C.ink3};font-weight:500;">/10</span></div>
    ${result.headline ? `<div style="font-family:${F.serif};font-style:italic;font-size:26px;line-height:32px;color:${C.ink};margin:14px 0 26px 0;">“${esc(result.headline)}”</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${pillarRows}</table>
    <div style="background:${C.paper};border-radius:12px;padding:22px 22px;margin:22px 0 0 0;">
      ${eyebrow(t.verdict)}
      <div style="font-family:${F.body};font-size:17px;line-height:26px;color:${C.ink};font-weight:500;margin-top:10px;">${esc(result.verdict)}</div>
    </div>
    ${evidence ? `<div style="margin:26px 0 0 0;">${eyebrow(t.evidence)}<ul style="font-family:${F.body};font-size:15px;line-height:23px;color:${C.ink2};padding-left:18px;margin:12px 0 0 0;">${evidence}</ul></div>` : ""}
    <div style="margin:26px 0 0 0;">${eyebrow(t.start)}<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">${improvements}</table></div>
    <div style="border-top:1px solid ${C.line};margin:26px 0 0 0;padding-top:24px;">
      ${eyebrow(t.shareH, C.accent)}
      <div style="font-family:${F.body};font-size:15px;line-height:23px;color:${C.ink2};margin:10px 0 16px 0;">${esc(t.shareBody)}</div>
      ${button(t.feed, img("square"), "dark")}${button(t.story, img("story"), "dark")}${button("LinkedIn", linkedin, "light")}${button("X", xUrl, "light")}
    </div>
    <div style="background:${C.ink};border-radius:12px;padding:26px 24px;margin:24px 0 0 0;">
      <div style="font-family:${F.display};font-size:26px;line-height:30px;font-weight:800;color:${C.white};letter-spacing:-0.5px;">${esc(t.nextH)}</div>
      <div style="font-family:${F.body};font-size:15px;line-height:23px;color:#d4d4d8;margin:10px 0 18px 0;">${esc(t.nextBody)}</div>
      ${button(t.prompts, `${SITE_URL}/${lang}/prompts`, "accent")}${button(t.again, `${SITE_URL}/${lang}/roast`, "light")}
    </div>`;

  const text = [
    `${t.scoreFor} ${brand}: ${result.overall}/10`,
    result.headline ? `"${result.headline}"` : "",
    "",
    ...pillars.map(([l, p]) => `${l}: ${p.score}/10\n${p.roast}\n`),
    `${t.verdict}: ${result.verdict}`,
    "",
    `${t.start}:`,
    ...result.improvements.map((x, i) => `${i + 1}. ${x}`),
    "",
    `${t.shareH}: ${shareUrl}`,
    `${t.feed}: ${img("square")}`,
    `${t.story}: ${img("story")}`,
    "",
    `${t.prompts}: ${SITE_URL}/${lang}/prompts`,
    "",
    t.reason,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { subject: t.subject, html: layout({ lang, preheader: t.pre, body, reason: t.reason }), text };
}
