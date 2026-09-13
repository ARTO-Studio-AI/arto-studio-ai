"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  AI_GROUPS,
  CATEGORY_STYLES,
  DIFFICULTY_STYLES,
  TIER_STYLES,
  VERTICALS,
  aiGroupOf,
  type Prompt,
} from "@/types/prompt";
import { t, type Lang, AI_GROUP_LABEL_ES, DIFFICULTY_LABEL_ES, VERTICAL_LABEL_ES } from "@/lib/i18n";
import { track } from "@/lib/analytics";

interface SearchResult {
  explanation: string;
  prompts: Pick<Prompt, "id" | "title_en" | "title_es" | "category" | "subcategory" | "ai_model" | "difficulty" | "tier" | "tags">[];
  lang: Lang;
}

const EXAMPLES_EN = [
  "I'm launching a craft beer brand and need naming + visual identity",
  "I'm directing a 30-second product video and need shot list + script ideas",
  "I need landing page copy for a B2B SaaS",
];
const EXAMPLES_ES = [
  "Estoy lanzando una marca de cerveza artesanal y necesito naming + identidad visual",
  "Voy a dirigir un video de producto de 30 segundos y necesito shot list + ideas de guion",
  "Necesito copy para una landing de SaaS B2B",
];

// Render **bold** segments inside the explanation text.
function renderRichText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<strong key={key++} className="font-semibold text-zinc-900">{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function SmartSearch({ lang = "en" }: { lang?: Lang }) {
  const dict = t(lang);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);

  const examples = lang === "es" ? EXAMPLES_ES : EXAMPLES_EN;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || query.trim().length < 8) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), lang }),
      });
      const data = await resp.json();
      track("search_performed", {
        lang,
        query_length: query.trim().length,
        results_count: resp.ok && Array.isArray(data?.prompts) ? data.prompts.length : 0,
        ok: resp.ok,
      });
      if (!resp.ok) {
        setError(data.error || "Search failed");
      } else {
        setResult(data);
      }
    } catch {
      track("search_performed", { lang, query_length: query.trim().length, results_count: 0, ok: false });
      setError(lang === "es" ? "Error de red. Intenta otra vez." : "Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-md)] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {dict.smart_search}
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-900 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-white">
          AI
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {dict.smart_search_hint}
      </p>

      <form onSubmit={onSubmit} className="mt-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder={dict.smart_search_placeholder}
          className="block w-full resize-none rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
          maxLength={1000}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 text-[11px]">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className="rounded-full border border-zinc-200 px-2 py-1 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
              >
                {ex.slice(0, 40)}…
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || query.trim().length < 8}
            className="rounded-[var(--radius-sm)] bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? dict.smart_search_thinking : dict.smart_search_cta}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-zinc-300 bg-zinc-50 p-3 text-sm text-[var(--bad)]">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          {result.explanation && (
            <div className="rounded-[var(--radius-lg)] border border-zinc-200 border-l-4 border-l-[var(--accent)] bg-white p-6 shadow-[var(--shadow-sm)]">
              <div className="mb-3 flex items-center gap-2 text-eyebrow text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                <span>{dict.smart_search_recommendation}</span>
              </div>
              <div className="whitespace-pre-line text-base leading-relaxed text-zinc-800">
                {renderRichText(result.explanation)}
              </div>
            </div>
          )}
          {result.prompts.length === 0 ? (
            <p className="text-sm text-zinc-500">{dict.no_match}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.prompts.map((p) => {
                const title = result.lang === "es" ? p.title_es : p.title_en;
                const cat = CATEGORY_STYLES[p.category];
                const diff = DIFFICULTY_STYLES[p.difficulty];
                const tier = TIER_STYLES[p.tier];
                const aiInfo = AI_GROUPS[aiGroupOf(p.ai_model)];
                const catLabel = result.lang === "es"
                  ? VERTICAL_LABEL_ES[p.category] ?? VERTICALS[p.category].label_en
                  : VERTICALS[p.category].label_en;
                const diffLabel = result.lang === "es"
                  ? DIFFICULTY_LABEL_ES[p.difficulty] ?? diff.label
                  : diff.label;
                const aiLabel = result.lang === "es"
                  ? AI_GROUP_LABEL_ES[aiGroupOf(p.ai_model)] ?? aiInfo.label
                  : aiInfo.label;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/${result.lang}/prompts/${p.id}`}
                      className="block h-full rounded-[var(--radius-md)] border border-zinc-200 bg-white p-3 transition hover:border-zinc-400 hover:shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-zinc-400">{p.id}</span>
                        <span className={`rounded-full ${tier.chip} px-2 py-0.5 text-[11px] font-medium`}>
                          {tier.label}
                        </span>
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-sm font-medium">{title}</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        <span className={`rounded-full ${cat.chip} px-2 py-0.5`}>{catLabel}</span>
                        <span className={`rounded-full ${diff.chip} px-2 py-0.5`}>{diffLabel}</span>
                        <span className={`rounded-full ${aiInfo.chip} px-2 py-0.5`}>{aiLabel}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
