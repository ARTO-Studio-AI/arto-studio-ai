import { notFound } from "next/navigation";
import { JetBrains_Mono } from "next/font/google";
import { LOCALES, isLocale, type Locale } from "@/i18n/config";

/* Locale gate: validate that the [locale] segment is one we actually ship.
 * Anything outside LOCALES 404s here rather than rendering a half-broken
 * page. We also pre-generate the static params so /en and /es are rendered
 * at build time (per-segment caching).
 *
 * Tipografia: Archivo y Manrope se cargan en src/app/layout.tsx (root), que
 * lo lleva otro PR; ahi siguen con todos los pesos. Aqui solo se suma
 * JetBrains Mono 400/500 para eyebrows, IDs, conteos y scores. Recortar
 * Archivo a 500/700/800 y Manrope a 400/500/700 queda anotado para el PR
 * del root layout. */

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  // Cast for downstream type narrowing (not used directly here).
  void (locale as Locale);
  return <div className={`${jetbrains.variable} contents`}>{children}</div>;
}
