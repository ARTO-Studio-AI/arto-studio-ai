import type { Locale } from "@/i18n/config";

/* Revisiones publicas (Victor, 17 nov 2026): herramientas de otras empresas que ASAI reviso y
 * cuya revision vive en una pagina propia de artostudio.ai. No son mods de Claude Code (esos van
 * en catalogo/mods.json, con descarga en planes de pago): aqui solo va el enlace a la revision.
 * Cada una necesita su ficha de verificacion en mods/ de Drive (skill asai-auditoria-de-mods).
 * La URL de la revision no cambia: ManyChat (palabra NOMAD) manda gente ahi. */

export interface Review {
  slug: string;
  name: string;
  author: string;
  version: string;
  reviewedOn: string; // AAAA-MM-DD
  href: string;
  poster: { src: string; w: number; h: number };
  copy: Record<Locale, { title: string; body: string; verdict: string; cta: string; video: string }>;
}

export const REVIEWS: readonly Review[] = [
  {
    slug: "project-nomad",
    name: "Project NOMAD",
    author: "Crosstalk Solutions",
    version: "1.35.1",
    reviewedOn: "2026-11-17",
    href: "https://artostudio.ai/mods/project-nomad/",
    poster: { src: "/brand/reviews/project-nomad-poster.jpg", w: 720, h: 1280 },
    copy: {
      es: {
        title: "Project NOMAD: lo que tienes que saber antes de instalarlo",
        body: "Una computadora que sigue funcionando cuando se cae internet: Wikipedia, cursos, mapas y una IA que corre en tu máquina. Es gratis y de código abierto.",
        verdict: "Nuestra recomendación: úsalo solo en una computadora dedicada, conectada a una red aparte.",
        cta: "Leer la revisión",
        video: "Video de 80 s",
      },
      en: {
        title: "Project NOMAD: what to know before you install it",
        body: "A computer that keeps working when the internet goes down: Wikipedia, courses, maps and an AI that runs on your machine. Free and open source.",
        verdict: "Our recommendation: use it only on a dedicated computer, on a separate network.",
        cta: "Read the review",
        video: "80 s video",
      },
    },
  },
];

export const REVIEW_LABELS: Record<Locale, { eyebrow: string; h2: string; intro: string; reviewed: string; version: string; notAffiliated: string }> = {
  es: {
    eyebrow: "Mods revisados",
    h2: "Lo último que revisamos",
    intro: "Antes de recomendar una herramienta de IA de otra empresa, leemos su código y te contamos qué encontramos, en palabras claras.",
    reviewed: "Revisado el",
    version: "versión",
    notAffiliated: "no estamos afiliados",
  },
  en: {
    eyebrow: "Reviewed mods",
    h2: "Our latest review",
    intro: "Before we recommend an AI tool from another company, we read its code and tell you what we found, in plain words.",
    reviewed: "Reviewed on",
    version: "version",
    notAffiliated: "not affiliated with us",
  },
};

export function formatReviewDate(iso: string, locale: Locale): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
