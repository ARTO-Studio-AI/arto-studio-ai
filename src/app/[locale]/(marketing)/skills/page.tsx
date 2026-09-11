import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewsletterForm from "@/components/NewsletterForm";
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
        <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
          {t.badge}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{t.h1}</h1>
        <p className="mt-3 max-w-xl text-lg text-neutral-600">{t.hero_body}</p>
        <p className="mt-2 text-sm text-neutral-500">{t.hero_pricing}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {t.list.map((skill) => (
          <div key={skill.name} className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{skill.name}</h3>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  skill.status === t.status_in_dev
                    ? "bg-blue-50 text-blue-700"
                    : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {skill.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-500">{skill.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-neutral-200 bg-white p-8 text-center">
        <h2 className="text-xl font-bold">{t.newsletter_h2}</h2>
        <p className="mt-2 text-sm text-neutral-500">{t.newsletter_body}</p>
        <div className="mx-auto mt-6 max-w-sm">
          <NewsletterForm source="skills" cta={t.newsletter_cta} />
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href={lp("/pricing")} className="text-sm text-neutral-500 hover:text-neutral-700">
          {t.back_link}
        </Link>
      </div>
    </div>
  );
}
