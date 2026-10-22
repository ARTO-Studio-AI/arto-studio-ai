import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server";
import { CONSENT_COOKIE, adsAllowed, readCookie } from "@/lib/consent";
import { metaPixelId, metaSafeUrl } from "@/lib/meta-pixel";
import { SITE_URL } from "@/lib/site-url";

/* API de conversiones de Meta (22 oct 2026, fase 2 de D19, pedido por Victor).
 *
 * Manda desde el servidor los mismos eventos que el pixel, al mismo conjunto de datos
 * («ARTO Studio AI», NEXT_PUBLIC_META_PIXEL_ID):
 *   - CompleteRegistration: alta de cuenta en /auth/callback. Solo existe aqui.
 *   - Lead: correo dejado en el roast (/api/roast/email).
 *   - RoastCompleted: roast real terminado (/api/roast).
 * Lead y RoastCompleted tambien salen del navegador con el mismo event_id; Meta junta los
 * dos y cuenta uno. Si el navegador lo bloquea, cuenta el del servidor.
 *
 * Reglas (Victor, 22 oct 2026: «1 ambos, 2 si, 3 si»):
 *   - Solo con la publicidad aceptada: cookie asai_consent = "all" en la version vigente.
 *     Una llamada sin esa cookie (otra app que use la API publica del roast) no manda nada.
 *   - Tampoco con DNT: 1 o Sec-GPC: 1 en la peticion, igual que el pixel con doNotTrack.
 *   - Sin META_CAPI_ACCESS_TOKEN o sin el ID del pixel todo es no-op.
 *   - Va el correo con SHA-256 (minusculas y sin espacios, como pide Meta), nunca en claro,
 *     mas el id de Supabase con SHA-256, IP, navegador y las cookies _fbp y _fbc.
 *     Nunca el nombre de la marca ni texto libre.
 *   - La URL del evento es la pagina de origen solo si es de este sitio y no trae
 *     parametros que no sean utm_*; si no, la raiz del sitio.
 *   - Nunca lanza y no espera mas de 3 s: la publicidad no puede tumbar el login ni el roast.
 *     Las rutas usan queueMetaServerEvent, que corre despues de responder.
 *   - META_CAPI_TEST_EVENT_CODE (solo vista previa) manda todo a «Probar eventos». */

// v26.0 (jul 2026) es la ultima; cada version vive unos dos anos. Al caer, Meta responde
// error y aqui solo queda un console.error: revisar en cada auditoria (Fable, 22 oct 2026).
const GRAPH_VERSION = "v26.0";
const TIMEOUT_MS = 3000;
const EVENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/* Valores del <select> de industria del roast (INDUSTRIES en RoastClient.tsx). La API del
 * roast acepta cualquier texto, asi que a Meta solo va la industria si es una de estas:
 * nunca texto libre. Si la lista del roast cambia, cambiar tambien aqui. */
const ROAST_INDUSTRIES = new Set([
  "SaaS / B2B Software", "Consumer Tech", "Fintech", "Healthtech", "Edtech", "Proptech", "AI / Data",
  "E-commerce", "Fashion & Beauty", "Food & Beverage", "Restaurants", "CPG", "Luxury", "Agency",
  "Professional Services", "Legal", "Finance", "Real Estate", "Education", "Health & Wellness",
  "Travel & Hospitality", "Manufacturing", "Automotive", "Energy", "Construction", "Logistics",
  "Entertainment", "Sports & Fitness", "Arts & Culture", "NGO / Social Impact", "Politics & Public Sector", "Other",
]);

/** Industria del roast si es de la lista; si no, undefined (no se manda). */
export function metaIndustry(raw: unknown): string | undefined {
  return typeof raw === "string" && ROAST_INDUSTRIES.has(raw) ? raw : undefined;
}

export type MetaServerEventName = "CompleteRegistration" | "Lead" | "RoastCompleted";

type HeaderSource = { get(name: string): string | null };
export type MetaRequestLike = {
  headers: HeaderSource;
  cookies: { get(name: string): { value: string } | undefined };
};

