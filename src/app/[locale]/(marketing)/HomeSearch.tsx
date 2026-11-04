"use client";

/* Buscador abierto de la home (2026-11-05). Es un formulario GET a /{locale}/prompts?q=, el
 * mismo parametro que lee la busqueda por palabra del catalogo, asi que sin JavaScript funciona
 * igual. Con JavaScript solo se mide el envio y se deja que el navegador siga; la llegada al
 * catalogo ya se mide aparte con catalog_search. */
import { Button } from "@/components/ui";
import { track } from "@/lib/analytics";
import { MAX_QUERY_LENGTH } from "@/lib/catalog-search";
import type { Locale } from "@/i18n/config";

interface Props {
  locale: Locale;
  label: string;
  placeholder: string;
  button: string;
}

export default function HomeSearch({ locale, label, placeholder, button }: Props) {
  return (
    <form
      role="search"
      action={`/${locale}/prompts`}
      method="get"
      onSubmit={(e) => {
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        if (q) track("home_search_submitted", { locale, query_length: q.length });
      }}
      className="flex flex-col gap-2.5 sm:flex-row"
    >
      <label htmlFor="home-q" className="sr-only">
        {label}
      </label>
      <div className="relative min-w-0 flex-1">
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
          id="home-q"
          name="q"
          type="search"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          required
          maxLength={MAX_QUERY_LENGTH}
          placeholder={placeholder}
          className="block h-12 w-full rounded-[var(--radius-lg)] border border-zinc-300 bg-white pl-12 pr-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
        />
      </div>
      <Button type="submit" size="lg" className="h-12">
        {button}
      </Button>
    </form>
  );
}
