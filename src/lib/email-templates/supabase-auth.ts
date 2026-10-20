import { C, F, button, hero, layout } from "./layout";

/* Plantillas de los correos de acceso que manda Supabase (D13): enlace magico y
 * confirmacion de registro. Viven en el panel de Supabase (Authentication → Email
 * Templates), pero se generan aqui con el mismo `layout()` que el resto para que no se
 * vuelvan a separar del diseno de marca (2026-10-20). Se suben con
 * `scripts/supabase-auth-templates.ts` por la Management API.
 *
 * Supabase no sabe el idioma: la plantilla elige con la variable de Go que guarda el
 * registro (`.Data.signup_locale`). Lo de {{ }} lo resuelve Supabase al mandar. */

export type AuthKind = "magic_link" | "confirmation";

const URL = "{{ .ConfirmationURL }}";
const EMAIL = "{{ .Email }}";

const COPY = {
  magic_link: {
    subject: "Tu enlace de acceso · Your sign-in link",
    es: {
      eyebrow: "Tu enlace de acceso",
      title: "Entra a",
      accent: "ARTO Studio AI.",
      intro: "Usa este enlace para iniciar sesión. Caduca en una hora y solo sirve una vez.",
      cta: "Iniciar sesión",
      reason: `Recibes este correo porque se pidió un enlace de acceso para ${EMAIL} en creative.artostudio.ai. Si no fuiste tú, ignóralo.`,
    },
    en: {
      eyebrow: "Your sign-in link",
      title: "Sign in to",
      accent: "ARTO Studio AI.",
      intro: "Use this link to sign in. It expires in one hour and works only once.",
      cta: "Sign in",
      reason: `You're getting this because a sign-in link was requested for ${EMAIL} at creative.artostudio.ai. If it wasn't you, ignore it.`,
    },
  },
  confirmation: {
    subject: "Confirma tu correo · Confirm your email",
    es: {
      eyebrow: "Un clic y entras",
      title: "Confirma tu",
      accent: "correo.",
      intro: "Confirma tu correo para activar tu cuenta gratis de ARTO Studio AI: prompts de estrategia de marca, el Brand Roast y lo nuevo antes que nadie.",
      cta: "Confirmar mi correo",
      reason: `Recibes este correo porque alguien (seguramente tú) creó una cuenta con ${EMAIL} en creative.artostudio.ai. Si no fuiste tú, ignóralo.`,
    },
    en: {
      eyebrow: "One click and you're in",
      title: "Confirm your",
      accent: "email.",
      intro: "Confirm your email to activate your free ARTO Studio AI account: brand strategy prompts, the Brand Roast and what's new before anyone else.",
      cta: "Confirm my email",
      reason: `You're getting this because someone (probably you) created an account with ${EMAIL} at creative.artostudio.ai. If it wasn't you, ignore it.`,
    },
  },
} as const;

function one(kind: AuthKind, lang: "es" | "en"): string {
  const t = COPY[kind][lang];
  const fallback = lang === "es" ? "Si el botón no funciona, copia este enlace en tu navegador:" : "If the button doesn't work, paste this link into your browser:";
  const body = `
    ${hero({ eyebrow: t.eyebrow, title: t.title, accent: t.accent, intro: t.intro })}
    <div style="margin-top:26px;">${button(t.cta, URL, "accent")}</div>
    <div style="font-family:${F.body};font-size:13px;line-height:20px;color:${C.ink3};margin-top:18px;">${fallback}<br><a href="${URL}" style="color:${C.ink2};word-break:break-all;">${URL}</a></div>`;
  return layout({ lang, preheader: t.intro, body, reason: t.reason });
}

/** Asunto y HTML listos para el panel de Supabase, con la rama ES/EN. */
export function supabaseAuthTemplate(kind: AuthKind): { subject: string; html: string } {
  return {
    subject: COPY[kind].subject,
    html: `{{ if and .Data.signup_locale (eq .Data.signup_locale "es") }}${one(kind, "es")}{{ else }}${one(kind, "en")}{{ end }}`,
  };
}
