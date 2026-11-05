"use client";

import { useEffect, type RefObject } from "react";

/* Comportamiento de cajon modal compartido por la barra inferior de usuario (AppBottomNav) y la
 * del admin (AdminNav): mientras esta abierto bloquea el scroll del fondo, lleva el foco al boton
 * de cerrar, cierra con Esc devolviendo el foco al disparador y atrapa Tab dentro del panel.
 * Solo cuenta lo visible: los enlaces dentro de un <details> cerrado no reciben foco. */

interface Refs {
  panel: RefObject<HTMLElement | null>;
  close: RefObject<HTMLElement | null>;
  trigger: RefObject<HTMLElement | null>;
}

export function useDrawerFocus(open: boolean, setOpen: (v: boolean) => void, refs: Refs) {
  const { panel, close, trigger } = refs;
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focusables = Array.from(
        panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => {
        const details = el.closest("details");
        if (details && !details.open && el.tagName !== "SUMMARY") return false;
        return el.getClientRects().length > 0;
      });
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, setOpen, panel, close, trigger]);
}
