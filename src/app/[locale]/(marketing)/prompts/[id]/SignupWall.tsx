import type { Locale } from "@/i18n/config";
import TrackedLink from "@/components/analytics/TrackedLink";

/* Registro free (2026-10-06, decision de Victor): sin cuenta se ve el inicio del prompt
 * y el resto pide crear la cuenta gratis. El adelanto mantiene algo de texto indexable
 * para SEO sin entregar el prompt completo. No cuenta como apertura. */

interface Props {
  locale: Locale;
  promptId: string;
  teaser: string;
}

export default function SignupWall({ locale, promptId, teaser }: Props) {
  const es = locale === "es";
  const next = `/${locale}/prompts/${promptId}`;
  const copy = es
    ? {
        title: "Crea tu cuenta gratis para ver el prompt completo",
        body: "Es gratis y toma un minuto: con tu correo o con Google. Con tu cuenta abres los prompts gratis, guardas favoritos y te avisamos primero de los packs de skills.",
        cta: "Crear cuenta gratis",
        login: "Ya tengo cuenta",
      }
    : {
        title: "Create your free account to see the full prompt",
        body: "It is free and takes a minute: with your email or Google. Your account opens the free prompts, saves favorites and gets you first in line for the skill packs.",
        cta: "Create free account",
        login: "I already have an account",
      };
  const href = `/${locale}/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="relative mt-3" data-testid="signup-wall">
      <p className="whitespace-pre-wrap break-words text-zinc-700">{teaser}</p>
      <div className="pointer-events-none -mt-10 h-10 bg-gradient-to-b from-transparent to-white" aria-hidden="true" />
      <div className="mt-4 rounded-[var(--radius-md)] border border-zinc-200 bg-zinc-50 p-5">
        <p className="font-semibold text-zinc-900">{copy.title}</p>
        <p className="mt-1 text-sm text-zinc-600">{copy.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TrackedLink
            event="signup_wall_clicked"
            props={{ prompt_id: promptId, locale }}
            href={href}
            className="inline-flex items-center rounded-[6px] bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            {copy.cta}
          </TrackedLink>
          <a href={href} className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline">
            {copy.login}
          </a>
        </div>
      </div>
    </div>
  );
}
