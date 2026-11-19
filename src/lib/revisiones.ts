import type { Locale } from "@/i18n/config";

/* Revisiones publicas (Victor, 17 nov 2026): herramientas de otras empresas que ASAI reviso y
 * cuya revision vive en una pagina propia de artostudio.ai. No son mods de Claude Code (esos van
 * en catalogo/mods.json, con descarga en planes de pago): aqui solo va el enlace a la revision.
 * Cada una necesita su ficha de verificacion en mods/ de Drive (skill asai-auditoria-de-mods).
 * La URL de la revision no cambia: ManyChat (palabra NOMAD) manda gente ahi.
 *
 * Desde el 19 nov 2026 (REA) una revision tambien puede vivir aqui mismo, en
 * /<locale>/mods/revisiones/<slug>: lleva `page` con el texto y `href` relativo. El orden de
 * REVIEWS es del mas reciente al mas viejo; la home muestra REVIEWS[0]. */

export interface Review {
  slug: string;
  name: string;
  author: string;
  version: string;
  reviewedOn: string; // AAAA-MM-DD
  /** URL absoluta (revision en otro sitio) o ruta sin locale que empieza con "/" (vive aqui). */
  href: string;
  /** Poster vertical 9:16 del video. Sin poster, la tarjeta muestra el nombre sobre negro. */
  poster?: { src: string; w: number; h: number };
  copy: Record<Locale, { title: string; body: string; verdict: string; cta: string; video?: string; tag?: string }>;
  /** Texto de la pagina propia en creative. Solo para revisiones con href relativo. */
  page?: Record<Locale, ReviewPage>;
}

/* Plantilla unica de las paginas de mods revisados (Victor, 19 nov 2026): todas siguen el diseno
 * de la de Project NOMAD en artostudio.ai. Cabecera lima con titulo, palabra clave en
 * marcatexto rosa y el video vertical a la derecha; cuerpo blanco con secciones a la izquierda y
 * la ficha rapida lima fija a la derecha. Ver docs/DECISIONES.md. */
export type ReviewSection =
  | { kind: "text"; eyebrow: string; title: string; paragraphs: string[] }
  | { kind: "verdict"; eyebrow: string; strong: string; body: string }
  | { kind: "flags"; eyebrow: string; title: string; intro: string; flags: { badge: string; title: string; body: string }[]; moreLabel?: string; more?: string[] }
  | { kind: "list"; eyebrow: string; title: string; intro?: string; items: string[]; ordered?: boolean; outro?: string[]; askNote?: string };

export interface ReviewPage {
  metaTitle: string;
  metaDescription: string;
  /** Titulo sin la palabra clave; la palabra clave va en marcatexto rosa al final. */
  h1: string;
  h1Key: string;
  lead: string;
  meta: string;
  repoLabel: string;
  repoUrl: string;
  askLabel: string;
  /** Video vertical 9:16 de la cabecera. Sin video, va el recuadro negro con el nombre en lima. */
  media: { tag: string; caption: string; video?: { src: string; poster: string } };
  crumbs: { home: string; mods: string };
  sections: ReviewSection[];
  facts: { title: string; rows: [string, string][] };
  disclaimer: string;
}

/** Ruta publica de una revision: absoluta tal cual, relativa con el prefijo del idioma. */
export function reviewHref(review: Review, locale: Locale): string {
  return review.href.startsWith("/") ? `/${locale}${review.href}` : review.href;
}

export function getReviewPage(slug: string): Review | undefined {
  return REVIEWS.find((r) => r.slug === slug && r.page && r.href.startsWith("/"));
}

