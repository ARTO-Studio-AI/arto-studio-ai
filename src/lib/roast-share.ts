import { createHmac, timingSafeEqual } from "node:crypto";

/* Firma de los enlaces compartidos del Brand Roast (2026-10-07). El enlace lleva marca,
 * calificaciones y la frase del roast; sin firma, cualquiera podria fabricar un enlace
 * con una frase ofensiva bajo la marca de ARTO (hallazgo H-60). El servidor firma al
 * generar el roast y verifica al pintar la pagina y la imagen; si la firma no cuadra,
 * se muestran solo las calificaciones. Clave: ROAST_SHARE_SECRET o, si no existe,
 * ARTO_API_KEY_SALT con separacion de dominio. */

export interface SharePayload {
  brand: string;
  score: string;
  s: string;
  c: string;
  n: string;
  d: string;
  h: string;
  lang: string;
}

function key(): string | null {
  const k = process.env.ROAST_SHARE_SECRET || process.env.ARTO_API_KEY_SALT;
  return k ? `roast-share-v1:${k}` : null;
}

function canonical(p: SharePayload): string {
  // JSON en vez de unir con "|": no hay forma de insertar separadores sin romper la firma
  // (auditoria de Fable, 309269d).
  return JSON.stringify([p.brand, p.score, p.s, p.c, p.n, p.d, p.h, p.lang]);
}

/* Solo "0" a "10" con un decimal opcional ("4.6", "7"). Cualquier otra forma (5000
 * digitos, "0x9", "1e1") se rechaza antes de pintar titulo o imagen. */
const SCORE_RE = /^(10(\.0)?|\d(\.\d)?)$/;

export function signShare(p: SharePayload): string | null {
  const k = key();
  if (!k) return null;
  return createHmac("sha256", k).update(canonical(p)).digest("base64url").slice(0, 22);
}

export function verifyShare(p: SharePayload, sig: string | null | undefined): boolean {
  if (!sig) return false;
  const expected = signShare(p);
  if (!expected || expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

/** Lee y valida los parametros de un enlace compartido. Devuelve null si no son validos. */
export function readShareParams(
  get: (k: string) => string | null | undefined,
  fallbackLang: "es" | "en" = "es",
): (SharePayload & { verified: boolean }) | null {
  const brand = (get("brand") ?? "").slice(0, 100);
  const vals = ["score", "s", "c", "n", "d"].map((k) => get(k) ?? "");
  if (!brand || vals.some((v) => !SCORE_RE.test(v))) return null;
  const [score, s, c, n, d] = vals;
  const h = (get("h") ?? "").slice(0, 160);
  // Sin lang (enlaces viejos /roast?lang=en que el proxy redirige quitando el parametro)
  // se usa el idioma de la ruta.
  const langRaw = get("lang");
  const lang = langRaw === "en" || langRaw === "es" ? langRaw : fallbackLang;
  const payload = { brand, score, s, c, n, d, h, lang };
  const verified = h ? verifyShare(payload, get("sig")) : false;
  return { ...payload, h: verified ? h : "", verified };
}

/* Token del reporte por correo (2026-10-07, auditoria de Fable del PR #76). El id de la
 * traza es un entero adivinable; el token lo firma para que solo quien hizo el roast
 * pueda pedir que se lo manden por correo. Formato "<id>.<firma>". */
function reportKey(): string | null {
  const k = process.env.ROAST_SHARE_SECRET || process.env.ARTO_API_KEY_SALT;
  return k ? `roast-report-v1:${k}` : null;
}

export function signReportToken(traceId: number): string | null {
  const k = reportKey();
  if (!k || !Number.isInteger(traceId) || traceId <= 0) return null;
  return `${traceId}.${createHmac("sha256", k).update(String(traceId)).digest("base64url").slice(0, 22)}`;
}

export function verifyReportToken(token: unknown): number | null {
  if (typeof token !== "string" || !/^\d{1,12}\.[A-Za-z0-9_-]{22}$/.test(token)) return null;
  const id = Number(token.split(".")[0]);
  const expected = signReportToken(id);
  if (!expected || expected.length !== token.length) return null;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token)) ? id : null;
}
