import type { NextConfig } from "next";

/* Allow next/image to source from Supabase Storage. Without this the
 * homepage "From the journal" cards (which render blog_post.image_url
 * from the content-images bucket) crash the build with the
 * "hostname not configured" error. The public Storage CDN sits at
 *   https://<project-ref>.supabase.co/storage/v1/object/public/...
 * so we whitelist *.supabase.co. */
const SUPABASE_HOSTNAME = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
).hostname;

/* Canonical domain (decision D6, 10 sep 2026). Every legacy host 301s here
 * keeping path and query. Vercel preview deployments have hosts like
 * arto-studio-ai-git-<branch>-<team>.vercel.app which do not match the exact
 * regexes below, so previews keep working without a redirect. */
const CANONICAL_HOST = "creative.artostudio.ai";
const LEGACY_HOSTS = ["arto-studio-ai.vercel.app", "library.artostudio.ai"];

const nextConfig: NextConfig = {
  async redirects() {
    return LEGACY_HOSTS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host.replace(/\./g, "\\.") }],
      destination: `https://${CANONICAL_HOST}/:path*`,
      statusCode: 301,
    }));
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: SUPABASE_HOSTNAME,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
