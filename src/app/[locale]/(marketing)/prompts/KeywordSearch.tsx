"use client";

/* Busqueda por palabra del catalogo (D28, 2026-10-23). Filtra mientras escribes: espera 250 ms
 * sin teclear y cambia ?q= en la URL; el servidor responde con la lista ya filtrada. Sin
 * JavaScript funciona igual como formulario GET. La busqueda inteligente queda debajo para
 * frases largas. */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { MAX_QUERY_LENGTH } from "@/lib/catalog-search";
import type { Lang } from "@/lib/i18n";

const DEBOUNCE_MS = 250;

interface Props {
  lang: Lang;
  q: string;
  /* Los demas filtros activos (categoria, herramienta, dificultad, plan), para no perderlos. */
  filters: Record<string, string>;
  resultsCount: number;
}

const COPY = {
  es: {
    label: "Buscar por palabra",
    placeholder: "Busca por palabra o código",
    clear: "Borrar búsqueda",
    results: (n: number) => (n === 1 ? "1 resultado" : `${n.toLocaleString("es-MX")} resultados`),
    searching: "Buscando…",
  },
  en: {
    label: "Search by keyword",
    placeholder: "Search by keyword or code",
    clear: "Clear search",
    results: (n: number) => (n === 1 ? "1 result" : `${n.toLocaleString("en-US")} results`),
    searching: "Searching…",
  },
};

export default function KeywordSearch({ lang, q, filters, resultsCount }: Props) {
  const copy = COPY[lang];
  const router = useRouter();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si la URL cambia por fuera (limpiar filtros, atras), el campo la sigue.
  useEffect(() => {
    setValue(q);
  }, [q]);

  // Una medicion por consulta que llego a mostrarse.
  useEffect(() => {
    if (q) track("catalog_search", { lang, query_length: q.length, results_count: resultsCount });
  }, [q, resultsCount, lang]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function go(next: string) {
    const params = new URLSearchParams(filters);
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    const qs = params.toString();
    startTransition(() => {
      router.replace(`/${lang}/prompts${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(next), DEBOUNCE_MS);
  }

  return (
    <form
      role="search"
      action={`/${lang}/prompts`}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
    >
      {Object.entries(filters).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="catalog-q" className="sr-only">
        {copy.label}
      </label>
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 4 4" strokeLinecap="round" />
        </svg>
        <input
          id="catalog-q"
          name="q"
          type="search"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={MAX_QUERY_LENGTH}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={copy.placeholder}
          className="block h-12 w-full rounded-[var(--radius-lg)] border border-zinc-300 bg-white pl-12 pr-12 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={copy.clear}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-900"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <p className="mt-2 min-h-[1.25rem] font-mono text-xs text-zinc-500" aria-live="polite">
        {pending ? copy.searching : q ? copy.results(resultsCount) : ""}
      </p>
    </form>
  );
}
