import { NextRequest, NextResponse } from "next/server";
import { config } from "dotenv";
import path from "path";
import postgres from "postgres";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { addToMarketingList } from "@/lib/marketing-list";
import { sendListConfirmation } from "@/lib/mailer";
import { UTM_COOKIE, parseFirstTouch } from "@/lib/attribution";
import { LIST_SOURCE, WAITLIST_CONSENT_VERSION, parseWaitlistSource } from "@/lib/waitlist";

config({
  path: path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local"),
  override: true,
});

let cached: ReturnType<typeof postgres> | null = null;
function getDb() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached = postgres(url, { ssl: "require", max: 1, prepare: false });
  return cached;
}

/**
 * POST /api/waitlist  { email, source, lang?, marketing? }
 *
 * Lista de espera del Pack ARTO y de Agentes (2026-10-16, campana de lanzamiento):
 *   - La fila de `waitlist` se guarda siempre: es el aviso de apertura que la persona pidio.
 *   - Con `marketing: true` (casilla sin marcar en el formulario) entra a la lista de
 *     promociones con doble opt-in, igual que el roast: queda "pending" y se le manda el
 *     correo de confirmacion. Sin la casilla no se toca newsletter_subscribers.
 *   - Se guardan el primer toque de la cookie `asai_utm` (solo existe si acepto la
 *     analitica) y la version del texto de la casilla con la fecha del servidor.
 *   - Un fallo de base responde error; antes respondia ok y el correo se perdia.
 *   - Limite por IP (10/h) y por destinatario (3/h): manda correo a una direccion que
 *     escribe un tercero, no debe servir para bombardear a nadie.
 *   - Sin CORS: solo la usan /skills y /agents, del mismo origen. Con `*` cualquier sitio
 *     podia disparar altas desde el navegador de sus visitantes (auditoria de Fable, H2).
 *   - La respuesta no dice si el correo ya estaba en la lista: seria un oraculo para
 *     saber si un tercero esta suscrito (auditoria de Fable, H1).
 */
const RATE_LIMIT = 10;
const PER_RECIPIENT = 3;

