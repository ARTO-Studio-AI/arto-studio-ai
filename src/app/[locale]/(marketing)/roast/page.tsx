import type { Metadata } from "next";
import { localeOf, pageMetadata } from "@/lib/seo";
import RoastClient from "./RoastClient";

/* Brand Roast dentro del arbol [locale] (2026-10-06): hereda Nav y Footer del layout de
 * marketing. /roast?lang=xx y /roast redirigen aqui desde src/proxy.ts; la imagen OG
 * sigue en /roast/og (fuera del arbol, exenta del prefijo de idioma). */

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("roast", localeOf(locale));
}

export default async function RoastPage({ params }: Props) {
  const { locale } = await params;
  return <RoastClient lang={localeOf(locale)} />;
}
