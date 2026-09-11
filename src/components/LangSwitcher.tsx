"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOCALES, LOCALE_META, type Locale, isLocale } from "@/i18n/config";

/* Flag-based language switcher.
 *
 * UX model: click-to-toggle, click-outside / Escape to close. Hover-based
 * dropdowns break when there's any visual gap between trigger and menu —
 * the mouse leaves the absolutely-positioned wrapper for a frame and the
 * menu closes before the user can click an option. Sticking to click
 * avoids that whole class of bug.
 *
 * Locale derivation is deterministic from the URL: the proxy guarantees
 * every public path starts with /<locale>/, so we strip the first segment
 * and replace it. If the URL has no locale prefix (e.g. /api, /admin,
 * /studio, /roast), we anchor to /<new>/.
 */

interface Props {
  current: Locale;
}

function swapLocale(pathname: string, current: Locale, next: Locale): string {
  const segs = pathname.replace(/^\/+/, "").split("/");
  if (segs.length > 0 && isLocale(segs[0])) {
    segs[0] = next;
    return "/" + segs.join("/");
  }
  // Pathname had no locale prefix — anchor to the new locale root.
  const cleaned = pathname.replace(new RegExp(`^/${current}(?=/|$)`), "");
  return `/${next}${cleaned || "/"}`.replace(/\/+$/, "") || `/${next}`;
}

export default function LangSwitcher({ current }: Props) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-sm text-zinc-700 transition hover:border-zinc-400"
        aria-label={`Language: ${LOCALE_META[current].label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-base leading-none" aria-hidden>
          {LOCALE_META[current].flag}
        </span>
        <span className="text-xs font-medium uppercase">{current}</span>
        <svg
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {LOCALES.map((loc) => {
            const meta = LOCALE_META[loc];
            const active = loc === current;
            return (
              <Link
                key={loc}
                role="menuitem"
                href={swapLocale(pathname, current, loc)}
                onClick={() => {
                  // Remember the choice for 1 year. The proxy honors this
                  // cookie on subsequent locale-less visits (e.g. someone
                  // typing creative.artostudio.ai/ in the address bar).
                  document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000; samesite=lax`;
                  setOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 text-sm ${
                  active ? "bg-zinc-50 font-semibold text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {meta.flag}
                </span>
                <span>{meta.nativeName}</span>
                {active && <span className="ml-auto text-xs text-zinc-400">●</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
