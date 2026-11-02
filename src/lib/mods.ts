import type { Locale } from "@/i18n/config";

/* Sección de Mods (Victor, 30 oct 2026): página pública con los mods de Claude Code que ASAI
 * auditó; la descarga será solo para planes de pago. Solo entra aquí un mod con su ficha de
 * auditoría aprobada en mods/ de Drive (skill asai-auditoria-de-mods). MOD01 sale el 9 nov. */

export type ModStatus = "upcoming" | "published";

export interface Mod {
  code: string;
  slug: string;
  name: string;
  status: ModStatus;
  releaseDate: string; // AAAA-MM-DD
  version: string;
  author: string;
  license: string;
  copy: Record<Locale, { tagline: string; what: string; checked: string[] }>;
}

export const MODS: Mod[] = [
  {
    code: "MOD01",
    slug: "auto-handoff",
    name: "auto-handoff",
    status: "upcoming",
    releaseDate: "2026-11-09",
    version: "0.8.6-asai",
    author: "Alex Hillman",
    license: "MIT",
    copy: {
      es: {
        tagline: "Cuando a tu sesión de Claude Code se le acaba el contexto, deja un parte para la siguiente.",
        what: "Escribe un resumen de lo que estabas haciendo, lo que falta y las decisiones tomadas, y la sesión nueva arranca leyéndolo. Instalas la copia que revisamos, con nuestras plantillas.",
        checked: ["Código leído completo en una versión fija, con huellas SHA-256", "Qué sale de tu equipo y a dónde", "Prueba en vivo con trabajo real", "Guía de instalación en español"],
      },
      en: {
        tagline: "When your Claude Code session runs out of context, it leaves a brief for the next one.",
        what: "It writes a summary of what you were doing, what's left and the decisions made, and the new session starts by reading it. You install the copy we reviewed, with our templates.",
        checked: ["Full code read at a pinned version, with SHA-256 checksums", "What leaves your machine and where it goes", "Live test with real work", "Installation guide in Spanish and English"],
      },
    },
  },
];

export function formatModDate(iso: string, locale: Locale): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { day: "numeric", month: "long", timeZone: "UTC" });
}
