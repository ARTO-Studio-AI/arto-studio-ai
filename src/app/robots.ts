import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

const SITE_URL = siteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/admin/",
          "/account",
          "/studio",
          "/welcome",
          "/upgrade",
          "/favorites",
          "/collections",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
