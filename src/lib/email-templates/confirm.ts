import { SITE_URL } from "@/lib/site-url";
import { C, F, button, eyebrow, layout } from "./layout";

/* Correo de confirmacion del doble opt-in (2026-10-07). Sale a quien marco la casilla de
 * promociones en el Brand Roast; hasta que confirme no entra a la lista. */
export function listConfirmationEmail(lang: "es" | "en", confirmUrl: string) {
  const es = lang === "es";
  const t = es
    ? {
        subject: "Confirma tu inscripción a ARTO Studio AI",
        pre: "Un clic y quedas en la lista.",
        eyebrow: "Un paso más",
        h: "Confirma tu",
        accent: "correo.",
        body: "Marcaste la casilla para recibir prompts nuevos, guías y promociones de ARTO Studio AI. Confírmalo con el botón y te mandamos la bienvenida.",
        cta: "Sí, inscribirme",
        note: "Si no fuiste tú, ignora este correo: no te vamos a inscribir.",
        reason: "Recibes este correo porque alguien pidió inscribir esta dirección a la lista de ARTO Studio AI desde el Brand Roast.",
      }
    : {
        subject: "Confirm your ARTO Studio AI subscription",
        pre: "One click and you're on the list.",
        eyebrow: "One more step",
        h: "Confirm your",
        accent: "email.",
        body: "You ticked the box to receive new prompts, guides and promotions from ARTO Studio AI. Confirm with the button and we'll send you the welcome.",
        cta: "Yes, subscribe me",
        note: "If this wasn't you, ignore this email: we won't subscribe you.",
        reason: "You're receiving this because someone asked to add this address to the ARTO Studio AI list from the Brand Roast.",
      };
  const body = `
    ${eyebrow(t.eyebrow, C.accent)}
    <div class="h1" style="font-family:${F.display};font-size:42px;line-height:46px;font-weight:800;letter-spacing:-1.5px;color:${C.ink};margin:14px 0 0 0;">${t.h} <span style="font-family:${F.serif};font-style:italic;font-weight:600;font-size:50px;color:${C.accent};">${t.accent}</span></div>
    <div style="font-family:${F.body};font-size:17px;line-height:27px;color:${C.ink2};margin:18px 0 24px 0;">${t.body}</div>
    ${button(t.cta, confirmUrl, "accent")}
    <div style="font-family:${F.body};font-size:13px;line-height:20px;color:${C.ink3};margin-top:18px;">${t.note}</div>`;
  return {
    subject: t.subject,
    html: layout({ lang, preheader: t.pre, body, reason: t.reason }),
    text: `${t.h} ${t.accent}\n\n${t.body}\n\n${t.cta}: ${confirmUrl}\n\n${t.note}\n\n${t.reason}\n${SITE_URL}`,
  };
}