function isoOrNull(value: string | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(`waitlist:ip:${getClientIp(request)}`, RATE_LIMIT);
  if (rl.limited) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { email?: unknown; source?: unknown; lang?: unknown; marketing?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const source = parseWaitlistSource(body.source);
  const lang = body.lang === "en" ? "en" : "es";
  const marketing = body.marketing === true;

  if (marketing) {
    const perTo = await checkRateLimit(`waitlist:to:${email}`, PER_RECIPIENT);
    if (perTo.limited) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: perTo.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(perTo.retryAfterSec) } },
      );
    }
  }

  const sql = getDb();
  if (!sql) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  // Si el ts de la cookie no parsea no se guarda nada del primer toque: la regla de no
  // pisarlo se ancla en first_touch_at (auditoria de Fable, H6).
  const rawFt = parseFirstTouch(request.cookies.get(UTM_COOKIE)?.value);
  const firstTouchAt = isoOrNull(rawFt?.ts);
  const ft = firstTouchAt ? rawFt : null;
  const consentVersion = marketing ? WAITLIST_CONSENT_VERSION : null;
  const consentAt = marketing ? new Date().toISOString() : null; // hora del servidor, no del navegador

  // Una fila por correo. Si ya existia: la casilla solo suma (un "no" posterior no borra un
  // "si" previo; la baja se hace con el enlace del correo), se guarda la fecha del primer
  // "si", `source` queda la primera lista y `sources` acumula todas, y el primer toque no
  // se pisa: solo se llena si la fila no lo tenia.
  try {
    await sql`
      INSERT INTO waitlist (
        email, source, sources, locale, marketing_opt_in, consent_version, consent_at,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        referrer, landing_path, first_touch_at
      ) VALUES (
        ${email}, ${source}, ARRAY[${source}]::text[], ${lang}, ${marketing}, ${consentVersion}, ${consentAt},
        ${ft?.utm_source ?? null}, ${ft?.utm_medium ?? null}, ${ft?.utm_campaign ?? null},
        ${ft?.utm_content ?? null}, ${ft?.utm_term ?? null},
        ${ft?.referrer ?? null}, ${ft?.landing_path ?? null}, ${firstTouchAt}
      )
      ON CONFLICT (email) DO UPDATE SET
        marketing_opt_in = waitlist.marketing_opt_in OR excluded.marketing_opt_in,
        consent_version = COALESCE(waitlist.consent_version, excluded.consent_version),
        consent_at = COALESCE(waitlist.consent_at, excluded.consent_at),
        sources = CASE
          WHEN excluded.source = ANY(COALESCE(waitlist.sources, ARRAY[waitlist.source])) THEN COALESCE(waitlist.sources, ARRAY[waitlist.source])
          ELSE array_append(COALESCE(waitlist.sources, ARRAY[waitlist.source]), excluded.source)
        END,
        locale = COALESCE(waitlist.locale, excluded.locale),
        utm_source = CASE WHEN waitlist.first_touch_at IS NULL THEN excluded.utm_source ELSE waitlist.utm_source END,
        utm_medium = CASE WHEN waitlist.first_touch_at IS NULL THEN excluded.utm_medium ELSE waitlist.utm_medium END,
        utm_campaign = CASE WHEN waitlist.first_touch_at IS NULL THEN excluded.utm_campaign ELSE waitlist.utm_campaign END,
        utm_content = CASE WHEN waitlist.first_touch_at IS NULL THEN excluded.utm_content ELSE waitlist.utm_content END,
        utm_term = CASE WHEN waitlist.first_touch_at IS NULL THEN excluded.utm_term ELSE waitlist.utm_term END,
        referrer = CASE WHEN waitlist.first_touch_at IS NULL THEN excluded.referrer ELSE waitlist.referrer END,
        landing_path = CASE WHEN waitlist.first_touch_at IS NULL THEN excluded.landing_path ELSE waitlist.landing_path END,
        first_touch_at = COALESCE(waitlist.first_touch_at, excluded.first_touch_at)
    `;
  } catch (error) {
    console.error("[/api/waitlist] DB error:", error);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Promociones: doble opt-in. Queda pendiente hasta que confirme desde su buzon.
  let confirmationSent = false;
  let confirmationFailed = false;
  if (marketing) {
    const list = await addToMarketingList({ email, source: LIST_SOURCE[source], requireConfirm: true });
    if (!list.ok) {
      return NextResponse.json({ error: "list_error" }, { status: 500 });
    }
    if (list.needsConfirmation) {
      confirmationSent = list.unsubscribeToken
        ? await sendListConfirmation(email, lang, list.unsubscribeToken, LIST_SOURCE[source])
        : false;
      confirmationFailed = !confirmationSent;
    }
  }

  // Sin el correo en el log: basta con saber de donde vino.
  console.log(
    JSON.stringify({
      event: "waitlist_signup",
      source,
      marketing,
      confirmation_sent: confirmationSent,
      utm_campaign: ft?.utm_campaign ?? null,
    }),
  );

  return NextResponse.json(
    { ok: true, marketing, confirmation_failed: confirmationFailed },
    undefined,
  );
}

export async function GET(request: NextRequest) {
  const { requireAdminSession } = await import("@/lib/auth");
  if (!(await requireAdminSession(request)).ok) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const sql = getDb();
  if (!sql) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const rows = await sql`
      SELECT id, email, source, sources, marketing_opt_in, utm_source, utm_medium, utm_campaign, created_at
      FROM waitlist
      ORDER BY created_at DESC
      LIMIT 200
    `;
    const [countResult] = await sql`SELECT COUNT(*)::int as total FROM waitlist`;
    return NextResponse.json(
      { signups: rows, total: countResult.total },
      undefined
    );
  } catch (error) {
    console.error("[/api/waitlist] Query error:", error);
    return NextResponse.json(
      { error: "Failed to query waitlist" },
      { status: 500 }
    );
  }
}
