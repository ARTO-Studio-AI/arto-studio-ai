"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { UTM_COOKIE, UTM_COOKIE_MAX_AGE, buildFirstTouch, serializeFirstTouch } from "@/lib/attribution";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  OPEN_CONSENT_EVENT,
  browserConsent,
  readCookie,
  serializeConsent,
  type ConsentChoice,
} from "@/lib/consent";
import { initAnalytics, revokeAnalytics } from "@/lib/analytics";

/* Aviso de cookies (H-48, 9 oct 2026). Sale mientras no haya una eleccion vigente en
 * asai_consent y vuelve a salir con el enlace "Cookies" del footer. Sin respuesta no
 * se activa nada: el default es "solo esenciales". Las dos opciones pesan lo mismo.
 *
 * La pagina de llegada se guarda en memoria al cargar el modulo (no en una cookie ni
 * en localStorage): si la persona acepta despues de navegar, asai_utm registra su
 * primera visita real y no la pagina en la que acepto. */

const LANDING =
  typeof window === "undefined"
    ? null
    : { search: window.location.search, referrer: document.referrer, pathname: window.location.pathname };

const COPY = {
  es: {
    title: "Cookies",
    body: "Usamos cookies esenciales para tu sesión, tu idioma y el contador de prompts gratis. Con tu permiso, también usamos analítica (PostHog) para entender qué partes del sitio sirven y de dónde llegas. No vendemos tus datos ni usamos cookies de publicidad.",
    more: "Aviso de privacidad",
    essential: "Solo esenciales",
    all: "Aceptar analítica",
  },
  en: {
    title: "Cookies",
    body: "We use essential cookies for your session, your language and the free prompt counter. With your permission, we also use analytics (PostHog) to learn which parts of the site work and where you came from. We don't sell your data or use advertising cookies.",
    more: "Privacy policy",
    essential: "Essential only",
    all: "Accept analytics",
  },
} as const;

function setCookie(name: string, value: string, maxAge: number): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax${secure}`;
}

/* Primera visita con lo que se vio al cargar. Mismo formato que escribe src/proxy.ts. */
function writeFirstTouch(): void {
  if (!LANDING || readCookie(document.cookie, UTM_COOKIE)) return;
  const firstTouch = buildFirstTouch({
    params: new URLSearchParams(LANDING.search),
    referer: LANDING.referrer,
    host: window.location.host,
    pathname: LANDING.pathname,
  });
  setCookie(UTM_COOKIE, serializeFirstTouch(firstTouch), UTM_COOKIE_MAX_AGE);
}

/* Hay eleccion vigente? En el servidor se responde que si, para no pintar el aviso
 * en el HTML y no desalinear la hidratacion; el cliente lo corrige al montar. */
function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
}
const hasChoice = () => browserConsent() !== null;
const hasChoiceOnServer = () => true;

export default function CookieBanner({ locale }: { locale: string }) {
  const decided = useSyncExternalStore(subscribeConsent, hasChoice, hasChoiceOnServer);
  const [reopened, setReopened] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const t = locale === "es" ? COPY.es : COPY.en;

  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  function choose(choice: ConsentChoice) {
    setCookie(CONSENT_COOKIE, serializeConsent(choice), CONSENT_MAX_AGE);
    if (choice === "all") {
      writeFirstTouch();
      void initAnalytics();
    } else {
      revokeAnalytics();
      setCookie(UTM_COOKIE, "", 0);
    }
    setReopened(false);
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: choice }));
  }

  const open = !decided || reopened;
  // El aviso esta al final del DOM: se lleva el foco ahi para que con teclado no sea lo ultimo.
  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);

  if (!open) return null;

  const button =
    "rounded-full border border-zinc-900 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-900 hover:text-white";
  return (
    <div
      ref={box}
      tabIndex={-1}
      role="dialog"
      aria-label={t.title}
      className="fixed inset-x-4 bottom-4 z-40 outline-none mx-auto max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg sm:inset-x-auto sm:left-6"
    >
      <p className="text-sm font-semibold text-zinc-900">{t.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
        {t.body}{" "}
        <Link href={`/${locale === "es" ? "es" : "en"}/privacy#cookies`} className="underline hover:text-zinc-900">
          {t.more}
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => choose("essential")}>
          {t.essential}
        </button>
        <button type="button" className={button} onClick={() => choose("all")}>
          {t.all}
        </button>
      </div>
    </div>
  );
}

/* Enlace del footer que vuelve a abrir el aviso. */
export function CookieSettingsButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      {label}
    </button>
  );
}
