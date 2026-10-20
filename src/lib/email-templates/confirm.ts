import { SITE_URL } from "@/lib/site-url";
import { C, F, button, hero, layout } from "./layout";

/* Correo de confirmacion del doble opt-in (2026-10-07). Sale a quien marco la casilla de
 * promociones en el Brand Roast o, desde el 2026-10-16, en una lista de espera; hasta que
 * confirme no entra a la lista. `origin` solo cambia la linea de por que le llega. */
export type ListOrigin = "roast" | "pack_waitlist" | "agents_waitlist" | "waitlist";

const ORIGIN = {
  es: {
    roast: "desde el Brand Roast",
    pack_waitlist: "desde la lista de espera del Pack ARTO",
    agents_waitlist: "desde la lista de espera de Agentes",
    waitlist: "desde una lista de espera",
  },
  en: {
    roast: "from the Brand Roast",
    pack_waitlist: "from the ARTO Pack waitlist",
    agents_waitlist: "from the Agents waitlist",
    waitlist: "from a waitlist",
  },
} as const satisfies Record<"es" | "en", Record<ListOrigin, string>>;

export function listConfirmationEmail(lang: "es" | "en", confirmUrl: string, origin: ListOrigin = "roast") {
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
        reason: `Recibes este correo porque alguien pidió inscribir esta dirección a la lista de ARTO Studio AI ${ORIGIN.es[origin]}.`,
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
        reason: `You're receiving this because someone asked to add this address to the ARTO Studio AI list ${ORIGIN.en[origin]}.`,
      };
  const body = `
    ${hero({ eyebrow: t.eyebrow, title: t.h, accent: t.accent, intro: t.body })}
    <div style="margin-top:26px;">${button(t.cta, confirmUrl, "accent")}</div>
    <div style="font-family:${F.body};font-size:13px;line-height:20px;color:${C.ink3};margin-top:18px;">${t.note}</div>`;
  return {
    subject: t.subject,
    html: layout({ lang, preheader: t.pre, body, reason: t.reason }),
    text: `${t.h} ${t.accent}\n\n${t.body}\n\n${t.cta}: ${confirmUrl}\n\n${t.note}\n\n${t.reason}\n${SITE_URL}`,
  };
}
