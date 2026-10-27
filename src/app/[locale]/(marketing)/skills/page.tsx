import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewsletterForm from "@/components/NewsletterForm";
import BundleCard from "@/components/edit-bundle/BundleCard";
import SkillCard from "@/components/edit-bundle/SkillCard";
import { Badge, Card } from "@/components/ui";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { EDIT_SKILLS } from "@/lib/edit-bundle/catalog";
import { localeOf, pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("skills", localeOf(locale));
}

/* /skills (2026-10-27): arriba la categoria «Edicion de video» con los 9 skills del
 * ARTO Edit Bundle #1 (Victor, 27 oct 2026) y la tarjeta del bundle; abajo, la lista que estaba en
 * desarrollo, ahora como «Proximamente». La etiqueta Gratis/Pro sale de la fecha. */
export default async function SkillsPage({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const dict = getDictionary(locale);
  const t = dict.skills;
  const eb = dict.edit_bundle;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mb-12 max-w-3xl">
        <h1 className="text-h1">{t.h1}</h1>
        <span className="accent-rule mt-4" />
        <p className="mt-4 max-w-xl text-lg text-zinc-600">{t.hero_body}</p>
      </div>

      <section id="edicion-de-video" aria-labelledby="cat-video">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-zinc-500">{eb.hero_kicker}</p>
            <h2 id="cat-video" className="mt-2 text-3xl font-extrabold tracking-tight">{eb.category}</h2>
            <p className="mt-2 text-zinc-600">{eb.category_body}</p>
          </div>
        </div>
        <div className="mt-8">
          <BundleCard locale={locale} t={eb} now={now} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {EDIT_SKILLS.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} locale={locale} t={eb} now={now} />
          ))}
        </div>
      </section>

      <section className="mt-20" aria-labelledby="coming-soon">
        <div className="mb-6">
          <Badge tone="soon">{t.badge}</Badge>
          <h2 id="coming-soon" className="mt-3 text-2xl font-bold">{eb.coming_soon_h2}</h2>
          <p className="mt-2 font-mono text-xs text-zinc-500">{t.hero_pricing}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {t.list.map((skill) => (
            <Card key={skill.name} padding="sm" className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold">{skill.name}</h3>
                <Badge tone={skill.status === t.status_in_dev ? "live" : "soon"}>{skill.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-zinc-500">{skill.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mx-auto mt-12 max-w-4xl text-center" padding="lg">
        <h2 className="text-xl font-bold">{t.newsletter_h2}</h2>
        <p className="mt-2 text-sm text-zinc-500">{t.newsletter_body}</p>
        <div className="mx-auto mt-6 max-w-sm">
          <NewsletterForm source="skills" cta={t.newsletter_cta} locale={locale} />
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
