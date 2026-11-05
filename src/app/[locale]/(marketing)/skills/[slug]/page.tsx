import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DemoVideo from "@/components/edit-bundle/DemoVideo";
import DownloadCta from "@/components/edit-bundle/DownloadCta";
import InstallSteps from "@/components/edit-bundle/InstallSteps";
import { Badge } from "@/components/ui";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { priceLabelFor } from "@/lib/catalogo/access";
import { getCatalog } from "@/lib/catalogo/efectivo";
import { demoOf, getCategory, type CatalogSkill, type SkillCategory } from "@/lib/catalogo/skills";
import { EDIT_BUNDLE_PAGE, EDIT_BUNDLE_SLUG } from "@/lib/edit-bundle/catalog";
import { getViewer } from "@/lib/edit-bundle/viewer";
import { buildMetadata, clampDescription, localeOf, withBrand } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

/* Lo que cambia entre el bundle y una categoria nueva (2026-11-05): el bundle conserva su
 * nombre en el titulo y su aviso de ChatGPT; un skill de otra categoria usa el de su ficha. */
function contextOf(skill: CatalogSkill, locale: Locale) {
  const category = getCategory(skill.category) as SkillCategory;
  const t = getDictionary(locale).edit_bundle;
  const inBundle = category.bundle === EDIT_BUNDLE_SLUG;
  return {
    category,
    inBundle,
    titleSuffix: inBundle ? t.bundle_name : category.name[locale],
    chatgptNote: skill.chatgptNote?.[locale] ?? (inBundle ? t.chatgpt_note : null),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = localeOf(raw);
  const skill = (await getCatalog()).getSkill(slug);
  if (!skill) return {};
  const ctx = contextOf(skill, locale);
  const demo = demoOf(skill.slug);
  return buildMetadata({
    locale,
    path: `/skills/${skill.slug}`,
    title: withBrand(`${skill.name[locale]}: ${skill.tagline[locale].replace(/\.$/, "")} · ${ctx.titleSuffix}`),
    description: clampDescription(ctx.chatgptNote ? `${skill.what[locale]} ${ctx.chatgptNote}` : skill.what[locale]),
    ogImage: demo.poster ?? undefined,
  });
}

/* Pagina de cada skill del ARTO Edit Bundle #1 (Victor, 27 oct 2026): demo grande, que hace, que le dices
 * a Claude, que necesitas, cuanto tarda, como instalarlo y el boton de descarga.
 * Desde el 2026-11-05 sirve a todo el catalogo: un skill oculto es 404 y uno en coming_soon
 * tiene pagina con el boton de «Disponible muy pronto». El estado es el efectivo (manifiesto +
 * /admin/skills) y tambien salen los skills subidos desde /admin. */
export default async function EditSkillPage({ params }: Props) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const catalog = await getCatalog();
  const skill = catalog.getSkill(slug);
  if (!skill) notFound();
  const item = catalog.getDownloadItem(slug);

  const t = getDictionary(locale).edit_bundle;
  const soonLabel = getDictionary(locale).skills.badge;
  const ctx = contextOf(skill, locale);
  const viewer = await getViewer();
  const now = new Date();
  const demo = demoOf(skill.slug);
  const soon = skill.status === "coming_soon";
  /* Sin video y fuera del bundle de video, el bloque 9:16 de «Demo en camino» ocupaba toda la
   * primera pantalla del celular; esos skills abren directo con su contenido (2026-11-05). */
  const showDemo = Boolean(demo.video) || ctx.inBundle;
  const label = soon ? soonLabel : priceLabelFor(ctx.category.access, now) === "free" ? t.label_free : t.label_pro;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <Link href={`/${locale}/skills`} className="text-sm text-zinc-500 hover:text-zinc-800">
        {t.back_to_skills}
      </Link>

      <div className={showDemo ? "mt-6 grid gap-10 md:grid-cols-[minmax(0,360px)_1fr] md:items-start" : "mt-6 max-w-3xl"}>
        {showDemo && (
          <DemoVideo video={demo.video} poster={demo.poster} label={skill.name[locale]} missingLabel={t.demo_missing} className="mx-auto max-w-[360px]" />
        )}

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={soon ? "soon" : label === t.label_pro ? "inverse" : "live"}>{label}</Badge>
            <Badge tone="neutral">{ctx.category.name[locale]}</Badge>
            <Badge tone="neutral">v{skill.version}</Badge>
            {skill.placeholder && <Badge tone="soon">{t.draft_badge}</Badge>}
          </div>
          <h1 className="text-h1 mt-4">{skill.name[locale]}</h1>
          <p className="mt-3 text-lg text-zinc-600">{skill.tagline[locale]}</p>
          {ctx.inBundle && (
            <Link href={`/${locale}${EDIT_BUNDLE_PAGE}`} className="mt-2 inline-block text-sm text-zinc-500 underline-offset-2 hover:underline">
              {t.part_of_bundle}
            </Link>
          )}

          <div className="mt-8">
            <DownloadCta locale={locale} slug={skill.slug} viewer={viewer} t={t} now={now} />
          </div>

          <section className="mt-10">
            <h2 className="text-xl font-bold">{t.what_h2}</h2>
            <p className="mt-2 text-zinc-700">{skill.what[locale]}</p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-bold">{t.you_say_h2}</h2>
            <ul className="mt-3 space-y-2">
              {skill.youSay[locale].map((s) => (
                <li key={s} className="rounded-[var(--radius-sm)] border border-zinc-200 bg-zinc-50 px-4 py-2 font-mono text-sm text-zinc-800">
                  «{s}»
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <section>
              <h2 className="text-xl font-bold">{t.needs_h2}</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-zinc-700">
                {skill.needs[locale].map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-bold">{t.time_h2}</h2>
              <p className="mt-3 text-zinc-700">{skill.time[locale]}</p>
            </section>
          </div>
        </div>
      </div>

      <div className="mt-16">
        <InstallSteps t={t} fileName={item?.downloadName ?? `${skill.slug}.skill`} chatgptNote={ctx.chatgptNote} />
      </div>
    </div>
  );
}