export const REVIEWS: readonly Review[] = [
  {
    slug: "rea",
    name: "REA",
    author: "morluto",
    version: "6.9.0",
    reviewedOn: "2026-11-19",
    href: "/mods/revisiones/rea",
    copy: {
      es: {
        title: "REA: lo que tienes que saber antes de instalarlo",
        body: "Un mod para Claude Code que le da a tu agente herramientas de ingeniería inversa: entiende cómo funciona una app sin tener su código. Es gratis y de código abierto.",
        verdict: "Nuestra recomendación: úsalo solo en software tuyo, de un cliente que te dio permiso por escrito o de código abierto.",
        cta: "Leer la revisión",
        tag: "Mod para Claude Code",
      },
      en: {
        title: "REA: what to know before you install it",
        body: "A Claude Code mod that gives your agent reverse engineering tools: it figures out how an app works without its source code. Free and open source.",
        verdict: "Our recommendation: use it only on your own software, a client's software with written permission, or open source projects.",
        cta: "Read the review",
        tag: "Claude Code mod",
      },
    },
    page: {
      es: {
        metaTitle: "REA (Reverse Engineer Anything): revisión de seguridad",
        metaDescription: "Revisamos REA 6.9.0, un mod de ingeniería inversa para Claude Code. Qué hace, qué encontramos en su código y cómo instalarlo con cuidado.",
        h1: "REA: lo que tienes que saber antes de",
        h1Key: "instalarlo",
        lead: "Un mod que le da a tu agente herramientas para entender cómo funciona una app sin tener su código. Revisamos cómo se instala, a qué se conecta y qué instrucciones le da a tu agente.",
        meta: "Revisado por ARTO Studio AI el 19 de noviembre de 2026 · Versión revisada: 6.9.0 · Commit e91ddc8",
        repoLabel: "Repositorio oficial",
        repoUrl: "https://github.com/morluto/rea/tree/e91ddc89f98199a900e5bb7b73c7dbb995f72fb1",
        askLabel: "Pedir la ficha técnica",
        media: { tag: "Mod para Claude Code", caption: "Video explicativo en producción" },
        crumbs: { home: "Inicio", mods: "Mods revisados" },
        sections: [
          {
            kind: "text",
            eyebrow: "Qué es",
            title: "Ingeniería inversa desde tu agente",
            paragraphs: [
              "REA (Reverse Engineer Anything) es un mod para Claude Code: trae un plugin, un servidor MCP y skills con instrucciones. Conecta a tu agente con herramientas como Ghidra, Hopper, IDA y JADX para analizar programas, apps de escritorio, apps de Android, apps de JavaScript y Electron, .NET, firmware y páginas web.",
              "Sirve para entender cómo funciona una app cuando no tienes su código. Corre en tu computadora. Lo publica el usuario morluto en GitHub, con licencia MIT.",
            ],
          },
          {
            kind: "verdict",
            eyebrow: "Nuestra recomendación",
            strong: "Úsalo solo en software tuyo, de un cliente que te dio permiso por escrito o de código abierto.",
            body: "No lo uses para estudiar apps de otras empresas. Muchas apps comerciales prohíben la ingeniería inversa en sus términos de servicio, y el propio aviso de REA pide respetarlos.",
          },
          {
            kind: "flags",
            eyebrow: "Por qué",
            title: "No manda tus datos al autor, pero hay tres puntos a cuidar",
            intro: "Revisamos su instalador, sus 43 dependencias, cada conexión a internet que hace por su cuenta y las instrucciones que le da a tu agente. No encontramos envío de datos a servidores del autor: por su cuenta solo consulta registry.npmjs.org para avisarte si hay versión nueva.",
            flags: [
              { badge: "Punto 1", title: "Los términos de otras apps", body: "Usarlo en apps de otras empresas choca con sus términos de servicio. Úsalo solo donde tienes permiso." },
              { badge: "Punto 2", title: "Es muy grande", body: "Pesa 131 MB y tiene 4,545 archivos de código. Revisamos lo que toca tu equipo (instalación, red, configuración e instrucciones), no cada línea." },
              { badge: "Punto 3", title: "Cambia muy rápido", body: "El último cambio fue minutos antes de nuestra revisión. Esta revisión vale solo para la versión 6.9.0; instala esa versión fija." },
            ],
            moreLabel: "Además:",
            more: [
              "Su instalador escribe en la configuración de Claude Code, Claude Desktop, Codex, Cursor, Gemini y otros. Hace respaldo y pide aprobación; aprueba solo Claude Code.",
              "Una de sus guías le dice al agente que arranque sin preguntar al armar ambientes de prueba. Es para no repetir preguntas, no para saltar permisos.",
              "Sus instrucciones no le piden a tu agente ocultar acciones, leer tus llaves ni apagar permisos. No encontramos texto escondido.",
            ],
          },
          {
            kind: "list",
            eyebrow: "Qué necesitas",
            title: "Equipo y herramientas",
            items: [
              "Claude Code instalado en tu computadora.",
              "Node.js, para correr el instalador con npx.",
              "Las herramientas que quieras usar con él: Ghidra, Hopper, IDA o JADX. Hopper lo descarga con tu aprobación.",
            ],
          },
          {
            kind: "list",
            eyebrow: "Si lo quieres probar",
            title: "Tres pasos para instalarlo",
            ordered: true,
            items: [
              "Fija la versión revisada y mira primero qué cambiaría: npx rea-agents@6.9.0 setup --dry-run",
              "Revisa los cambios que propone y aprueba solo Claude Code.",
              "Corre el mismo comando sin --dry-run.",
            ],
            outro: [
              "Para quitarlo: npx rea-agents@6.9.0 uninstall, o borra la entrada «rea» de la configuración MCP de Claude Code.",
            ],
            askNote: "La ficha técnica completa, con cada hallazgo y las huellas de los archivos revisados, está disponible para quien la quiera revisar. Pídela en",
          },
          {
            kind: "text",
            eyebrow: "Qué no revisamos",
            title: "Los límites de esta revisión",
            paragraphs: [
              "No leímos su código completo línea por línea ni los cinco paquetes de terceros que trae. No lo instalamos ni lo probamos en vivo. No revisamos a fondo sus binarios nativos ni sus puentes con Ghidra y Hopper. No podemos garantizar qué hará tu agente con sus 48 KB de instrucciones en cada conversación, y no verificamos la identidad del autor. Esta revisión vale para la versión 6.9.0; cada versión nueva necesita otra revisión.",
              "Próxima revisión: con la siguiente versión mayor o en febrero de 2027.",
            ],
          },
        ],
        facts: {
          title: "Ficha rápida",
          rows: [
            ["Programa", "REA (Reverse Engineer Anything)"],
            ["Autor", "morluto"],
            ["Tipo", "Mod para Claude Code"],
            ["Versión revisada", "6.9.0"],
            ["Licencia", "MIT, gratis"],
            ["Veredicto", "Solo con permiso del dueño del software"],
            ["Fecha", "19 nov 2026"],
          ],
        },
        disclaimer: "ARTO Studio AI no está afiliado a morluto. Esta revisión no garantiza que el programa sea seguro; describe lo que encontramos en su código.",
      },
      en: {
        metaTitle: "REA (Reverse Engineer Anything): security review",
        metaDescription: "We reviewed REA 6.9.0, a reverse engineering mod for Claude Code. What it does, what we found in its code and how to install it carefully.",
        h1: "REA: what to know before you",
        h1Key: "install it",
        lead: "A mod that gives your agent tools to figure out how an app works without its source code. We reviewed how it installs, what it connects to and what instructions it gives your agent.",
        meta: "Reviewed by ARTO Studio AI on November 19, 2026 · Version reviewed: 6.9.0 · Commit e91ddc8",
        repoLabel: "Official repository",
        repoUrl: "https://github.com/morluto/rea/tree/e91ddc89f98199a900e5bb7b73c7dbb995f72fb1",
        askLabel: "Request the technical sheet",
        media: { tag: "Claude Code mod", caption: "Explainer video in production" },
        crumbs: { home: "Home", mods: "Reviewed mods" },
        sections: [
          {
            kind: "text",
            eyebrow: "What it is",
            title: "Reverse engineering from your agent",
            paragraphs: [
              "REA (Reverse Engineer Anything) is a Claude Code mod: it ships a plugin, an MCP server and skills with instructions. It connects your agent to tools like Ghidra, Hopper, IDA and JADX to analyze programs, desktop apps, Android apps, JavaScript and Electron apps, .NET, firmware and web pages.",
              "It helps you understand how an app works when you don't have its code. It runs on your computer. It is published by the GitHub user morluto under the MIT license.",
            ],
          },
          {
            kind: "verdict",
            eyebrow: "Our recommendation",
            strong: "Use it only on your own software, a client's software with written permission, or open source projects.",
            body: "Don't use it to study other companies' apps. Many commercial apps forbid reverse engineering in their terms of service, and REA's own disclaimer asks you to respect them.",
          },
          {
            kind: "flags",
            eyebrow: "Why",
            title: "It doesn't send your data to the author, but there are three things to watch",
            intro: "We reviewed its installer, its 43 dependencies, every internet connection it makes on its own and the instructions it gives your agent. We found no data sent to the author's servers: on its own it only checks registry.npmjs.org to tell you about new versions.",
            flags: [
              { badge: "Point 1", title: "Other apps' terms", body: "Using it on other companies' apps clashes with their terms of service. Use it only where you have permission." },
              { badge: "Point 2", title: "It's very large", body: "It weighs 131 MB and has 4,545 code files. We reviewed what touches your machine (install, network, config and instructions), not every line." },
              { badge: "Point 3", title: "It changes very fast", body: "The latest change landed minutes before our review. This review covers version 6.9.0 only; install that exact version." },
            ],
            moreLabel: "Also:",
            more: [
              "Its installer writes to the config of Claude Code, Claude Desktop, Codex, Cursor, Gemini and others. It backs up and asks first; approve Claude Code only.",
              "One of its guides tells the agent to start without asking when it builds test environments. It avoids repeat questions; it doesn't skip permissions.",
              "Its instructions don't ask your agent to hide actions, read your keys or turn off permissions. We found no hidden text.",
            ],
          },
          {
            kind: "list",
            eyebrow: "What you need",
            title: "Setup and tools",
            items: [
              "Claude Code installed on your computer.",
              "Node.js, to run the installer with npx.",
              "The tools you want to use with it: Ghidra, Hopper, IDA or JADX. It downloads Hopper with your approval.",
            ],
          },
          {
            kind: "list",
            eyebrow: "If you want to try it",
            title: "Three steps to install it",
            ordered: true,
            items: [
              "Pin the reviewed version and see what it would change first: npx rea-agents@6.9.0 setup --dry-run",
              "Review the proposed changes and approve Claude Code only.",
              "Run the same command without --dry-run.",
            ],
            outro: [
              "To remove it: npx rea-agents@6.9.0 uninstall, or delete the \"rea\" entry from Claude Code's MCP config.",
            ],
            askNote: "The full technical sheet, with every finding and the fingerprints of the files we reviewed, is available to anyone who wants it. Ask at",
          },
          {
            kind: "text",
            eyebrow: "What we didn't review",
            title: "The limits of this review",
            paragraphs: [
              "We didn't read all of its code line by line, nor the five third-party packages it bundles. We didn't install it or test it live. We didn't review its native binaries or its Ghidra and Hopper bridges in depth. We can't guarantee what your agent will do with its 48 KB of instructions in every conversation, and we didn't verify the author's identity. This review covers version 6.9.0; every new version needs a new review.",
              "Next review: with the next major version or in February 2027.",
            ],
          },
        ],
        facts: {
          title: "Quick facts",
          rows: [
            ["Program", "REA (Reverse Engineer Anything)"],
            ["Author", "morluto"],
            ["Type", "Claude Code mod"],
            ["Version reviewed", "6.9.0"],
            ["License", "MIT, free"],
            ["Verdict", "Only with the software owner's permission"],
            ["Date", "Nov 19, 2026"],
          ],
        },
        disclaimer: "ARTO Studio AI is not affiliated with morluto. This review doesn't guarantee the program is safe; it describes what we found in its code.",
      },
    },
  },
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
