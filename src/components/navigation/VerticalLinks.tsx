"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { PROMPT_VERTICALS, activeVertical, localeHref } from "@/lib/app-nav";
import { VERTICALS, type Category } from "@/types/prompt";

/* Lista de verticales del catalogo (/prompts?category=...). La vertical activa sale de la query,
 * y useSearchParams va dentro de Suspense para no forzar render en cliente en paginas estaticas:
 * mientras resuelve se pinta la misma lista sin marca. La vertical usa aria-current="true" porque
 * el enlace «Prompts» ya lleva aria-current="page". */

interface Props {
  locale: Locale;
  allLabel: string;
  onNavigate?: () => void;
  className?: string;
}

function List({ locale, allLabel, onNavigate, className = "", active }: Props & { active: Category | null }) {
  const label = (c: Category) => (locale === "es" ? VERTICALS[c].label_es : VERTICALS[c].label_en);
  const item =
    "block rounded-md px-3 py-1.5 text-[13px] leading-5 transition hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900";
  return (
    <ul className={className}>
      <li>
        <Link href={localeHref(locale, "/prompts")} onClick={onNavigate} className={`${item} text-zinc-600`}>
          {allLabel}
        </Link>
      </li>
      {PROMPT_VERTICALS.map((c) => {
        const isActive = active === c;
        return (
          <li key={c}>
            <Link
              href={localeHref(locale, `/prompts?category=${c}`)}
              onClick={onNavigate}
              aria-current={isActive ? "true" : undefined}
              className={`${item} ${isActive ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-600"}`}
            >
              {label(c)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function WithParams(props: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  return <List {...props} active={activeVertical(pathname, props.locale, params.get("category"))} />;
}

export default function VerticalLinks(props: Props) {
  return (
    <Suspense fallback={<List {...props} active={null} />}>
      <WithParams {...props} />
    </Suspense>
  );
}
