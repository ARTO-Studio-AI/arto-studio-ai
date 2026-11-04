import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { localeOf, pageMetadata } from "@/lib/seo";
import { safeNextPath } from "@/lib/safe-next";
import { getSignupStats } from "@/lib/signup-stats";
import { formatCount, pathSection } from "@/lib/signup-bar";
import { FREE_DAILY_OPENS } from "@/lib/prompt-limit";
import { VERTICALS } from "@/types/prompt";
import TrackOnMount from "@/components/analytics/TrackOnMount";
import LoginForm from "./LoginForm";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("login", localeOf(locale));
}

/* Registro free (2026-10-06): la misma pantalla sirve para crear la cuenta gratis y para
 * entrar. `next` se valida aqui (safeNextPath, H-46) y otra vez en /auth/callback.
 *
 * Conversion (2026-11-05, 0 registros en 7 dias): la pagina vende la cuenta antes de
 * pedirla. Beneficios con numeros reales de la base (getSignupStats, cache de una hora),
 * tres prompts free de ejemplo y una linea de confianza. En celular los beneficios van
 * arriba del formulario y los ejemplos abajo; en escritorio, el formulario a la derecha.
 * Sin numeros (base caida) se muestran los mismos textos sin cifras. La autenticacion
 * vive en LoginForm y no cambio. */

const VERTICAL_COUNT = Object.keys(VERTICALS).length;

const COPY = {
  es: {
    eyebrow: "Cuenta gratis · ARTO Studio AI",
    h1_before: "Abre",
    h1_accent: (free: string) => `${free} prompts gratis`,
    h1_after: "con tu cuenta",
    h1_plain: "Crea tu cuenta gratis",
    lead: "Prompts de branding, diseño, copy, video y marketing escritos con la metodología de ARTO. Entras con Google en un clic o con un enlace a tu correo. Si ya tienes cuenta, entras igual.",
    benefits: (s: { free: string; total: string } | null) => [
      {
        title: s ? `${s.free} prompts gratis completos` : "Prompts gratis completos",
        body: `Ábrelos y cópialos enteros, hasta ${FREE_DAILY_OPENS} al día.`,
      },
      {
        title: s ? `${s.total} prompts en ${VERTICAL_COUNT} verticales` : `Todo el catálogo en ${VERTICAL_COUNT} verticales`,
        body: "Busca en todo el catálogo, en español y en inglés.",
      },
      { title: "Favoritos y colecciones", body: "Guarda los que te sirven y ármalos por proyecto." },
      { title: "Lo nuevo primero", body: "Te avisamos antes que a nadie cuando salgan los packs de skills." },
    ],
    examples_title: "Tres de los que abres hoy",
    free_chip: "Gratis",
    card_title: "Crea tu cuenta o entra",
    trust: ["Sin tarjeta", "Sin compromiso", "Solo te escribimos si marcas la casilla"],
    by: "Por ARTO, agencia creativa desde 2009",
  },
  en: {
    eyebrow: "Free account · ARTO Studio AI",
    h1_before: "Open",
    h1_accent: (free: string) => `${free} free prompts`,
    h1_after: "with your account",
    h1_plain: "Create your free account",
    lead: "Branding, design, copy, video and marketing prompts written with ARTO's method. Sign in with Google in one click or with a link to your email. Already have an account? Same way in.",
    benefits: (s: { free: string; total: string } | null) => [
      {
        title: s ? `${s.free} full free prompts` : "Full free prompts",
        body: `Open and copy them whole, up to ${FREE_DAILY_OPENS} a day.`,
      },
      {
        title: s ? `${s.total} prompts across ${VERTICAL_COUNT} verticals` : `The whole catalog across ${VERTICAL_COUNT} verticals`,
        body: "Search the full catalog, in English and Spanish.",
      },
      { title: "Favorites and collections", body: "Save the ones that work and group them by project." },
      { title: "New stuff first", body: "We tell you before anyone else when the skill packs ship." },
    ],
    examples_title: "Three you can open today",
    free_chip: "Free",
    card_title: "Create your account or sign in",
    trust: ["No card needed", "No commitment", "We only email you if you tick the box"],
    by: "By ARTO, creative agency since 2009",
  },
} as const;

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent)]">
      <circle cx="9" cy="9" r="9" fill="currentColor" opacity="0.14" />
      <path d="M5.5 9.2l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function LoginPage({ params, searchParams }: Props) {
  const [{ locale: localeParam }, sp] = await Promise.all([params, searchParams]);
  const locale = localeOf(localeParam);
  const next = safeNextPath(sp.next, "", process.env.NEXT_PUBLIC_SITE_URL || "https://creative.artostudio.ai") || undefined;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) redirect(next ?? `/${locale}`);

  const t = COPY[locale];
  const stats = await getSignupStats();
  const nums = stats ? { free: formatCount(stats.free, locale), total: formatCount(stats.total, locale) } : null;
  const benefits = t.benefits(nums);
  const examples = stats?.examples ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <TrackOnMount
        event="login_viewed"
        props={{ locale, has_next: !!next, next_section: next ? pathSection(next.split("?")[0]) : "" }}
      />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-x-14 lg:gap-y-10">
        <section className="lg:col-start-1 lg:row-start-1">
          <p className="text-eyebrow text-[var(--accent)]">{t.eyebrow}</p>
          <h1 className="text-h1 mt-3 text-zinc-900">
            {nums ? (
              <>
                {t.h1_before} <span className="serif-accent">{t.h1_accent(nums.free)}</span> {t.h1_after}
              </>
            ) : (
              t.h1_plain
            )}
          </h1>
          {/* En celular el lead se oculta para que Google quede arriba del pliegue (375x812). */}
          <p className="mt-4 hidden max-w-[52ch] text-base leading-relaxed text-zinc-600 sm:block">{t.lead}</p>
          <ul className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2">
            {benefits.map((b) => (
              <li key={b.title} className="flex gap-2.5">
                <Check />
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">{b.title}</span>
                  <span className="block text-sm text-zinc-600">{b.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 shadow-[var(--shadow-md)] sm:p-7">
            <h2 className="text-lg font-extrabold text-zinc-900">{t.card_title}</h2>
            <div className="mt-5">
              <LoginForm locale={locale} next={next} />
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-zinc-600">
            {t.trust.map((line) => (
              <li key={line} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                {line}
              </li>
            ))}
          </ul>
          <p className="text-eyebrow mt-3 text-center text-zinc-500">{t.by}</p>
        </section>

        {examples.length > 0 && (
          <section className="lg:col-start-1 lg:row-start-2">
            {/* p y no h2: el estilo global de h2 le gana a text-eyebrow. */}
            <p className="text-eyebrow text-zinc-500">{t.examples_title}</p>
            <ul className="mt-3 grid gap-3">
              {examples.map((p) => {
                const v = VERTICALS[p.category];
                return (
                  <li key={p.id} className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-zinc-200 bg-white p-4">
                    <span className="min-w-0">
                      <span className="text-eyebrow block text-zinc-500">{v ? (locale === "es" ? v.label_es : v.label_en) : p.category}</span>
                      <span className="mt-1 block font-semibold leading-snug text-zinc-900">{locale === "es" ? p.title_es : p.title_en}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-zinc-900">{t.free_chip}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
