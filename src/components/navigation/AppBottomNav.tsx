"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { localeHref, mobileDrawerGroups, mobilePrimaryItems, type AppNavId } from "@/lib/app-nav";
import AppNavIcon from "@/components/navigation/AppNavIcon";
import VerticalLinks from "@/components/navigation/VerticalLinks";

/* Barra inferior en celular (< 768 px) para usuarios con sesion (D28): cuatro destinos fijos y
 * «Mas», que abre un cajon con el resto. El cajon es un dialogo modal: atrapa el foco, se cierra
 * con Esc, con el fondo o con el boton, y devuelve el foco a «Mas». Va en z-30 para que el aviso
 * de cookies (z-40) y el header (z-50) queden encima; el cajon abierto va en z-[60]. */

type Labels = Dictionary["app_nav"];

const GROUP_LABEL = { home: "group_home", tools: "group_tools", library: "group_library" } as const;
const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-zinc-900";

interface Props {
  locale: Locale;
  labels: Labels;
  active: AppNavId | null;
}

export default function AppBottomNav({ locale, labels, active }: Props) {
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const primary = mobilePrimaryItems();
  const drawerGroups = mobileDrawerGroups();
  const activeInDrawer = active !== null && !primary.some((i) => i.id === active);

  function closeAndRestoreFocus() {
    setOpen(false);
    moreRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        moreRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      /* Solo lo visible: los enlaces dentro de un <details> cerrado no reciben foco. */
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
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
  }, [open]);

  const itemClass = (isActive: boolean) =>
    `relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight transition ${FOCUS} ${
      isActive ? "font-semibold text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
    }`;
  const activeBar = <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-zinc-900" />;

  return (
    <>
      <nav
        aria-label={labels.aria_bottom}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      >
        <ul className="flex">
          {primary.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id} className="flex flex-1">
                <Link
                  href={localeHref(locale, item.href)}
                  aria-current={isActive ? "page" : undefined}
                  className={itemClass(isActive)}
                >
                  {isActive && activeBar}
                  <AppNavIcon name={item.id} className="h-6 w-6" />
                  <span>{item.id === "smart_search" ? labels.smart_search_short : labels[item.id]}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              ref={moreRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls="app-nav-drawer"
              className={itemClass(activeInDrawer)}
            >
              {activeInDrawer && activeBar}
              <AppNavIcon name="more" className="h-6 w-6" />
              <span>{labels.more}</span>
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-zinc-900/40" onClick={closeAndRestoreFocus} />
          <div
            ref={panelRef}
            id="app-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-nav-drawer-title"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="app-nav-drawer-title" className="text-base font-semibold text-zinc-900">
                {labels.drawer_title}
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={closeAndRestoreFocus}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 ${FOCUS}`}
              >
                <AppNavIcon name="close" className="h-6 w-6" />
                <span className="sr-only">{labels.close}</span>
              </button>
            </div>

            {drawerGroups.map((group) => {
              const headingId = `app-drawer-${group.id}`;
              return (
                <div key={group.id} className="mb-4">
                  <p id={headingId} className="text-eyebrow px-3 pb-1 text-zinc-400">
                    {labels[GROUP_LABEL[group.id]]}
                  </p>
                  <ul aria-labelledby={headingId}>
                    {group.items.map((item) => {
                      const isActive = active === item.id;
                      return (
                        <li key={item.id}>
                          <Link
                            href={localeHref(locale, item.href)}
                            onClick={() => setOpen(false)}
                            aria-current={isActive ? "page" : undefined}
                            className={`flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm ${FOCUS} ${
                              isActive ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-700"
                            }`}
                          >
                            <AppNavIcon name={item.id} />
                            {labels[item.id]}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {group.id === "library" && (
                    <details className="group mt-1" open={active === "prompts"}>
                      <summary
                        className={`flex min-h-[44px] cursor-pointer list-none items-center gap-3 rounded-md px-3 text-sm text-zinc-700 [&::-webkit-details-marker]:hidden ${FOCUS}`}
                      >
                        <AppNavIcon name="prompts" />
                        <span className="flex-1">
                          {labels.prompts} · {labels.prompts_by_vertical.toLowerCase()}
                        </span>
                        <AppNavIcon name="chevron" className="h-4 w-4 transition-transform group-open:rotate-90" />
                      </summary>
                      <VerticalLinks
                        locale={locale}
                        allLabel={labels.all_prompts}
                        onNavigate={() => setOpen(false)}
                        className="ml-8 grid grid-cols-2 gap-0.5 [&_a]:min-h-[44px] [&_a]:py-2.5"
                      />
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
