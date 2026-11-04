import type { Locale } from "@/i18n/config";

/* Barra de registro para visitantes (2026-11-05). Logica pura, sin DOM, para poder
 * probarla (signup-bar.test.ts). El componente vive en src/components/SignupBarClient.tsx.
 *
 * Reglas:
 *   - Solo visitantes sin sesion. La sesion se detecta por la cookie de Supabase
 *     (sb-<ref>-auth-token, a veces partida en .0, .1), sin tocar el layout.
 *   - Aparece despues de bajar SIGNUP_BAR_SCROLL_PX o de abrir SIGNUP_BAR_MIN_PAGES paginas.
 *   - No sale en /login ni en /account.
 *   - Si se cierra, no vuelve en SIGNUP_BAR_DISMISS_DAYS dias (localStorage). */

export const SIGNUP_BAR_DISMISS_KEY = "asai_signup_bar_closed";
export const SIGNUP_BAR_PAGES_KEY = "asai_signup_bar_pages";
export const SIGNUP_BAR_SCROLLED_KEY = "asai_signup_bar_scrolled";
export const SIGNUP_BAR_DISMISS_DAYS = 30;
export const SIGNUP_BAR_SCROLL_PX = 480;
export const SIGNUP_BAR_MIN_PAGES = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** true si el navegador trae la cookie de sesion de Supabase. */
export function hasSupabaseSessionCookie(cookie: string | null | undefined): boolean {
  if (!cookie) return false;
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=[^;]/.test(cookie);
}

/** Rutas donde la barra estorba: el propio registro y la cuenta. */
export function isSignupBarExcluded(pathname: string): boolean {
  const rest = pathname.replace(/^\/(?:es|en)(?=\/|$)/, "");
  return /^\/(?:login|account)(?:\/|$)/.test(rest);
}

/** true si la barra se cerro hace menos de SIGNUP_BAR_DISMISS_DAYS dias. */
export function dismissedRecently(raw: string | null | undefined, now: number): boolean {
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at) || at <= 0) return false;
  return now - at < SIGNUP_BAR_DISMISS_DAYS * DAY_MS;
}

/** Enlace al registro que vuelve a la pagina actual despues de crear la cuenta. */
export function signupHref(locale: Locale, pathname: string, search = ""): string {
  const next = `${pathname || `/${locale}`}${search}`;
  return `/${locale}/login?next=${encodeURIComponent(next)}`;
}

/** Seccion de la ruta para analitica ("prompts", "pricing", "home"), sin ids ni query. */
export function pathSection(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] === "es" || parts[0] === "en" ? parts[1] : parts[0];
  return first ? first.slice(0, 40) : "home";
}

/** Numero con separador de miles del idioma: 3,001 en los dos. */
export function formatCount(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US").format(n);
}