export type MetaServerEvent = {
  name: MetaServerEventName;
  request: MetaRequestLike;
  /** event_id compartido con el pixel. Si falta o no es valido se genera uno (sin dedupe). */
  eventId?: string | null;
  email?: string | null;
  /** id de Supabase; va con SHA-256. */
  externalId?: string | null;
  customData?: Record<string, string | number | undefined>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Correo normalizado como pide Meta y con SHA-256. null si no parece correo. */
export function hashEmail(email: string | null | undefined): string | null {
  const clean = email?.trim().toLowerCase();
  return clean && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? sha256(clean) : null;
}

/** event_id valido o null. Lo genera el navegador; aqui solo se valida. */
export function cleanEventId(raw: unknown): string | null {
  return typeof raw === "string" && EVENT_ID_RE.test(raw) ? raw : null;
}

function clientIp(headers: HeaderSource): string | null {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  return ip || null;
}

/** Pagina de origen si es de este sitio y segura para Meta; si no, la raiz del sitio. */
export function eventSourceUrl(headers: HeaderSource): string {
  const referer = headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.origin === new URL(SITE_URL).origin && metaSafeUrl(referer)) return url.toString();
    } catch {
      /* referer invalido */
    }
  }
  return `${SITE_URL}/`;
}

/** true si la peticion permite mandar a Meta: publicidad aceptada y sin DNT/GPC. */
export function serverAdsAllowed(request: MetaRequestLike): boolean {
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return false;
  return adsAllowed(request.cookies.get(CONSENT_COOKIE)?.value);
}

/** Cuerpo del evento para la API de Meta. Exportado para las pruebas. */
export function buildMetaServerPayload(event: MetaServerEvent, now = Date.now()): Record<string, unknown> {
  const { headers } = event.request;
  const userData: Record<string, unknown> = {};
  const em = hashEmail(event.email);
  if (em) userData.em = [em];
  if (event.externalId) userData.external_id = [sha256(event.externalId)];
  const ip = clientIp(headers);
  if (ip) userData.client_ip_address = ip;
  const ua = headers.get("user-agent");
  if (ua) userData.client_user_agent = ua;
  const fbp = event.request.cookies.get("_fbp")?.value ?? readCookie(headers.get("cookie"), "_fbp");
  if (fbp) userData.fbp = fbp;
  const fbc = event.request.cookies.get("_fbc")?.value ?? readCookie(headers.get("cookie"), "_fbc");
  if (fbc) userData.fbc = fbc;

  const customData: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(event.customData ?? {})) {
    if (value !== undefined && value !== "") customData[key] = value;
  }

  return {
    event_name: event.name,
    event_time: Math.floor(now / 1000),
    event_id: cleanEventId(event.eventId) ?? randomUUID(),
    action_source: "website",
    event_source_url: eventSourceUrl(headers),
    user_data: userData,
    ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
  };
}

/** Manda un evento a la API de conversiones si se puede. Nunca lanza. true si Meta lo acepto. */
export async function sendMetaServerEvent(event: MetaServerEvent): Promise<boolean> {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const pixelId = metaPixelId();
  if (!token || !pixelId) return false;
  try {
    if (!serverAdsAllowed(event.request)) return false;
    const form = new URLSearchParams({
      data: JSON.stringify([buildMetaServerPayload(event)]),
      access_token: token,
    });
    const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
    if (testCode) form.set("test_event_code", testCode);
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // Solo el estado y el codigo de Meta: el cuerpo puede repetir datos del evento.
      const body = (await res.json().catch(() => null)) as { error?: { code?: number } } | null;
      console.error(`[meta-capi] ${event.name} rechazado: ${res.status} codigo ${body?.error?.code ?? "?"}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[meta-capi] no se pudo mandar ${event.name}:`, error instanceof Error ? error.name : "error");
    return false;
  }
}

/** Manda el evento despues de responder (after() de Next), sin frenar la respuesta.
 * Fuera del contexto de una peticion (pruebas, scripts) after() lanza: entonces se manda
 * sin esperar. Nunca lanza, asi no se salta lo que venga despues en la ruta. */
export function queueMetaServerEvent(event: MetaServerEvent): void {
  try {
    after(() => sendMetaServerEvent(event));
  } catch {
    void sendMetaServerEvent(event);
  }
}
