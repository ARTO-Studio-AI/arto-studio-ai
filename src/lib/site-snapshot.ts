import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import { lookup as dnsLookup } from "node:dns";
import type { LookupFunction } from "node:net";

/**
 * Lectura del sitio para el Brand Roast (2026-10-06).
 *
 * Antes el roast le pedia a Claude que usara web_fetch: varias vueltas del modelo
 * y en produccion pasaba de los 30 s de la funcion (504 con cualquier URL). Ahora
 * el servidor baja la pagina una sola vez, saca el texto y las senales que importan
 * para la marca, y se lo pasa al modelo en el mismo turno.
 *
 * Como el servidor pide una URL que escribe cualquiera, esto es una superficie de
 * SSRF. Las guardas:
 *   - solo http/https, puertos 80 y 443, sin usuario:clave en la URL;
 *   - la IP se valida en el momento de conectar (lookup propio del socket), asi
 *     que un DNS que cambia entre la validacion y la conexion no se cuela;
 *   - se rechazan loopback, redes privadas, link-local (metadatos de la nube),
 *     CGNAT, multicast y reservadas, en IPv4 e IPv6 (incluidas las mapeadas);
 *   - redirecciones a mano, maximo 3, y cada salto pasa por las mismas guardas;
 *   - tope de 1.5 MB descomprimidos y de 7 s en total.
 * Nunca lanza: si algo falla regresa { ok: false, reason } y el roast sigue sin sitio.
 */

export interface SiteSnapshot {
  ok: true;
  finalUrl: string;
  title: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  htmlLang: string;
  headings: string[];
  ctas: string[];
  socialLinks: string[];
  signals: string[];
  bodyText: string;
}

export type SnapshotResult = SiteSnapshot | { ok: false; reason: string };

const MAX_BYTES = 1_500_000;
const TOTAL_TIMEOUT_MS = 7_000;
const MAX_REDIRECTS = 3;
const BODY_TEXT_CHARS = 9_000;

/* ── Guardas de red ─────────────────────────────────────────── */

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inV4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** true si la IP no es publica y no se debe tocar. */
export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return BLOCKED_V4.some(([base, bits]) => inV4Range(ip, base, bits));
  if (family !== 6) return true;

  const lower = ip.toLowerCase().split("%")[0];
  // IPv4 mapeada o compatible (::ffff:a.b.c.d, ::a.b.c.d)
  const dotted = lower.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isBlockedIp(dotted[1]);
  // ::ffff:7f00:1 en hex
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isBlockedIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (lower === "::" || lower === "::1") return true;
  const first = parseInt(lower.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (lower.startsWith("64:ff9b:")) return true; // NAT64, puede apuntar a IPv4 interna
  if (lower.startsWith("2001:db8:") || lower.startsWith("2001:0db8:")) return true;
  if (lower.startsWith("2002:")) return true; // 6to4 embebe IPv4 arbitraria
  return false;
}

/** lookup que rechaza IPs internas en el momento de abrir el socket. */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as unknown as Array<{ address: string; family: number }>;
    if (!list.length || list.some((a) => isBlockedIp(a.address))) {
      return callback(new Error("blocked-address"), "", 0);
    }
    if ((options as { all?: boolean }).all) {
      return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    }
    return callback(null, list[0].address, list[0].family);
  });
};

/** Normaliza lo que escribe la persona ("marca.com", "www.marca.mx/") a una URL valida. */
export function normalizeUrl(raw: string): URL | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (net.isIP(host) && isBlockedIp(host)) return null;
  if (!net.isIP(host) && !host.includes(".")) return null;
  return u;
}

interface RawPage {
  finalUrl: string;
  html: string;
}

function requestOnce(url: URL, deadline: number): Promise<{ status: number; location?: string; body?: string }> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new Error("timeout"));
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        timeout: remaining,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ARTO-BrandRoast/2.0; +https://creative.artostudio.ai/roast)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location });
        }
        const type = String(res.headers["content-type"] ?? "");
        if (status >= 400 || (type && !/html|xml|text\/plain/i.test(type))) {
          res.resume();
          return resolve({ status: status >= 400 ? status : 415 });
        }
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (enc.includes("br")) stream = res.pipe(zlib.createBrotliDecompress());
        else if (enc.includes("gzip")) stream = res.pipe(zlib.createGunzip());
        else if (enc.includes("deflate")) stream = res.pipe(zlib.createInflate());

        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({ status, body: Buffer.concat(chunks).toString("utf-8") });
        };
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            // Con lo que ya llego basta para leer la marca.
            finish();
            req.destroy();
            return;
          }
          chunks.push(c);
        });
        stream.on("end", finish);
        stream.on("error", (e) => (done ? undefined : reject(e)));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function fetchPage(start: URL): Promise<RawPage> {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const r = await requestOnce(url, deadline);
    if (r.location) {
      const next = normalizeUrl(new URL(r.location, url).toString());
      if (!next) throw new Error("blocked-redirect");
      url = next;
      continue;
    }
    if (r.body === undefined) throw new Error(`http-${r.status}`);
    return { finalUrl: url.toString(), html: r.body };
  }
  throw new Error("too-many-redirects");
}

