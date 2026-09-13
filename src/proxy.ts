import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALES, DEFAULT_LOCALE, type Locale, isLocale } from "@/i18n/config";
// Request header the root layout reads to set <html lang>. The root layout
// sits above [locale] so it cannot read the segment param; the proxy sees
// the path on every request and forwards the resolved locale here.
import { LOCALE_HEADER } from "@/lib/seo";
import { UTM_COOKIE, UTM_COOKIE_MAX_AGE, buildFirstTouch, serializeFirstTouch } from "@/lib/attribution";

/* Next.js 16 renamed middleware → proxy. This file does four things on every
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
 *   2. Visitor id: anonymous visitors get an `asai_vid` cookie (uuid v4,
 *      httpOnly, SameSite=Lax, 1 year). It is the subject of the free daily
 *      prompt counter (src/lib/prompt-limit.ts) until they sign in; on sign-in
 *      the day's opens are adopted by the user (src/app/auth/callback).
 *
 *   3. Supabase session refresh: createServerClient with the cookie adapter
 *      keeps the auth cookies valid for Server Components.
 *
 *   4. First-touch attribution: the first request of a browser without the
 *      `asai_utm` cookie stores its utm_* params, external referrer and landing
 *      path for 30 days (src/lib/attribution.ts). It is set on the locale
 *      redirect too, so `/?utm_source=x` → `/en?utm_source=x` records the
 *      first hop and the second one finds the cookie already there.
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
  "/_vercel/", // scripts de Vercel Analytics y Speed Insights (Fase 1C)
  "/favicon",
  "/brand/",
  "/sitemap.xml",
  "/robots.txt",
  "/opengraph-image",
  "/twitter-image",
];

export const VISITOR_COOKIE = "asai_vid";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

function isLocaleExempt(pathname: string): boolean {
  return LOCALE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

/* Rutas que no son "una visita": llamadas de API, callbacks de auth, assets de
 * Next. Ahi no tiene sentido abrir la atribucion de primer toque. */
const ATTRIBUTION_SKIP_PREFIXES = ["/api/", "/auth/", "/_next/", "/_vercel/", "/favicon", "/brand/", "/opengraph-image", "/twitter-image"];

function isAttributionSkipped(pathname: string): boolean {
  return (
    ATTRIBUTION_SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p)) ||
    /\.(?:xml|txt|ico|svg|png|jpg|jpeg|gif|webp|js|css|map)$/i.test(pathname)
  );
}

/* Guarda la primera visita (utm_*, referrer externo, landing) en asai_utm si el
 * navegador aun no la trae. Primera atribucion: una vez puesta no se toca. */
function attachFirstTouch(request: NextRequest, response: NextResponse): void {
  if (request.cookies.get(UTM_COOKIE)?.value) return;
  const pathname = request.nextUrl.pathname;
  if (isAttributionSkipped(pathname)) return;
  const firstTouch = buildFirstTouch({
    params: request.nextUrl.searchParams,
    referer: request.headers.get("referer"),
    host: request.headers.get("host") ?? request.nextUrl.host,
    pathname,
  });
  response.cookies.set(UTM_COOKIE, serializeFirstTouch(firstTouch), {
    httpOnly: false, // LoginForm la lee desde document.cookie
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UTM_COOKIE_MAX_AGE,
  });
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
  attachFirstTouch(request, res);
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

  // 2. Visitor id. Set on the request too so the Server Components of this
  //    same request already see it (same trick Supabase uses for its cookies).
  let newVisitorId: string | null = null;
  if (!request.cookies.get(VISITOR_COOKIE)?.value) {
    newVisitorId = crypto.randomUUID();
    request.cookies.set(VISITOR_COOKIE, newVisitorId);
  }

  const locale = localeOfPath(request.nextUrl.pathname);

  // 3. Supabase session refresh.
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

  if (newVisitorId) {
    response.cookies.set(VISITOR_COOKIE, newVisitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE,
    });
  }

  // 4. Atribucion de primera visita.
  attachFirstTouch(request, response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_vercel/|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export { LOCALES };
