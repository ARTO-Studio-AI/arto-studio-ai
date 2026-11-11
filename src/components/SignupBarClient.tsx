"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { track } from "@/lib/analytics";
import { CONSENT_CHANGED_EVENT, browserConsent } from "@/lib/consent";
import { PROMO_EXPIRED_SEEN_KEY, barMode, isPromoModalExcluded, promoHref } from "@/lib/promo";
import {
  SIGNUP_BAR_MIN_PAGES,
  SIGNUP_BAR_PAGES_KEY,
  SIGNUP_BAR_SCROLLED_KEY,
  SIGNUP_BAR_SCROLL_PX,
  hasSupabaseSessionCookie,
  isSignupBarExcluded,
  pathSection,
  signupHref,
} from "@/lib/signup-bar";
import PromoModal from "./promo/PromoModal";
import { BarCard, PromoBarText } from "./promo/PromoViews";
import { usePromo } from "./promo/promo-store";

/* Barra de registro para visitantes (2026-11-05, 0 registros en 7 dias). Fija abajo.
 * Reglas en src/lib/signup-bar.ts. Espera a que el aviso de cookies tenga respuesta para
 * no taparlo. sessionStorage va con try/catch: si falla, la memoria del modulo sirve
 * para esta carga.
 *
 * Promo de 24 h (decision de Victor, 5 nov 2026): con STRIPE_PROMO_COUPON_24H y el reloj
 * vigente, la barra sale de inmediato con «Tu primer mes de Pro al 50%» y el reloj, y se
 * monta la ventana grande (PromoModal, una vez por sesion). Cerrar la barra la oculta
 * solo en esta pagina: vuelve en la siguiente o en la siguiente visita. Sin la variable,
 * la barra es la de siempre (aparece al bajar o en la segunda pagina) y tampoco recuerda
 * el cierre mas alla de la pagina.
 *
 * Promos de /admin/promociones (5 nov 2026): la barra pregunta a /api/promo que promo toca
 * y pinta sus textos (PromoViews, las mismas piezas de la vista previa del admin). Con
 * sesion tambien pregunta: si la promo es para cuentas (cuenta gratis que nunca tuvo Pro o
 * de campana), sale la barra con el boton directo a /pricing; las de «sin cuenta» siguen sin
 * salir con sesion, como en el PR 123. Todos los eventos llevan promo_id. */

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

type BarState = "hidden" | "session" | "consent" | "waiting" | "pages" | "scroll";

/* Respaldo en memoria si el almacenamiento del navegador esta bloqueado. */
const mem = { pages: 0, scrolled: false, expiredSeen: false };
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

export default function SignupBarClient({
  locale,
  free,
  promo: promoConfig,
}: {
  locale: Locale;
  free: string | null;
  /** Textos comunes de la promo. null si no hay secreto de firma (sin el no hay promos). */
  promo: { copy: Dictionary["promo"]; features: readonly string[] } | null;
}) {
  const promoEnabled = promoConfig !== null;
  const pathname = usePathname() ?? `/${locale}`;
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const t = COPY[locale] ?? COPY.en;
  const section = pathSection(pathname);
  const [dismissedOn, setDismissedOn] = useState<string | null>(null);
  const shown = useRef<"" | "promo" | "signup">("");

  // La barra de registro: solo visitantes sin sesion y con el aviso de cookies contestado.
  const excluded = isSignupBarExcluded(pathname);
  const eligible = (state === "waiting" || state === "scroll" || state === "pages") && !excluded;
  // La de promo ademas pregunta con sesion (el servidor decide si hay una para esa cuenta).
  const signedIn = state === "session";
  const promoEligible = eligible || (signedIn && !excluded);
  const promo = usePromo(promoEnabled && promoEligible, locale);
  const mode = barMode({ promoEnabled, promo, signupTriggered: state === "scroll" || state === "pages", signedIn });
  const visible = promoEligible && mode !== "off" && dismissedOn !== pathname;
  const promoId = promo?.promoId ?? "";

  // Cuenta paginas distintas abiertas en esta pestana (sin doble conteo en modo estricto).
  useEffect(() => {
    if (lastCounted === pathname) return;
    lastCounted = pathname;
    mem.pages = pagesSeen() + 1;
    writeSession(SIGNUP_BAR_PAGES_KEY, String(mem.pages));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [pathname]);

  useEffect(() => {
    if (!visible || shown.current === mode) return;
    shown.current = mode;
    if (mode === "promo") track("promo_bar_shown", { locale, path_section: section, promo_id: promoId });
    else if (mode === "signup") track("signup_bar_shown", { locale, path_section: section, trigger: state === "scroll" ? "scroll" : "pages" });
  }, [visible, mode, locale, section, state, promoId]);

  // Quien ya gasto sus 24 h: una vez por sesion del navegador.
  useEffect(() => {
    if (!eligible || !promo?.expired || mem.expiredSeen) return;
    mem.expiredSeen = true;
    if (readSession(PROMO_EXPIRED_SEEN_KEY) === "1") return;
    writeSession(PROMO_EXPIRED_SEEN_KEY, "1");
    track("promo_expired_seen", { locale, path_section: section, promo_id: promoId });
  }, [eligible, promo?.expired, locale, section, promoId]);

  const modal =
    mode === "promo" && promoConfig && promo?.offer && promoEligible && !isPromoModalExcluded(pathname) ? (
      <PromoModal
        locale={locale}
        endsAt={promo.endsAt}
        pathSection={section}
        copy={promoConfig.copy}
        features={promoConfig.features}
        offer={promo.offer}
        signedIn={signedIn}
      />
    ) : null;

  if (!visible) return modal;

  function dismiss() {
    setDismissedOn(pathname);
    track("signup_bar_dismissed", { locale, path_section: section });
  }

  const search = typeof window === "undefined" ? "" : window.location.search;
  const promoCopy = promoConfig?.copy ?? null;
  const offer = mode === "promo" ? (promo?.offer ?? null) : null;

  return (
    <>
      {modal}
      {/* Espacio para que la barra no tape el final del footer. */}
      <div aria-hidden="true" className="h-24 sm:h-20" />
      <div
        role="region"
        aria-label={offer && promoCopy ? promoCopy.region : t.region}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5"
      >
        {offer && promoCopy ? (
          <BarCard
            title={<PromoBarText offer={offer} dict={promoCopy} endsAt={promo?.endsAt ?? null} />}
            sub={null}
            href={promoHref(locale, signedIn)}
            cta={offer.copy.cta}
            ctaShort={promoCopy.cta_short}
            closeLabel={promoCopy.close_bar}
            onCta={() => track("promo_cta_clicked", { placement: "bar", locale, path_section: section, promo_id: offer.id })}
            onClose={dismiss}
          />
        ) : (
          <BarCard
            title={<p className="text-sm font-semibold leading-snug">{t.title(free)}</p>}
            sub={<p className="hidden text-xs text-white sm:block">{t.sub}</p>}
            href={signupHref(locale, pathname, search)}
            cta={t.cta}
            ctaShort={t.cta_short}
            closeLabel={t.close}
            onCta={() => track("signup_bar_clicked", { locale, path_section: section })}
            onClose={dismiss}
          />
        )}
      </div>
    </>
  );
}
