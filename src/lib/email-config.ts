import { createAdminClient } from "@/lib/supabase/admin";
import { WELCOME_DEFAULT, type WelcomeContent } from "@/lib/email-templates/welcome";

/* Contenido editable de los correos (2026-10-07). Vive en engine_config para que se
 * cambie desde /admin/emails sin tocar codigo. Lo que falte se completa con el default. */

const KEY = "email_welcome";

export async function getWelcomeContent(): Promise<WelcomeContent> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("engine_config").select("value").eq("key", KEY).maybeSingle();
    const stored = (data?.value ?? {}) as Partial<WelcomeContent>;
    return { ...WELCOME_DEFAULT, ...stored, items: Array.isArray(stored.items) && stored.items.length ? stored.items : WELCOME_DEFAULT.items };
  } catch {
    return WELCOME_DEFAULT;
  }
}

export async function saveWelcomeContent(content: WelcomeContent, by: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("engine_config").upsert(
    {
      key: KEY,
      value: content,
      description: "Correo de bienvenida a la lista (editable desde /admin/emails)",
      updated_at: new Date().toISOString(),
      updated_by: by,
    },
    { onConflict: "key" },
  );
  if (error) console.error("[email-config] no se pudo guardar:", error.message);
  return !error;
}

/** Valida y recorta lo que llega del editor. */
export function sanitizeWelcome(raw: unknown): WelcomeContent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (k: string, max = 600) => (typeof r[k] === "string" ? (r[k] as string).slice(0, max) : String((WELCOME_DEFAULT as unknown as Record<string, unknown>)[k] ?? ""));
  const items = Array.isArray(r.items)
    ? (r.items as unknown[]).slice(0, 6).map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        const s = (k: string, max = 300) => (typeof o[k] === "string" ? (o[k] as string).slice(0, max) : "");
        return { title_es: s("title_es", 120), title_en: s("title_en", 120), body_es: s("body_es"), body_en: s("body_en"), url: s("url", 300) || "/" };
      })
    : WELCOME_DEFAULT.items;
  const url = (v: string) => (/^(https:\/\/|\/)/.test(v) ? v : "/");
  return {
    subject_es: str("subject_es", 150),
    subject_en: str("subject_en", 150),
    headline_es: str("headline_es", 80),
    headline_en: str("headline_en", 80),
    accent_es: str("accent_es", 40),
    accent_en: str("accent_en", 40),
    intro_es: str("intro_es", 800),
    intro_en: str("intro_en", 800),
    items: items.map((it) => ({ ...it, url: url(it.url) })),
    promo_enabled: r.promo_enabled === true,
    promo_title_es: str("promo_title_es", 150),
    promo_title_en: str("promo_title_en", 150),
    promo_body_es: str("promo_body_es", 600),
    promo_body_en: str("promo_body_en", 600),
    promo_cta_es: str("promo_cta_es", 60),
    promo_cta_en: str("promo_cta_en", 60),
    promo_url: url(str("promo_url", 300)),
  };
}
