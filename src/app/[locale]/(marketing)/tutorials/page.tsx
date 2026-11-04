import { notFound, permanentRedirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { isTutorialTool } from "@/lib/tutorials";

/* Alias en ingles (2026-11-05): la ruta canonica es /{locale}/tutoriales en los dos idiomas. */

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TutorialsAlias({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const tool = Array.isArray(sp.tool) ? sp.tool[0] : sp.tool;
  permanentRedirect(`/${locale}/tutoriales${isTutorialTool(tool) ? `?tool=${tool}` : ""}`);
}
