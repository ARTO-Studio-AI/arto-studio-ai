import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewsletterForm from "@/components/NewsletterForm";
import { Badge, Card } from "@/components/ui";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCatalog } from "@/lib/catalogo/efectivo";
import { formatModDate } from "@/lib/mods";
import { localeOf, pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

/* Desde el 2026-11-05 los mods se activan y desactivan desde /admin/skills sin redeploy, y
 * ahi se suben los nuevos: la pagina lee el estado efectivo en cada visita (cache de 60 s). */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("mods", localeOf(locale));
}

export default async function ModsPage({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = getDictionary(locale).mods;
  const mods = (await getCatalog()).publicMods();
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <div className="mb-12">
        <Badge tone="soon">{t.badge}</Badge>
        <h1 className="text-h1 mt-4">{t.h1}</h1>
        <span className="accent-rule mt-4" />
        <p className="mt-4 max-w-xl text-lg text-zinc-600">{t.hero_body}</p>
        <p className="mt-2 font-mono text-xs text-zinc-500">{t.hero_access}</p>
      </div>

      <div className="grid gap-4">
        {mods.map((mod) => {
          const c = mod.copy[locale];
          return (
            <Card key={mod.slug} padding="sm" className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-medium text-zinc-400">{mod.code}</span>
                  <h2 className="text-lg font-bold">{mod.name}</h2>
                </div>
                <Badge tone={mod.status === "published" ? "live" : "soon"}>
                  {mod.status === "published" ? t.status_published : `${t.status_upcoming} ${formatModDate(mod.releaseDate, locale)}`}
                </Badge>
              </div>
              <p className="mt-3 font-medium text-zinc-800">{c.tagline}</p>
              <p className="mt-2 text-sm text-zinc-500">{c.what}</p>
              <p className="text-eyebrow mt-4 text-zinc-500">{t.checked_label}</p>
              <ul className="mt-2 grid gap-1 text-sm text-zinc-600 sm:grid-cols-2">
                {c.checked.map((item) => (
                  <li key={item}>✓ {item}</li>
                ))}
              </ul>
              <p className="mt-4 font-mono text-xs text-zinc-400">
                v{mod.version} · {mod.author} · {mod.license}
              </p>
            </Card>
          );
        })}
        <Card padding="sm" className="p-5 text-sm text-zinc-500">{t.more_coming}</Card>
      </div>

      <div className="mt-12 border-t border-zinc-200 pt-12">
        <h2 className="mb-6 text-xl font-bold">{t.how_h2}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {t.how_steps.map((step) => (
            <Card key={step.n} padding="sm" className="p-5">
              <span className="font-mono text-xs font-medium text-zinc-400">{step.n}</span>
              <h3 className="mt-1 font-bold">{step.title}</h3>
              <p className="mt-2 text-sm text-zinc-500">{step.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      <Card className="mt-12 text-center" padding="lg">
        <h2 className="text-xl font-bold">{t.newsletter_h2}</h2>
        <p className="mt-2 text-sm text-zinc-500">{t.newsletter_body}</p>
        <div className="mx-auto mt-6 max-w-sm">
          <NewsletterForm source="general" cta={t.newsletter_cta} locale={locale} />
        </div>
      </Card>

      <div className="mt-8 text-center">
        <Link href={lp("/pricing")} className="text-sm text-zinc-500 hover:text-zinc-700">
          {t.back_link}
        </Link>
      </div>
    </div>
  );
}
