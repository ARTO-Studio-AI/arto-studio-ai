import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCatalog } from "@/lib/catalogo/efectivo";
import { MiniMarkdown } from "@/lib/mini-markdown";
import { getModPage } from "@/lib/mod-pages";
import { buildMetadata, clampDescription, localeOf, withBrand } from "@/lib/seo";

/* Pagina de detalle de un mod (18 nov 2026, D37). El texto es la pagina publica aprobada
 * (src/content/mods/<slug>.<locale>.md); el estado es el efectivo (manifiesto + /admin/skills),
 * asi que un mod oculto da 404 sin redeploy. La descarga sale por /api/mod-downloads/<slug>,
 * que aplica la regla Pro. */

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = localeOf(localeParam);
  const mod = (await getCatalog()).getMod(slug);
  const page = mod ? getModPage(mod.slug, locale) : null;
  if (!mod || !page) return {};
  return buildMetadata({
    locale,
    path: `/mods/${mod.slug}`,
    title: withBrand(page.title),
    description: clampDescription(page.summary || mod.copy[locale].tagline),
  });
}

export default async function ModPage({ params }: Props) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const catalog = await getCatalog();
  const mod = catalog.getMod(slug);
  if (!mod) notFound();
  const page = getModPage(mod.slug, locale);
  if (!page) notFound();

  const t = getDictionary(locale).mods;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  const canDownload = Boolean(catalog.getModDownload(mod.slug));
  const downloadHref = `/api/mod-downloads/${mod.slug}?locale=${locale}`;

  const download = canDownload ? (
    <Card padding="sm" className="mt-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button href={downloadHref} size="md" prefetch={false}>
          {t.download_cta}
        </Button>
        <span className="font-mono text-xs text-zinc-500">v{mod.version}</span>
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        {t.download_note}{" "}
        <Link href={lp("/pricing")} className="underline underline-offset-2">
          {t.download_pricing}
        </Link>
      </p>
    </Card>
  ) : null;

  /* El boton va arriba y otra vez en el paso de la descarga de la guia. */
  const isDownloadStep = (text: string) => /^(Paso 1|Step 1)\b/.test(text);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <Link href={lp("/mods")} className="text-sm text-zinc-500 hover:text-zinc-700">
        {t.back_to_mods}
      </Link>
      <div className="mt-6 flex items-center gap-3">
        <span className="font-mono text-xs font-medium text-zinc-400">{mod.code}</span>
        <Badge tone={mod.status === "published" ? "live" : "soon"}>{mod.status === "published" ? t.status_published : t.status_soon}</Badge>
      </div>
      <h1 className="text-h1 mt-4">{page.title}</h1>
      <span className="accent-rule mt-4" />
      <p className="mt-4 text-lg text-zinc-600">{mod.copy[locale].tagline}</p>
      {download}
      <div className="mt-10">
        <MiniMarkdown blocks={page.blocks} options={{ afterHeading: (text) => (isDownloadStep(text) ? download : null) }} />
      </div>
      <div className="mt-12 text-center">
        <Link href={lp("/mods")} className="text-sm text-zinc-500 hover:text-zinc-700">
          {t.back_to_mods}
        </Link>
      </div>
    </div>
  );
}
