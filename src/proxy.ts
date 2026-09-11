import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALES, DEFAULT_LOCALE, type Locale, isLocale } from "@/i18n/config";
// Request header the root layout reads to set <html lang>. The root layout
// sits above [locale] so it cannot read the segment param; the proxy sees
// the path on every request and forwards the resolved locale here.
import { LOCALE_HEADER } from "@/lib/seo";

/* Next.js 16 renamed middleware → proxy. This file does two things on every
 * request:
 *
 *   1. Locale routing: every public marketing path must live under /<locale>/.
 *      If a request arrives without a known locale prefix and isn't on a
 *      locale-exempt path (/api, /auth, /admin, /studio, /upgrade, /welcome,
 *      /roast, /sitemap.xml, /robots.txt, /_next, /favicon.ico, asset files),
 *      we redirect to the visitor's preferred locale.
 *
 *      Preference order:
 *        a. NEXT_LOCALE cookie set by LangSwitcher
 *        b. Accept-Language header (first match in LOCALES)
 *        c. DEFAULT_LOCALE
 *
 *   2. Supabase session refresh: createServerClient with the cookie adapter
 *      keeps the auth cookies valid for Server Components.
 *
 * Order matters: locale redirect runs first because Supabase doesn't care
 * about pathname; redirecting cheaply avoids an auth call when we already
 * know we're sending the user elsewhere.
 */

// Paths that should NEVER get a locale prefix. Anything matching these
// stays at its original URL.
const LOCALE_EXEMPT_PREFIXES = [
  "/api/",
  "/auth/",
  "/admin",
  "/studio",
  "/upgrade",
  "/welcome",
  "/roast",
  "/_next/",
  "/favicon",
  "/brand/",
  "/sitemap.xml",
  "/robots.txt",
  "/opengraph-image",
  "/twitter-image",
];

function isLocaleExempt(pathname: string): boolean {
  return LOCALE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function pickLocaleFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  // "es-MX,es;q=0.9,en;q=0.8" → ["es-MX", "es", "en"]
  const ranges = header
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .filter(Boolean);
  for (const range of ranges) {
    const base = range.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

function localeRedirect(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;

  if (isLocaleExempt(pathname)) return null;

  // Already under a known locale? Let it through.
  const firstSeg = pathname.split("/").filter(Boolean)[0];
  if (firstSeg && isLocale(firstSeg)) return null;

  // Resolve target locale.
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const fromCookie = isLocale(cookieLocale) ? cookieLocale : null;
  const fromHeader = pickLocaleFromAcceptLanguage(request.headers.get("accept-language"));
  const target: Locale = fromCookie ?? fromHeader ?? DEFAULT_LOCALE;

  // Build the new URL: /<locale><pathname>
  const url = request.nextUrl.clone();
  url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;
  url.search = search;

  // Cache: don't have the CDN cache the redirect for everyone because the
  // target depends on visitor preferences. Vercel honors `Vary` on cookie/
  // header for the redirect response automatically when set via headers.
  const res = NextResponse.redirect(url, 307);
  res.headers.set("Vary", "Accept-Language, Cookie");
  return res;
}

/* Locale of the current request from its first path segment. Routes outside
 * the [locale] tree (/roast, /admin, ...) resolve to the default locale. */
function localeOfPath(pathname: string): Locale {
  const firstSeg = pathname.split("/").filter(Boolean)[0];
  return isLocale(firstSeg) ? firstSeg : DEFAULT_LOCALE;
}

/* NextResponse.next() forwarding the (possibly cookie-mutated) request
 * headers plus the resolved locale header. */
function nextWithLocale(request: NextRequest, locale: Locale): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(request: NextRequest) {
  // 1. Locale redirect (early exit if applicable).
  const localeJump = localeRedirect(request);
  if (localeJump) return localeJump;

  const locale = localeOfPath(request.nextUrl.pathname);

  // 2. Supabase session refresh.
  let response = nextWithLocale(request, locale);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = nextWithLocale(request, locale);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export { LOCALES };
