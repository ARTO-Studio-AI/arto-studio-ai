/* Atribucion de primera visita (Fase 1C, 13 sep 2026).
 *
 * src/proxy.ts guarda en la cookie `asai_utm` (30 dias) los UTM y el referrer de
 * la PRIMERA visita del navegador. Es atribucion de primer toque: si la cookie ya
 * existe no se toca, aunque la visita nueva traiga otra campana. Se lee en tres
 * sitios:
 *   - LoginForm (cliente) la manda en options.data de signInWithOtp y el trigger
 *     handle_new_user la copia a profiles.
 *   - /auth/callback (servidor) completa profiles con ella cuando el signup no
 *     paso por el magic link (Google) y escribe la fila de attribution_events.
 *   - Nada mas. No se manda a PostHog el referrer completo, solo utm_*.
 *
 * La cookie no es httpOnly a proposito: LoginForm la lee desde document.cookie.
 * No lleva datos personales: solo parametros de URL y el referrer sin query.
 *
 * Este modulo no importa nada de Next para que se pueda probar con vitest en node. */

export const UTM_COOKIE = "asai_utm";
export const UTM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

/* Cookie corta que LoginForm deja antes de mandar al usuario a Google, porque
 * signInWithOAuth no admite options.data. /auth/callback la lee y la borra. */
export const SIGNUP_COOKIE = "asai_signup";
export const SIGNUP_COOKIE_MAX_AGE = 60 * 15; // 15 minutos

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmFields = Partial<Record<UtmKey, string>>;

export interface FirstTouch extends UtmFields {
  /** Origen + path del referrer externo, sin query. Ausente si es visita directa o interna. */
  referrer?: string;
  /** Path de la primera pagina vista, sin query. */
  landing_path?: string;
  /** ISO de la primera visita. */
  ts: string;
}

export interface SignupExtra {
  company?: string;
  role?: string;
  locale?: string;
}

const MAX_LEN = 200;

/** Recorta, quita caracteres de control y devuelve undefined si queda vacio. */
export function cleanValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_LEN);
  return cleaned.length > 0 ? cleaned : undefined;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function paramOf(params: ParamSource, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Solo los utm_* presentes y no vacios, limpios. */
export function readUtm(params: ParamSource): UtmFields {
  const out: UtmFields = {};
  for (const key of UTM_KEYS) {
    const value = cleanValue(paramOf(params, key));
    if (value) out[key] = value;
  }
  return out;
}

/**
 * Referrer externo como origen + path (sin query, que puede traer tokens).
 * Devuelve undefined si no hay referrer, si no es http(s) o si es del mismo host.
 */
export function externalReferrer(referer: string | null | undefined, host: string | null | undefined): string | undefined {
  if (!referer) return undefined;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return undefined;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  if (host && url.host.toLowerCase() === host.toLowerCase()) return undefined;
  return cleanValue(`${url.origin}${url.pathname}`);
}

export interface FirstTouchInput {
  params: ParamSource;
  referer?: string | null;
  host?: string | null;
  pathname?: string | null;
  now?: Date;
}

/** Construye el valor de la cookie para una primera visita. Siempre devuelve algo (aunque sea directa). */
export function buildFirstTouch({ params, referer, host, pathname, now }: FirstTouchInput): FirstTouch {
  const ft: FirstTouch = { ...readUtm(params), ts: (now ?? new Date()).toISOString() };
  const ref = externalReferrer(referer, host);
  if (ref) ft.referrer = ref;
  const landing = cleanValue(pathname ?? undefined);
  if (landing) ft.landing_path = landing;
  return ft;
}

export function serializeFirstTouch(ft: FirstTouch): string {
  return JSON.stringify(ft);
}

function parseJsonCookie(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  const candidates = [raw];
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) candidates.unshift(decoded);
  } catch {
    /* no estaba codificado */
  }
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* probar la siguiente forma */
    }
  }
  return null;
}

/** Lee la cookie asai_utm (cruda o url-encoded). null si no existe o esta rota. */
export function parseFirstTouch(raw: string | null | undefined): FirstTouch | null {
  const obj = parseJsonCookie(raw);
  if (!obj) return null;
  const ts = cleanValue(obj.ts);
  if (!ts) return null;
  const ft: FirstTouch = { ts };
  for (const key of UTM_KEYS) {
    const value = cleanValue(obj[key]);
    if (value) ft[key] = value;
  }
  const referrer = cleanValue(obj.referrer);
  if (referrer) ft.referrer = referrer;
  const landing = cleanValue(obj.landing_path);
  if (landing) ft.landing_path = landing;
  return ft;
}

/** Lee la cookie asai_signup. null si no existe o esta rota. */
export function parseSignupExtra(raw: string | null | undefined): SignupExtra | null {
  const obj = parseJsonCookie(raw);
  if (!obj) return null;
  const extra: SignupExtra = {};
  const company = cleanValue(obj.company);
  if (company) extra.company = company;
  const role = cleanValue(obj.role);
  if (role) extra.role = role;
  const locale = cleanValue(obj.locale);
  if (locale) extra.locale = locale;
  return extra;
}

/** Host del referrer guardado, para usarlo como origen legible. */
export function referrerHost(referrer: string | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Origen del registro en una sola palabra: utm_source si hubo campana, si no el
 * host del referrer, si no "direct". Es lo que va a profiles.signup_source.
 */
export function signupSourceOf(ft: FirstTouch | null | undefined): string {
  return ft?.utm_source ?? referrerHost(ft?.referrer) ?? "direct";
}

/**
 * Datos que van en options.data de signInWithOtp (y de ahi a raw_user_meta_data,
 * que handle_new_user copia a profiles). Solo claves con valor.
 */
export function signupMetadata(
  ft: FirstTouch | null | undefined,
  extra: SignupExtra,
): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (key: string, value: string | undefined) => {
    const cleaned = cleanValue(value);
    if (cleaned) out[key] = cleaned;
  };
  put("company", extra.company);
  put("role", extra.role);
  put("signup_locale", extra.locale);
  put("signup_source", signupSourceOf(ft));
  for (const key of UTM_KEYS) put(key, ft?.[key]);
  put("referrer", ft?.referrer);
  return out;
}

/** Valor de una cookie desde document.cookie (cliente). undefined fuera del navegador. */
export function readBrowserCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return undefined;
}

/** Escribe una cookie JSON no httpOnly desde el cliente. */
export function writeBrowserCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax${secure}`;
}
