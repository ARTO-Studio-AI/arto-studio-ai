import type { Metadata } from "next";
import { headers } from "next/headers";
import { Archivo, Manrope } from "next/font/google";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { DEFAULT_OG_IMAGE_PATH, LOCALE_HEADER, SITE_NAME, absoluteUrl, siteUrl } from "@/lib/seo";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

/* Global defaults. Every page under [locale] overrides title, description,
 * canonical, hreflang and Open Graph through src/lib/seo.ts; these values
 * only reach the routes outside the locale tree (/studio, /upgrade,
 * /welcome, /admin). metadataBase makes every relative URL absolute against
 * the canonical origin. */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: `${SITE_NAME} · The creative studio that never sleeps`,
  description:
    "3,000 prompts, AI creative skills and autonomous agents built on ARTO's real methodology: strategy, creativity, narrative and production. 15+ years with Google, Nike and Uber, now self-serve.",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} · The creative studio that never sleeps`,
    description:
      "3,000 prompts, AI creative skills and autonomous agents. The same methodology ARTO uses with Google, Nike and Uber, now self-serve.",
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE_PATH), width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image" },
};

/* <html lang> follows the request locale. The root layout cannot read the
 * [locale] segment param, so src/proxy.ts resolves it from the path on every
 * request and forwards it as a request header. Routes outside the locale
 * tree (and any request that skipped the proxy) fall back to the default
 * locale. Reading headers() makes the few remaining static routes (/roast,
 * /studio, /upgrade, /welcome) render on demand; the [locale] tree already
 * rendered on demand because the marketing layout reads cookies(). */
async function requestLocale(): Promise<string> {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await requestLocale();
  return (
    <html lang={lang} className={`${archivo.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
