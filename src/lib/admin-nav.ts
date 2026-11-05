/* Navegacion del /admin (pedido de Victor, 5 nov 2026: «que el backend del admin se vea como el
 * backend del usuario»). Mismo patron que src/lib/app-nav.ts: aqui vive solo la logica pura
 * (destinos, grupos, cual esta activo, que va abajo en celular) para probarla con vitest sin DOM.
 * El componente src/app/admin/AdminNav.tsx la consume.
 *
 * El admin no es bilingue: las etiquetas van aqui en espanol de Mexico, sin diccionario.
 * Al sumar una pagina nueva a /admin, ponla en uno de estos grupos y dale icono en AdminNav. */

export type AdminNavId =
  | "home"
  | "prompts"
  | "new_prompt"
  | "import"
  | "history"
  | "review"
  | "skills"
  | "users"
  | "pro"
  | "grants"
  | "waitlist"
  | "api_clients"
  | "emails"
  | "channels"
  | "searches"
  | "roasts"
  | "skill_traces";

export type AdminNavGroupId = "home" | "catalog" | "people" | "comms" | "metrics";

export interface AdminNavItem {
  id: AdminNavId;
  href: string;
  label: string;
  /* Etiqueta corta para la barra inferior en celular. */
  short?: string;
  /* Solo coincide la ruta exacta (para /admin, que es prefijo de todo). */
  exact?: boolean;
}

export interface AdminNavGroup {
  id: AdminNavGroupId;
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "home",
    label: "Inicio",
    items: [{ id: "home", href: "/admin", label: "Resumen", short: "Inicio", exact: true }],
  },
  {
    id: "catalog",
    label: "Catálogo",
    items: [
      { id: "prompts", href: "/admin/catalogo", label: "Prompts" },
      { id: "new_prompt", href: "/admin/catalogo/nuevo", label: "Nuevo prompt" },
      { id: "import", href: "/admin/catalogo/importar", label: "Importar CSV" },
      { id: "history", href: "/admin/catalogo/historial", label: "Historial" },
      /* /admin/revision la construye otra rama (5 nov 2026); el enlace va desde ya. */
      { id: "review", href: "/admin/revision", label: "Revisión" },
      { id: "skills", href: "/admin/skills", label: "Skills y mods", short: "Skills" },
    ],
  },
  {
    id: "people",
    label: "Usuarios",
    items: [
      { id: "users", href: "/admin/usuarios", label: "Usuarios" },
      { id: "pro", href: "/admin/pro", label: "Pro y planes de pago" },
      { id: "grants", href: "/admin/concesiones", label: "Concesiones de plan" },
      { id: "waitlist", href: "/admin/lista", label: "Lista de promociones" },
      { id: "api_clients", href: "/admin/clients", label: "Clientes API" },
    ],
  },
  {
    id: "comms",
    label: "Comunicación",
    items: [
      { id: "emails", href: "/admin/emails", label: "Correos" },
      { id: "channels", href: "/admin/canales", label: "Canales" },
    ],
  },
  {
    id: "metrics",
    label: "Medición",
    items: [
      { id: "searches", href: "/admin/busquedas", label: "Búsquedas" },
      { id: "roasts", href: "/admin/roasts", label: "Brand Roasts" },
      { id: "skill_traces", href: "/admin/traces/skills", label: "Llamadas a skills" },
    ],
  },
];

/* Los cuatro destinos fijos de la barra inferior en celular; el resto va al cajon «Más». */
export const ADMIN_MOBILE_PRIMARY_IDS: AdminNavId[] = ["home", "prompts", "review", "users"];

/* Accesos rapidos del tablero /admin. */
export const ADMIN_QUICK_IDS: AdminNavId[] = ["new_prompt", "review", "import", "grants", "emails", "skills"];

export function allAdminNavItems(): AdminNavItem[] {
  return ADMIN_NAV_GROUPS.flatMap((g) => g.items);
}

export function adminNavItem(id: AdminNavId): AdminNavItem {
  return allAdminNavItems().find((i) => i.id === id)!;
}

function normalize(pathname: string): string {
  let p = pathname.split(/[?#]/)[0] || "/";
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/* El destino activo para la ruta actual, o null. Gana el prefijo mas largo, asi
 * /admin/catalogo/nuevo marca «Nuevo prompt» y /admin/catalogo/123 marca «Prompts».
 * Nunca hay dos activos. */
export function activeAdminNavId(pathname: string | null): AdminNavId | null {
  if (!pathname) return null;
  const path = normalize(pathname);
  let best: AdminNavItem | null = null;
  for (const item of allAdminNavItems()) {
    const hit = item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");
    if (hit && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.id ?? null;
}

export function adminMobilePrimaryItems(): AdminNavItem[] {
  return ADMIN_MOBILE_PRIMARY_IDS.map(adminNavItem);
}

/* Los grupos que van en el cajon «Más»: todo menos los destinos fijos de abajo. */
export function adminMobileDrawerGroups(): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !ADMIN_MOBILE_PRIMARY_IDS.includes(i.id)),
  })).filter((g) => g.items.length > 0);
}
