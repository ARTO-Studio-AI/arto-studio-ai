import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse, after } from "next/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { captureServer } from "@/lib/analytics-server";
import { CONSENT_COOKIE, analyticsAllowed } from "@/lib/consent";
import { downloadAccess, isPromoActive } from "@/lib/edit-bundle/access";
import { getDownloadItem } from "@/lib/edit-bundle/catalog";
import { getViewer } from "@/lib/edit-bundle/viewer";

/* GET /api/skill-downloads/[slug] · descarga de los skills del ARTO Edit Bundle #1 (Victor, 27 oct 2026).
 *
 *  1. El slug se busca en el catalogo. Lo que no esta ahi es 404; el nombre del archivo
 *     sale del catalogo, nunca de la peticion (sin path traversal).
 *  2. Sesion de Supabase + profiles.tier (getViewer) y la regla de fecha de access.ts:
 *       - sin sesion   -> 302 a /<locale>/login?next=<pagina del skill>
 *       - free tras el corte -> 302 a /<locale>/pricing
 *       - free en promocion o Pro -> el archivo
 *  3. El archivo se lee de private/skills (fuera de public/, incluido en la funcion con
 *     outputFileTracingIncludes en next.config.ts). Si todavia no se sincroniza, 404.
 *  4. Cada descarga queda registrada (quien, que, cuando): una linea JSON en los logs de
 *     Vercel siempre, y skill_downloaded en PostHog solo con consentimiento de analitica
 *     (D10). No hay tabla de eventos que lo acepte sin DDL: attribution_events tiene un
 *     CHECK con tipos cerrados.
 *
 * Todo sale con Cache-Control: private, no-store para que ninguna CDN guarde un archivo
 * de pago ni una redireccion que depende de la sesion. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

/* Vercel no responde mas de 4.5 MB desde una funcion; scripts/edit-bundle-manifest.mjs ya rechaza
 * paquetes de mas de 4.4 MB, y aqui se repite por si alguien copio uno sin correrlo. */
const MAX_BYTES = Math.floor(4.4 * 1024 * 1024);

const PRIVATE_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "private", "skills");

function requestLocale(request: NextRequest): Locale {
  const q = request.nextUrl.searchParams.get("locale");
  if (isLocale(q)) return q;
  const c = request.cookies.get("NEXT_LOCALE")?.value;
  return isLocale(c) ? c : DEFAULT_LOCALE;
}

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const res = NextResponse.redirect(new URL(pathname, request.url), 302);
  for (const [k, v] of Object.entries(NO_STORE)) res.headers.set(k, v);
  return res;
}

function asciiName(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = getDownloadItem(slug);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });

  const locale = requestLocale(request);
  const viewer = await getViewer();
  const now = new Date();
  const access = downloadAccess(viewer, now);

  if (access === "signin" || !viewer.signedIn) {
    const back = `/${locale}${item.pagePath}`;
    return redirectTo(request, `/${locale}/login?next=${encodeURIComponent(back)}`);
  }
  if (access === "upgrade") {
    return redirectTo(request, `/${locale}/pricing?from=${encodeURIComponent(item.slug)}`);
  }

  let body: Buffer;
  try {
    body = await readFile(path.join(PRIVATE_DIR, item.file));
  } catch {
    return NextResponse.json({ error: "not_available" }, { status: 404, headers: NO_STORE });
  }
  if (body.byteLength > MAX_BYTES) {
    console.error(`[skill-downloads] ${item.file} pesa ${body.byteLength} bytes, mas de lo que entrega una funcion`);
    return NextResponse.json({ error: "too_large" }, { status: 503, headers: NO_STORE });
  }

  const promo = isPromoActive(now);
  const record = {
    event: "skill_download",
    slug: item.slug,
    user_id: viewer.userId,
    tier: viewer.tier,
    promo,
    at: now.toISOString(),
  };
  const consent = request.cookies.get(CONSENT_COOKIE)?.value;
  after(async () => {
    console.log(JSON.stringify(record));
    if (analyticsAllowed(consent)) {
      await captureServer(viewer.userId, "skill_downloaded", { skill: item.slug, tier: viewer.tier, promo, locale });
    }
  });

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/zip",
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${asciiName(item.downloadName)}"; filename*=UTF-8''${encodeURIComponent(item.downloadName)}`,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
