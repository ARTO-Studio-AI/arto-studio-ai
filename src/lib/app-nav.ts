import type { Locale } from "@/i18n/config";
import type { Category } from "@/types/prompt";

/* Navegacion por tipo de recurso para usuarios con sesion (D28, benchmark de AI Black Magic).
 *
 * Aqui vive solo la logica pura (que destinos hay, en que grupo, cual esta activo y cuando se
 * muestra), para probarla con vitest sin DOM. Los componentes AppSidebar y AppBottomNav la
 * consumen. Las rutas van sin locale; localeHref() se lo antepone.
 *
 * Criterio de cierre aprobado: barra lateral en escritorio con Inicio (lo nuevo, favoritos),
 * Herramientas (busqueda inteligente, Brand Roast, Brand Positioning) y Biblioteca por tipo
 * (prompts por vertical, tutoriales, skills, mods). En celular, cuatro destinos abajo y el resto
 * en un cajon. La home publica no cambia.
 *
 * Brand Positioning no tiene pagina para el usuario con sesion: solo corre en /studio, detras de
 * una API key de cliente y sin version bilingue. Se omite hasta que exista esa pagina.
 * «Lo nuevo» apunta a /learn, que se refresca cada 60 s con lo que publica la Content Factory;
 * «Tutoriales y guias» tambien va a /learn mientras no exista una ruta propia de tutoriales. */

export type AppNavId =
  | "new"
  | "favorites"
  | "collections"
  | "smart_search"
  | "roast"
  | "ai_tools"
  | "agents"
  | "prompts"
  | "tutorials"
  | "skills"
  | "mods"
  | "account";

export type AppNavGroupId = "home" | "tools" | "library";

export interface AppNavItem {
  id: AppNavId;
  /* Ruta sin locale; puede llevar query o hash. */
  href: string;
  /* Prefijos de ruta (sin locale) que marcan este destino como activo. Vacio: nunca se marca,
   * para que un atajo que comparte destino con otro no deje dos activos a la vez. */
  match: string[];
}

export interface AppNavGroup {
  id: AppNavGroupId;
  items: AppNavItem[];
}

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    id: "home",
    items: [
      { id: "new", href: "/learn", match: [] },
      { id: "favorites", href: "/favorites", match: ["/favorites"] },
      { id: "collections", href: "/collections", match: ["/collections"] },
    ],
  },
  {
    id: "tools",
    items: [
      /* #catalog-q es el campo de busqueda del catalogo; la busqueda inteligente va justo debajo. */
      { id: "smart_search", href: "/prompts#catalog-q", match: [] },
      { id: "roast", href: "/roast", match: ["/roast"] },
      { id: "ai_tools", href: "/tools", match: ["/tools"] },
      { id: "agents", href: "/agents", match: ["/agents"] },
    ],
  },
  {
    id: "library",
    items: [
      { id: "prompts", href: "/prompts", match: ["/prompts"] },
      { id: "tutorials", href: "/learn", match: ["/learn"] },
      { id: "skills", href: "/skills", match: ["/skills"] },
      { id: "mods", href: "/mods", match: ["/mods"] },
    ],
  },
];

export const ACCOUNT_ITEM: AppNavItem = { id: "account", href: "/account", match: ["/account"] };

/* Los cuatro destinos fijos de la barra inferior en celular; el resto va al cajon «Mas». */
export const MOBILE_PRIMARY_IDS: AppNavId[] = ["prompts", "smart_search", "favorites", "account"];

/* Mismo orden que el filtro de /prompts. */
export const PROMPT_VERTICALS: Category[] = [
  "branding",
  "graphic_design",
  "copywriting",
  "photography",
  "video",
  "ux_ui",
  "illustration",
  "marketing",
  "music",
  "architecture",
  "fashion",
  "creative_productivity",
];

export function localeHref(locale: Locale, href: string): string {
  return `/${locale}${href.startsWith("/") ? href : "/" + href}`;
}

/* Quita el prefijo /<locale> y la barra final. "/es" y "/es/" quedan como "/". */
export function stripLocale(pathname: string, locale: Locale): string {
  let p = pathname.split(/[?#]/)[0] || "/";
  const prefix = `/${locale}`;
  if (p === prefix) return "/";
  if (p.startsWith(prefix + "/")) p = p.slice(prefix.length);
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

/* La navegacion solo aparece con sesion y nunca en la home publica del locale. */
export function shouldShowAppNav(pathname: string | null, locale: Locale, signedIn: boolean): boolean {
  if (!signedIn || !pathname) return false;
  return stripLocale(pathname, locale) !== "/";
}

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

export function allNavItems(): AppNavItem[] {
  return [...APP_NAV_GROUPS.flatMap((g) => g.items), ACCOUNT_ITEM];
}

/* El destino activo para la ruta actual, o null. Nunca hay dos activos. */
export function activeNavId(pathname: string | null, locale: Locale): AppNavId | null {
  if (!pathname) return null;
  const path = stripLocale(pathname, locale);
  for (const item of allNavItems()) {
    if (item.match.some((m) => matches(path, m))) return item.id;
  }
  return null;
}

/* La vertical activa en /prompts?category=..., o null si no hay filtro o no es valida. */
export function activeVertical(
  pathname: string | null,
  locale: Locale,
  category: string | null | undefined,
): Category | null {
  if (!pathname || !category) return null;
  if (stripLocale(pathname, locale) !== "/prompts") return null;
  return (PROMPT_VERTICALS as string[]).includes(category) ? (category as Category) : null;
}

export function mobilePrimaryItems(): AppNavItem[] {
  const all = allNavItems();
  return MOBILE_PRIMARY_IDS.map((id) => all.find((i) => i.id === id)!).filter(Boolean);
}

/* Los grupos que van en el cajon «Mas»: todo menos los cuatro destinos fijos. */
export function mobileDrawerGroups(): AppNavGroup[] {
  return APP_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !MOBILE_PRIMARY_IDS.includes(i.id)),
  })).filter((g) => g.items.length > 0);
}
