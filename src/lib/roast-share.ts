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
  return [p.brand, p.score, p.s, p.c, p.n, p.d, p.h, p.lang].map((v) => v.replace(/\|/g, "")).join("|");
}

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
export function readShareParams(get: (k: string) => string | null | undefined): (SharePayload & { verified: boolean }) | null {
  const brand = (get("brand") ?? "").slice(0, 100);
  const vals = ["score", "s", "c", "n", "d"].map((k) => get(k) ?? "");
  if (!brand || vals.some((v) => v === "" || isNaN(Number(v)) || Number(v) < 0 || Number(v) > 10)) return null;
  const [score, s, c, n, d] = vals;
  const h = (get("h") ?? "").slice(0, 160);
  const langRaw = get("lang");
  const lang = langRaw === "en" ? "en" : "es";
  const payload = { brand, score, s, c, n, d, h, lang };
  const verified = h ? verifyShare(payload, get("sig")) : false;
  return { ...payload, h: verified ? h : "", verified };
}
