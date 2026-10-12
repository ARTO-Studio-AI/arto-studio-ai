import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { LOCALES } from "@/i18n/config";

const SITE_URL = siteUrl();
const PRIVATE = ["/account", "/studio", "/welcome", "/favorites", "/collections"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Las privadas tambien con prefijo de idioma (/es/account, /en/favorites...).
        disallow: [
          "/api/",
          "/auth/",
          "/admin/",
          "/upgrade",
          ...PRIVATE.flatMap((p) => [p, ...LOCALES.map((l) => `/${l}${p}`)]),
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
