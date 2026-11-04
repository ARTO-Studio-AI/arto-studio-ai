"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import { track } from "@/lib/analytics";
import { CONSENT_CHANGED_EVENT, browserConsent } from "@/lib/consent";
import {
  SIGNUP_BAR_DISMISS_KEY,
  SIGNUP_BAR_MIN_PAGES,
  SIGNUP_BAR_PAGES_KEY,
  SIGNUP_BAR_SCROLLED_KEY,
  SIGNUP_BAR_SCROLL_PX,
  dismissedRecently,
  hasSupabaseSessionCookie,
  isSignupBarExcluded,
  pathSection,
  signupHref,
} from "@/lib/signup-bar";

/* Barra de registro para visitantes (2026-11-05, 0 registros en 7 dias). Discreta, fija
 * abajo, aparece al bajar en la pagina o al abrir la segunda pagina. Reglas en
 * src/lib/signup-bar.ts. Espera a que el aviso de cookies tenga respuesta para no
 * taparlo. localStorage y sessionStorage van con try/catch: si fallan, la memoria del
 * modulo sirve para esta carga. */

const COPY = {
  es: {
    title: (n: string | null) => (n ? `Abre ${n} prompts gratis con tu cuenta` : "Abre los prompts gratis con tu cuenta"),
    sub: "Sin tarjeta. Con Google entras en un clic.",
    cta: "Crear cuenta gratis",
    cta_short: "Crear cuenta",
    close: "Cerrar aviso de cuenta gratis",
    region: "Cuenta gratis",
  },
  en: {
    title: (n: string | null) => (n ? `Open ${n} free prompts with your account` : "Open the free prompts with your account"),
    sub: "No card needed. One click with Google.",
    cta: "Create free account",
    cta_short: "Sign up free",
    close: "Close free account notice",
    region: "Free account",
  },
} as const;

const CHANGE_EVENT = "asai:signup-bar";

type BarState = "hidden" | "session" | "dismissed" | "consent" | "waiting" | "pages" | "scroll";

/* Respaldo en memoria si el almacenamiento del navegador esta bloqueado. */
const mem = { pages: 0, scrolled: false, dismissedAt: "" };
let lastCounted = "";

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* sin sessionStorage queda la memoria */
  }
}

function pagesSeen(): number {
  const stored = Number(readSession(SIGNUP_BAR_PAGES_KEY));
  return Math.max(Number.isFinite(stored) ? stored : 0, mem.pages);
}

function snapshot(): BarState {
  if (hasSupabaseSessionCookie(document.cookie)) return "session";
  let dismissed: string | null = mem.dismissedAt || null;
  try {
    dismissed = localStorage.getItem(SIGNUP_BAR_DISMISS_KEY) ?? dismissed;
  } catch {
    /* localStorage bloqueado: vale la memoria */
  }
  if (dismissedRecently(dismissed, Date.now())) return "dismissed";
  if (browserConsent() === null) return "consent";
  if (mem.scrolled || readSession(SIGNUP_BAR_SCROLLED_KEY) === "1") return "scroll";
  if (pagesSeen() >= SIGNUP_BAR_MIN_PAGES) return "pages";
  return "waiting";
}

function serverSnapshot(): BarState {
  return "hidden";
}

function subscribe(onChange: () => void): () => void {
  const onScroll = () => {
    if (mem.scrolled || window.scrollY < SIGNUP_BAR_SCROLL_PX) return;
    mem.scrolled = true;
    writeSession(SIGNUP_BAR_SCROLLED_KEY, "1");
    onChange();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export default function SignupBarClient({ locale, free }: { locale: Locale; free: string | null }) {
  const pathname = usePathname() ?? `/${locale}`;
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const t = COPY[locale] ?? COPY.en;
  const visible = (state === "scroll" || state === "pages") && !isSignupBarExcluded(pathname);
  const section = pathSection(pathname);
  const shown = useRef(false);

  // Cuenta paginas distintas abiertas en esta pestana (sin doble conteo en modo estricto).
  useEffect(() => {
    if (lastCounted === pathname) return;
    lastCounted = pathname;
    mem.pages = pagesSeen() + 1;
    writeSession(SIGNUP_BAR_PAGES_KEY, String(mem.pages));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [pathname]);

  useEffect(() => {
    if (!visible || shown.current) return;
    shown.current = true;
    track("signup_bar_shown", { locale, path_section: section, trigger: state === "scroll" ? "scroll" : "pages" });
  }, [visible, locale, section, state]);

  if (!visible) return null;

  function dismiss() {
    const now = String(Date.now());
    mem.dismissedAt = now;
    try {
      localStorage.setItem(SIGNUP_BAR_DISMISS_KEY, now);
    } catch {
      /* sin localStorage se recuerda solo en esta carga */
    }
    track("signup_bar_dismissed", { locale, path_section: section });
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const search = typeof window === "undefined" ? "" : window.location.search;
  const href = signupHref(locale, pathname, search);

  return (
    <>
      {/* Espacio para que la barra no tape el final del footer. */}
      <div aria-hidden="true" className="h-24 sm:h-20" />
      <div
        role="region"
        aria-label={t.region}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5"
      >
        <div className="animate-fade-in pointer-events-auto mx-auto flex max-w-3xl items-center gap-2.5 rounded-[var(--radius-md)] bg-zinc-900 py-2.5 pl-4 pr-2 text-white shadow-[0_10px_30px_rgba(24,24,27,0.28)] sm:gap-4 sm:py-3 sm:pl-5">
          <span aria-hidden="true" className="hidden h-2 w-2 shrink-0 rounded-full bg-[var(--accent)] sm:inline-block" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{t.title(free)}</p>
            <p className="hidden text-xs text-zinc-400 sm:block">{t.sub}</p>
          </div>
          <Link
            href={href}
            onClick={() => track("signup_bar_clicked", { locale, path_section: section })}
            className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110 focus-visible:outline-white sm:px-4"
          >
            <span className="sm:hidden">{t.cta_short}</span>
            <span className="hidden sm:inline">{t.cta}</span>
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t.close}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sm)] text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-white"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