/* ── Extraccion ─────────────────────────────────────────────── */

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
  "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú", "&ntilde;": "ñ",
  "&Aacute;": "Á", "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú", "&Ntilde;": "Ñ",
  "&uuml;": "ü", "&iexcl;": "¡", "&iquest;": "¿", "&mdash;": "-", "&ndash;": "-", "&hellip;": "...",
};

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Math.min(Number(d), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&[a-z]+;/gi, (e) => ENTITIES[e] ?? " ");
}

function clean(s: string, max = 300): string {
  return decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, max);
}

function meta(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${key}["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return m ? clean(m[1] ?? m[2] ?? "") : "";
}

function uniq(list: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const k = item.toLowerCase();
    if (!item || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

export function extractSnapshot(html: string, finalUrl: string): SiteSnapshot {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ");

  const title = clean(stripped.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "", 200);
  const htmlLang = (html.match(/<html[^>]*\slang=["']?([a-zA-Z-]+)/i)?.[1] ?? "").slice(0, 12);

  const headings = uniq(
    [...stripped.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => `H${m[1]}: ${clean(m[2], 160)}`).filter((h) => h.length > 4),
    25
  );

  const ctas = uniq(
    [
      ...[...stripped.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map((m) => clean(m[1], 60)),
      ...[...stripped.matchAll(/<a[^>]+class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => clean(m[1], 60)),
    ].filter((t) => t.length > 1 && t.length < 60),
    12
  );

  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const socialLinks = uniq(
    hrefs
      .filter((h) => /(instagram|facebook|linkedin|tiktok|youtube|twitter|x)\.com\//i.test(h) && !/share|intent|sharer/i.test(h))
      .map((h) => h.split("?")[0].slice(0, 120)),
    8
  );

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imgsNoAlt = imgTags.filter((t) => !/\salt=["'][^"']+["']/i.test(t)).length;
  const signals: string[] = [];
  signals.push(/<meta[^>]+name=["']viewport["']/i.test(html) ? "Has mobile viewport meta tag" : "NO mobile viewport meta tag");
  signals.push(finalUrl.startsWith("https://") ? "Served over HTTPS" : "NOT served over HTTPS");
  signals.push(`${imgTags.length} <img> tags, ${imgsNoAlt} without alt text`);
  if (/<link[^>]+rel=["']canonical["']/i.test(html)) signals.push("Has canonical URL");
  if (/application\/ld\+json/i.test(html)) signals.push("Has structured data (JSON-LD)");
  if (/hreflang=/i.test(html)) signals.push("Has hreflang alternates (multi-language)");
  if (/wa\.me\/|api\.whatsapp\.com/i.test(html)) signals.push("Has a WhatsApp contact link");
  if (/<form\b/i.test(html)) signals.push("Has at least one form");
  const generator = meta(html, "generator");
  if (generator) signals.push(`Built with: ${generator.slice(0, 60)}`);

  const bodyHtml = stripped.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? stripped;
  const bodyText = clean(bodyHtml.replace(/<\/(p|div|li|h\d|section|br)>/gi, " · "), BODY_TEXT_CHARS);

  return {
    ok: true,
    finalUrl,
    title,
    metaDescription: meta(html, "description"),
    ogTitle: meta(html, "og:title"),
    ogDescription: meta(html, "og:description"),
    htmlLang,
    headings,
    ctas,
    socialLinks,
    signals,
    bodyText,
  };
}

export async function fetchSiteSnapshot(rawUrl: string): Promise<SnapshotResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) return { ok: false, reason: "invalid-or-blocked-url" };
  try {
    const page = await fetchPage(url);
    const snap = extractSnapshot(page.html, page.finalUrl);
    // Paginas que se arman 100% en el cliente regresan casi vacias.
    if (!snap.title && snap.bodyText.length < 80 && snap.headings.length === 0) {
      return { ok: false, reason: "empty-page" };
    }
    return snap;
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message.slice(0, 60) : "fetch-error" };
  }
}

/** Bloque de texto que va al modelo. El contenido es de un tercero: se marca como datos. */
export function renderSnapshot(s: SnapshotResult, requestedUrl: string): string {
  if (!s.ok) {
    return `<website_snapshot url="${requestedUrl.replace(/[<>"]/g, "")}" status="unavailable" reason="${s.reason}">\nThe website could not be read. Evaluate from the other inputs and say plainly in the digital roast that the site could not be loaded (a site that fails to load for a basic crawler is itself a digital weakness only if the reason is a timeout or an error, not if the URL was invalid).\n</website_snapshot>`;
  }
  const esc = (t: string) => t.replace(/</g, "&lt;");
  const lines = [
    `Final URL: ${s.finalUrl}`,
    `Page title: ${s.title || "(none)"}`,
    `Meta description: ${s.metaDescription || "(none)"}`,
    `OG title: ${s.ogTitle || "(none)"}`,
    `OG description: ${s.ogDescription || "(none)"}`,
    `HTML lang: ${s.htmlLang || "(none)"}`,
    `Headings:\n${s.headings.join("\n") || "(none)"}`,
    `Buttons / CTAs: ${s.ctas.join(" | ") || "(none found)"}`,
    `Social profiles linked: ${s.socialLinks.join(" | ") || "(none found)"}`,
    `Technical signals: ${s.signals.join("; ")}`,
    `Visible text (truncated):\n${s.bodyText}`,
  ];
  return `<website_snapshot status="ok">\n${esc(lines.join("\n"))}\n</website_snapshot>`;
}
