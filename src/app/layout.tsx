import type { Metadata } from "next";
import { headers } from "next/headers";
import { Cormorant_Garamond, Geist, Inter_Tight, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { DEFAULT_OG_IMAGE_PATH, LOCALE_HEADER, SITE_NAME, absoluteUrl, siteUrl } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import PostHogProvider from "@/components/analytics/PostHogProvider";
import "./globals.css";

/* Tipografia (propuesta aprobada por Victor el 2026-10-07, design system de ARTO con la
 * linea visual del sitio publico). Cuatro voces con trabajos distintos, para que haya
 * jerarquia:
 *   Manrope 800      titulares grandes y scores        --font-brand-display
 *   Cormorant        palabra clave, citas, roast       --font-brand-serif (en lugar de
 *                    Garamond                          Romana, que aun no esta en el DS)
 *   Geist            menu, etiquetas, IDs, eyebrows    --font-brand-meta (font-mono)
 *   Inter Tight      texto corrido                     --font-brand-text (font-sans)
 * Sin mono: Victor pidio quitar JetBrains Mono. Se cargan en el root para que /admin y
 * /studio compartan variables. */
const manrope = Manrope({
  variable: "--font-brand-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-brand-text",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-brand-meta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-brand-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
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

/* Id de Supabase del usuario con sesion (o null) para identify() de PostHog.
 * Solo el id: el email nunca sale hacia PostHog. Si faltan las env de Supabase
 * (build de CI) se renderiza como anonimo. */
async function currentUserId(): Promise<string | null> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [lang, userId] = await Promise.all([requestLocale(), currentUserId()]);
  return (
    <html
      lang={lang}
      className={`${manrope.variable} ${interTight.variable} ${geist.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PostHogProvider userId={userId}>{children}</PostHogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
