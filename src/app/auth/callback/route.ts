import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adoptOpens } from "@/lib/prompt-limit";
import { captureServer } from "@/lib/analytics-server";
import { splitName, upsertAudienceContact } from "@/lib/resend-audience";
import { isLocale } from "@/i18n/config";
import { safeNextPath } from "@/lib/safe-next";
import {
  SIGNUP_COOKIE,
  UTM_COOKIE,
  UTM_KEYS,
  cleanValue,
  parseFirstTouch,
  parseSignupExtra,
  signupSourceOf,
  type UtmKey,
} from "@/lib/attribution";

const VISITOR_COOKIE = "asai_vid";

/* Un usuario creado hace menos de esto y sin fila de signup en attribution_events
 * es un registro nuevo. El magic link caduca en 1 h, asi que 24 h sobra; los
 * usuarios anteriores a la Fase 1C tienen created_at viejo y caen en login. */
const SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;

const PROFILE_CAPTURE_COLUMNS = [
  "company",
  "role",
  "signup_source",
  ...UTM_KEYS,
  "referrer",
  "signup_locale",
] as const;
type CaptureColumn = (typeof PROFILE_CAPTURE_COLUMNS)[number];
type ProfileCapture = Partial<Record<CaptureColumn, string | null>> & { full_name?: string | null };

/**
 * Captacion del signup (Fase 1C, 13 sep 2026). Corre despues del exchange y
 * nunca bloquea el login: cualquier fallo se registra en consola y se sigue.
 *
 *   1. Decide si es signup o login (ventana de 24 h + ausencia de fila).
 *   2. Signup: completa profiles con lo que el trigger no pudo copiar (Google no
 *      manda options.data), escribe attribution_events, manda signup_completed
 *      a PostHog y da de alta el contacto en la audiencia de Resend.
 *   3. Login: manda login_completed.
 */
async function recordSignupOrLogin(request: NextRequest, user: User): Promise<void> {
  const provider = cleanValue(user.app_metadata?.provider) ?? "email";
  const admin = createAdminClient();

  let isSignup = false;
  if (Date.now() - Date.parse(user.created_at) < SIGNUP_WINDOW_MS) {
    const { data: existing } = await admin
      .from("attribution_events")
      .select("id")
      .eq("event_type", "signup")
      .eq("target_id", user.id)
      .limit(1)
      .maybeSingle();
    isSignup = !existing;
  }

  if (!isSignup) {
    await captureServer(user.id, "login_completed", { provider });
    return;
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstTouch = parseFirstTouch(request.cookies.get(UTM_COOKIE)?.value);
  const extra = parseSignupExtra(request.cookies.get(SIGNUP_COOKIE)?.value);

  // Prioridad: lo que viajo en el magic link (raw_user_meta_data) > cookies.
  const company = cleanValue(meta.company) ?? extra?.company ?? null;
  const role = cleanValue(meta.role) ?? extra?.role ?? null;
  const localeRaw = cleanValue(meta.signup_locale) ?? extra?.locale ?? null;
  const locale = isLocale(localeRaw) ? localeRaw : null;
  const utm: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const value = cleanValue(meta[key]) ?? firstTouch?.[key];
    if (value) utm[key] = value;
  }
  const referrer = cleanValue(meta.referrer) ?? firstTouch?.referrer ?? null;
  const signupSource = cleanValue(meta.signup_source) ?? signupSourceOf(firstTouch);

  // Completa el perfil solo en las columnas que el trigger dejo vacias.
  const { data: profile } = await admin
    .from("profiles")
    .select(`full_name, ${PROFILE_CAPTURE_COLUMNS.join(", ")}`)
    .eq("id", user.id)
    .maybeSingle<ProfileCapture>();
  if (profile) {
    const patch: Record<string, string> = {};
    const fill = (column: CaptureColumn, value: string | null | undefined) => {
      if (value && !profile[column]) patch[column] = value;
    };
    fill("company", company);
    fill("role", role);
    fill("signup_source", signupSource);
    for (const key of UTM_KEYS) fill(key, utm[key]);
    fill("referrer", referrer);
    if (locale && !profile.signup_locale) {
      patch.signup_locale = locale;
      patch.preferred_language = locale;
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from("profiles").update(patch).eq("id", user.id);
      if (error) console.error("[auth/callback] no se pudo completar profiles:", error.message);
    }
  }

  const { error: attrError } = await admin.from("attribution_events").insert({
    event_type: "signup",
    source: provider,
    source_detail: signupSource,
    target_id: user.id,
    user_email: user.email ?? null,
    utm_source: utm.utm_source ?? null,
    utm_medium: utm.utm_medium ?? null,
    utm_campaign: utm.utm_campaign ?? null,
    metadata: {
      utm_content: utm.utm_content ?? null,
      utm_term: utm.utm_term ?? null,
      referrer,
      landing_path: firstTouch?.landing_path ?? null,
      first_touch_at: firstTouch?.ts ?? null,
      locale,
      company,
      role,
    },
  });
  if (attrError) console.error("[auth/callback] attribution_events fallo:", attrError.message);

  await captureServer(user.id, "signup_completed", {
    provider,
    signup_source: signupSource,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    locale: locale ?? "en",
    has_company: !!company,
    has_role: !!role,
  });

  if (user.email) {
    const fullName =
      cleanValue(profile?.full_name) ?? cleanValue(meta.full_name) ?? cleanValue(meta.name) ?? null;
    await upsertAudienceContact({ email: user.email, ...splitName(fullName) });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // Use the public site URL from env (configured per Vercel project),
  // NOT url.origin: Vercel rewrite proxies can leak the standalone host.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/+$/, "");
  // H-46 (13 sep 2026): `next` viene de la peticion. Sin validar, `next=@evil.com`
  // o `next=.evil.com` sacaban al usuario del dominio ya con sesion iniciada.
  const next = safeNextPath(url.searchParams.get("next"), "/", siteUrl);
  const target = `${siteUrl}${next}`;

  if (code) {
    const sb = await createClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await sb.auth.getUser();

      // Contador free: las aperturas de hoy hechas como anonimo pasan al usuario,
      // asi registrarse no regala 3 prompts mas (D7). Nunca bloquea el login.
      const vid = request.cookies.get(VISITOR_COOKIE)?.value;
      if (vid && user) await adoptOpens(`vid:${vid}`, `user:${user.id}`);

      if (user) {
        try {
          await recordSignupOrLogin(request, user);
        } catch (err) {
          console.error("[auth/callback] captacion fallo, el login sigue:", err);
        }
      }

      const res = NextResponse.redirect(target);
      // La cookie corta de empresa/rol ya cumplio; se borra siempre.
      res.cookies.set(SIGNUP_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
    return NextResponse.redirect(`${siteUrl}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${siteUrl}/login?error=missing_code`);
}
