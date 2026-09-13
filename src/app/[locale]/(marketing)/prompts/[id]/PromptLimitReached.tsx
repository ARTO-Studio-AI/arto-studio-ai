import type { Locale } from "@/i18n/config";
import { FREE_DAILY_OPENS } from "@/lib/prompt-limit";
import TrackedLink from "@/components/analytics/TrackedLink";

/* Pantalla de tope del contador free. No renderiza el cuerpo del prompt.
 * Copy fijo en ES/EN; la hora local de Madrid y Hermosillo se calcula con
 * Intl para que no quede mal cuando cambia el horario de verano.
 * Los tres CTAs mandan limit_cta_clicked (pricing | library | signup); el
 * free_limit_reached lo dispara la pagina al montar. */

interface Props {
  locale: Locale;
  title: string;
  promptId: string;
  signedIn: boolean;
  resetsAtUtc: string;
}

function localTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export default function PromptLimitReached({ locale, title, promptId, signedIn, resetsAtUtc }: Props) {
  const es = locale === "es";
  const madrid = localTime(resetsAtUtc, "Europe/Madrid");
  const hermosillo = localTime(resetsAtUtc, "America/Hermosillo");
  const n = FREE_DAILY_OPENS;

  const copy = es
    ? {
        eyebrow: "Tope diario",
        body: `Abriste tus ${n} prompts gratis de hoy. Se reinicia a las 00:00 UTC (${madrid} en Madrid, ${hermosillo} en Hermosillo).`,
        primary: "Pasa a Pro por $9 USD al mes: los 3,001 prompts sin límite",
        secondary: "Volver a la biblioteca",
        signup: "Crea tu cuenta gratis",
        signupNote: "No da más aperturas, pero guarda tus favoritos y colecciones.",
      }
    : {
        eyebrow: "Daily limit",
        body: `You opened your ${n} free prompts for today. Resets at 00:00 UTC (${madrid} in Madrid, ${hermosillo} in Hermosillo).`,
        primary: "Go Pro for $9 USD a month: all 3,001 prompts, no daily limit",
        secondary: "Back to the library",
        signup: "Create your free account",
        signupNote: "It does not add opens, but it saves your favorites and collections.",
      };

  return (
    <section
      className="mt-6 rounded-[16px] border border-zinc-200 bg-white p-6 sm:p-8"
      data-testid="prompt-limit-reached"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">{copy.eyebrow}</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">{title}</h2>
      <p className="mt-1 font-mono text-[11px] text-zinc-400">{promptId}</p>
      <p className="mt-4 max-w-xl text-sm text-zinc-700">{copy.body}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <TrackedLink
          event="limit_cta_clicked"
          props={{ cta: "pricing", prompt_id: promptId, locale }}
          href={`/${locale}/pricing`}
          className="inline-flex items-center rounded-[6px] bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          {copy.primary}
        </TrackedLink>
        <TrackedLink
          event="limit_cta_clicked"
          props={{ cta: "library", prompt_id: promptId, locale }}
          href={`/${locale}/prompts`}
          className="inline-flex items-center rounded-[6px] border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          {copy.secondary}
        </TrackedLink>
      </div>
      {!signedIn && (
        <p className="mt-5 text-xs text-zinc-500">
          <TrackedLink
            event="limit_cta_clicked"
            props={{ cta: "signup", prompt_id: promptId, locale }}
            href={`/${locale}/login`}
            className="font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900"
          >
            {copy.signup}
          </TrackedLink>{" "}
          {copy.signupNote}
        </p>
      )}
    </section>
  );
}
