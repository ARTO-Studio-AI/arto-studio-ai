"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { track } from "@/lib/analytics";
import { PROMO_MODAL_DELAY_MS, PROMO_MODAL_SCROLL_PX, PROMO_MODAL_SEEN_KEY, promoHref } from "@/lib/promo";
import type { PromoOffer } from "@/lib/promos/tipos";
import { PromoModalCard } from "./PromoViews";

/* Ventana grande de la promo (5 nov 2026). Una vez por sesion del navegador
 * (sessionStorage con try/catch; si falla, una vez por carga), a los PROMO_MODAL_DELAY_MS
 * o al primer scroll. En celular es una hoja inferior que deja ver la pagina arriba,
 * no una pantalla completa (guia de intersticiales de Google). Foco atrapado, Esc cierra
 * y el foco vuelve a donde estaba. El padre decide si toca (promo activa, sin sesion,
 * aviso de cookies contestado, ruta permitida). Textos y precio salen de la promo que
 * toca (offer, de /api/promo); la tarjeta es PromoModalCard, la misma de la vista previa
 * de /admin/promociones. */

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

export default function PromoModal({
  locale,
  endsAt,
  pathSection,
  copy,
  features,
  offer,
  signedIn = false,
}: {
  locale: Locale;
  endsAt: number | null;
  pathSection: string;
  copy: Dictionary["promo"];
  features: readonly string[];
  offer: PromoOffer;
  signedIn?: boolean;
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
      track("promo_modal_shown", { locale, path_section: pathSection, trigger, promo_id: offer.id });
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
  }, [locale, pathSection, offer.id]);

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
      <PromoModalCard
        asDialog
        dialogRef={dialogRef}
        offer={offer}
        dict={copy}
        features={features}
        endsAt={endsAt}
        href={promoHref(locale, signedIn)}
        onCta={() => track("promo_cta_clicked", { placement: "modal", locale, path_section: pathSection, promo_id: offer.id })}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
