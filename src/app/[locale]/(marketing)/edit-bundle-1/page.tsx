import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DownloadCta from "@/components/edit-bundle/DownloadCta";
import InstallSteps from "@/components/edit-bundle/InstallSteps";
import SkillCard from "@/components/edit-bundle/SkillCard";
import { Badge } from "@/components/ui";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { isPromoActive } from "@/lib/edit-bundle/access";
import { EDIT_BUNDLE_PAGE, EDIT_BUNDLE_SLUG, EDIT_SKILLS, getDownloadItem } from "@/lib/edit-bundle/catalog";
import { getViewer } from "@/lib/edit-bundle/viewer";
import { buildMetadata, localeOf } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = localeOf(raw);
  const t = getDictionary(locale).edit_bundle;
  return buildMetadata({ locale, path: EDIT_BUNDLE_PAGE, title: `${t.meta_title} · ARTO Studio AI`, description: t.meta_description });
}

/* Landing del ARTO Edit Bundle #1 (Victor, 27 oct 2026): es el enlace del DM «Comenta EDITA». Hero con el
 * boton principal (crear cuenta y descargar el bundle completo), las 9 tarjetas con su demo,
 * como instalarlo y las preguntas frecuentes. */
export default async function EditBundleLanding({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = getDictionary(locale).edit_bundle;
  const viewer = await getViewer();
  const now = new Date();
  const promo = isPromoActive(now);
  const bundle = getDownloadItem(EDIT_BUNDLE_SLUG);

  return (
    <div>
      <section className="border-b border-zinc-200 bg-[var(--paper,#F6F5F2)]">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-zinc-500">{t.hero_kicker}</p>
          <h1 className="text-h1 mt-4">{t.bundle_name}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-zinc-700">{t.bundle_tagline}</p>
          <div className="mt-5 flex justify-center">
            <Badge tone={promo ? "live" : "inverse"}>{promo ? t.bundle_included_promo : t.bundle_included}</Badge>
          </div>
          <div className="mt-8 flex justify-center">
            <DownloadCta locale={locale} slug={EDIT_BUNDLE_SLUG} viewer={viewer} t={t} now={now} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-h2">{t.cards_h2}</h2>
        <p className="mt-3 max-w-2xl text-zinc-600">{t.cards_body}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {EDIT_SKILLS.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} locale={locale} t={t} now={now} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <InstallSteps t={t} fileName={bundle?.downloadName ?? "arto-edit-bundle-1.zip"} bundle />
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-2xl font-bold">{t.faq_h2}</h2>
        <div className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
          {t.faq.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="cursor-pointer list-none font-semibold text-zinc-900">
                {f.q}
              </summary>
              <p className="mt-2 text-zinc-600">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <DownloadCta locale={locale} slug={EDIT_BUNDLE_SLUG} viewer={viewer} t={t} now={now} size="md" />
          <Link href={`/${locale}/skills`} className="text-sm text-zinc-500 hover:text-zinc-800">
            {t.back_to_skills}
          </Link>
        </div>
      </section>
    </div>
  );
}
