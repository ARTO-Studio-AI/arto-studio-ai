import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse, after } from "next/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { captureServer } from "@/lib/analytics-server";
import { CONSENT_COOKIE, analyticsAllowed } from "@/lib/consent";
import { accessFor } from "@/lib/catalogo/access";
import { getCatalog } from "@/lib/catalogo/efectivo";
import { getViewer } from "@/lib/edit-bundle/viewer";

/* GET /api/mod-downloads/[slug] · descarga de los mods de /mods (18 nov 2026, D37: MOD01 entra
 * en el plan Pro). Calcada de /api/skill-downloads/[slug], que no cambia.
 *
 *  1. El slug se busca en el catalogo efectivo (getModDownload): solo mods del repo, en
 *     published y con paquete declarado en mods.json. Lo demas es 404. El nombre del archivo
 *     sale del manifiesto, nunca de la peticion (sin path traversal).
 *  2. Regla "pro" de src/lib/catalogo/access.ts:
 *       - sin sesion -> 302 a /<locale>/login?next=<pagina del mod>
 *       - free       -> 302 a /<locale>/pricing?from=<slug>
 *       - Pro o Enterprise -> el archivo
 *  3. El zip se lee de private/mods (fuera de public/, incluido en la funcion con
 *     outputFileTracingIncludes) y se compara su SHA-256 con el de mods.json antes de
 *     entregarlo: si no coincide, 503 y error en los logs. Asi solo sale la copia auditada.
 *  4. Cada descarga queda en los logs de Vercel y, con consentimiento de analitica (D10), en
 *     PostHog como mod_downloaded.
 *
 * Los mods subidos desde /admin/skills no se descargan por aqui todavia: la regla de D37 es
 * solo para MOD01 y la de los demas la decide Victor.
 *
 * Todo sale con Cache-Control: private, no-store. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };
const MAX_BYTES = Math.floor(4.4 * 1024 * 1024);
const PRIVATE_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "private", "mods");

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
  const item = (await getCatalog()).getModDownload(slug);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });

  const locale = requestLocale(request);
  const viewer = await getViewer();
  const access = accessFor(item.access, viewer);

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
    console.error(`[mod-downloads] ${item.file} pesa ${body.byteLength} bytes, mas de lo que entrega una funcion`);
    return NextResponse.json({ error: "too_large" }, { status: 503, headers: NO_STORE });
  }
  const sha256 = createHash("sha256").update(body).digest("hex");
  if (sha256 !== item.sha256 || body.byteLength !== item.bytes) {
    console.error(`[mod-downloads] ${item.file} no coincide con mods.json (sha256 ${sha256}, ${body.byteLength} bytes)`);
    return NextResponse.json({ error: "integrity" }, { status: 503, headers: NO_STORE });
  }

  const record = { event: "mod_download", slug: item.slug, user_id: viewer.userId, tier: viewer.tier, at: new Date().toISOString() };
  const consent = request.cookies.get(CONSENT_COOKIE)?.value;
  after(async () => {
    console.log(JSON.stringify(record));
    if (analyticsAllowed(consent)) {
      await captureServer(viewer.userId, "mod_downloaded", { mod: item.slug, tier: viewer.tier, locale });
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
