"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { track } from "@/lib/analytics";
import {
  PROMO_FIRST_MONTH_USD,
  PROMO_MODAL_DELAY_MS,
  PROMO_MODAL_SCROLL_PX,
  PROMO_MODAL_SEEN_KEY,
  PROMO_PRICE_USD,
  promoHref,
} from "@/lib/promo";
import PromoClock from "./PromoClock";

/* Ventana grande de la promo (5 nov 2026). Una vez por sesion del navegador
 * (sessionStorage con try/catch; si falla, una vez por carga), a los PROMO_MODAL_DELAY_MS
 * o al primer scroll. En celular es una hoja inferior que deja ver la pagina arriba,
 * no una pantalla completa (guia de intersticiales de Google). Foco atrapado, Esc cierra
 * y el foco vuelve a donde estaba. El padre decide si toca (promo activa, sin sesion,
 * aviso de cookies contestado, ruta permitida). */

let shownThisLoad = false;

function alreadySeen(): boolean {
  if (shownThisLoad) return true;
  try {
    return sessionStorage.getItem(PROMO_MODAL_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen(): void {
  shownThisLoad = true;
  try {
    sessionStorage.setItem(PROMO_MODAL_SEEN_KEY, "1");
  } catch {
    /* sin sessionStorage vale la memoria de esta carga */
  }
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function usd(n: number): string {
  return `$${n % 1 === 0 ? n : n.toFixed(2)}`;
}

export default function PromoModal({
  locale,
  endsAt,
  pathSection,
  copy,
  features,
}: {
  locale: Locale;
  endsAt: number | null;
  pathSection: string;
  copy: Dictionary["promo"];
  features: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Disparador: tiempo o primer scroll, lo que llegue antes. Una vez por sesion.
  useEffect(() => {
    if (alreadySeen()) return;
    let done = false;
    const fire = (trigger: "timer" | "scroll") => {
      if (done || alreadySeen()) return;
      done = true;
      markSeen();
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
      track("promo_modal_shown", { locale, path_section: pathSection, trigger });
    };
    const timer = setTimeout(() => fire("timer"), PROMO_MODAL_DELAY_MS);
    const onScroll = () => {
      if (window.scrollY >= PROMO_MODAL_SCROLL_PX) fire("scroll");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [locale, pathSection]);

  // Foco adentro al abrir; Tab da la vuelta dentro de la ventana; Esc cierra.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      returnFocus.current?.focus?.();
    };
  }, [open]);

  if (!open || endsAt === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-zinc-950/50" onClick={() => setOpen(false)} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-modal-title"
        aria-describedby="promo-modal-sub"
        className="animate-fade-in relative max-h-[70vh] w-full overflow-y-auto rounded-t-[var(--radius-md)] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-10px_30px_rgba(24,24,27,0.2)] sm:max-w-md sm:rounded-[var(--radius-md)] sm:p-7 sm:shadow-[0_20px_50px_rgba(24,24,27,0.3)]"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={copy.close_modal}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <p className="text-eyebrow text-zinc-500">{copy.modal_eyebrow}</p>
        <h2 id="promo-modal-title" className="mt-1 pr-8 text-xl font-bold tracking-tight sm:text-2xl">
          {copy.title}
        </h2>
        <p id="promo-modal-sub" className="mt-2 text-sm text-zinc-600">
          {copy.modal_sub}
        </p>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <s className="font-mono text-lg text-zinc-400">{usd(PROMO_PRICE_USD)}</s>
          <span className="font-mono text-3xl font-bold tracking-tight">{usd(PROMO_FIRST_MONTH_USD)}</span>
          <span className="font-mono text-xs text-zinc-500">USD {copy.first_month}</span>
        </div>
        <p className="mt-2 text-sm text-zinc-700">
          {copy.time_left} <PromoClock endsAt={endsAt} className="font-semibold text-zinc-900" />
        </p>

        <ul className="mt-4 space-y-1.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              <span className="text-zinc-600">{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Link
            href={promoHref(locale)}
            data-autofocus
            onClick={() => track("promo_cta_clicked", { placement: "modal", locale, path_section: pathSection })}
            className="flex-1 rounded-[var(--radius-sm)] bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            {copy.cta}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-[var(--radius-sm)] border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 transition hover:border-zinc-500"
          >
            {copy.keep_browsing}
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] text-zinc-500">{copy.then}</p>
      </div>
    </div>
  );
}
