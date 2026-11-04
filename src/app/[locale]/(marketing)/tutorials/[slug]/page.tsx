import { notFound, permanentRedirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getTutorial } from "@/lib/tutorials";

/* Alias en ingles (2026-11-05): /{locale}/tutorials/<slug> va a /{locale}/tutoriales/<slug>. */

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function TutorialAlias({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !getTutorial(slug)) notFound();
  permanentRedirect(`/${locale}/tutoriales/${slug}`);
}
