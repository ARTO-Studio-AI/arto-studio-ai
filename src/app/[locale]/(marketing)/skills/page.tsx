import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewsletterForm from "@/components/NewsletterForm";
import { Badge, Card } from "@/components/ui";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localeOf, pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("skills", localeOf(locale));
}

export default async function SkillsPage({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = getDictionary(locale).skills;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <div className="mb-12">
        <Badge tone="soon">{t.badge}</Badge>
        <h1 className="text-h1 mt-4">{t.h1}</h1>
        <span className="accent-rule mt-4" />
        <p className="mt-4 max-w-xl text-lg text-zinc-600">{t.hero_body}</p>
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

      <Card className="mt-12 text-center" padding="lg">
        <h2 className="text-xl font-bold">{t.newsletter_h2}</h2>
        <p className="mt-2 text-sm text-zinc-500">{t.newsletter_body}</p>
        <div className="mx-auto mt-6 max-w-sm">
          <NewsletterForm source="skills" cta={t.newsletter_cta} />
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
