"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import { track } from "@/lib/analytics";
import {
  NEXT_COOKIE,
  NEXT_COOKIE_MAX_AGE,
  SIGNUP_COOKIE,
  SIGNUP_COOKIE_MAX_AGE,
  UTM_COOKIE,
  parseFirstTouch,
  readBrowserCookie,
  signupMetadata,
  writeBrowserCookie,
} from "@/lib/attribution";

/* Form copy per locale. The email label used to wrap the input AND sit
 * right next to the submit button, so screen readers and crawlers read it
 * as "EmailSend magic link". The label now points at the input by id and
 * the button stays a sibling.
 *
 * Captacion (Fase 1C, 13 sep 2026): Empresa y Rol son opcionales y nunca
 * bloquean. Van con los UTM de la cookie asai_utm en options.data del magic
 * link (raw_user_meta_data → trigger handle_new_user → profiles). Google no
 * admite options.data, asi que antes de redirigir se dejan en la cookie corta
 * asai_signup y /auth/callback completa el perfil desde ahi.
 *
 * Conversion (2026-11-05): Google va como boton principal y grande (es el camino de un
 * clic) y el estado «revisa tu correo» dice que buscar: remitente (noreply@artostudio.ai,
 * D13 en docs/DECISIONES.md), asunto (src/lib/email-templates/supabase-auth.ts), spam y
 * promociones, y deja reenviar con el mismo onSubmit. Solo cambio la presentacion: las
 * llamadas a Supabase, las cookies y la casilla de consentimiento SIN marcar son las de
 * antes. Los clics se miden envolviendo onGoogle y onSubmit, sin tocarlos. */
const RESEND_SECONDS = 60; // Supabase no deja pedir otro enlace al mismo correo antes de 60 s

const COPY: Record<Locale, {
  google: string;
  google_hint: string;
  redirecting: string;
  divider: string;
  email_label: string;
  email_placeholder: string;
  company_label: string;
  company_placeholder: string;
  role_label: string;
  role_placeholder: string;
  optional: string;
  send: string;
  sending: string;
  sent_title: string;
  sent_body_before: string;
  sent_body_after: string;
  sent_from_label: string;
  sent_subject_label: string;
  sent_subject: string;
  sent_missing_label: string;
  sent_missing: string;
  sent_note: string;
  resend: string;
  resend_wait: (s: number) => string;
  other_email: string;
  consent: string;
}> = {
  en: {
    google: "Continue with Google",
    google_hint: "One click, no password.",
    redirecting: "Redirecting…",
    divider: "or with your email",
    email_label: "Email",
    email_placeholder: "you@example.com",
    company_label: "Company",
    company_placeholder: "Where do you work?",
    role_label: "Role",
    role_placeholder: "Founder, creative director, marketer…",
    optional: "optional",
    send: "Email me a sign-in link",
    sending: "Sending…",
    sent_title: "Check your email",
    sent_body_before: "We sent a sign-in link to ",
    sent_body_after: ".",
    sent_from_label: "From",
    sent_subject_label: "Subject",
    sent_subject: "“Confirma tu correo · Confirm your email” if it's your first time, or “Tu enlace de acceso · Your sign-in link” if you already had an account.",
    sent_missing_label: "Not there?",
    sent_missing: "Check Spam and Promotions. It can take a couple of minutes.",
    sent_note: "Open it in this same browser. The link expires in one hour and works once.",
    resend: "Resend link",
    resend_wait: (s) => `Resend in ${s} s`,
    other_email: "Use another email",
    consent: "Send me ARTO's promotions, new prompts and skills by email. I can unsubscribe anytime.",
  },
  es: {
    google: "Continuar con Google",
    google_hint: "Un clic, sin contraseña.",
    redirecting: "Redirigiendo…",
    divider: "o con tu correo",
    email_label: "Correo electrónico",
    email_placeholder: "tu@ejemplo.com",
    company_label: "Empresa",
    company_placeholder: "¿Dónde trabajas?",
    role_label: "Rol",
    role_placeholder: "Fundador, director creativo, marketing…",
    optional: "opcional",
    send: "Enviarme el enlace de acceso",
    sending: "Enviando…",
    sent_title: "Revisa tu correo",
    sent_body_before: "Te mandamos un enlace de acceso a ",
    sent_body_after: ".",
    sent_from_label: "De",
    sent_subject_label: "Asunto",
    sent_subject: "«Confirma tu correo · Confirm your email» si es tu primera vez, o «Tu enlace de acceso · Your sign-in link» si ya tenías cuenta.",
    sent_missing_label: "¿No llega?",
    sent_missing: "Revisa Spam y Promociones. Puede tardar un par de minutos.",
    sent_note: "Ábrelo en este mismo navegador. El enlace caduca en una hora y sirve una sola vez.",
    resend: "Reenviar enlace",
    resend_wait: (s) => `Reenviar en ${s} s`,
    other_email: "Usar otro correo",
    consent: "Quiero recibir por correo promociones, prompts nuevos y skills de ARTO. Puedo darme de baja cuando quiera.",
  },
};

const EMAIL_INPUT_ID = "login-email";
const COMPANY_INPUT_ID = "login-company";
const ROLE_INPUT_ID = "login-role";
const CONSENT_INPUT_ID = "login-marketing";
const FIELD_CLASS =
  "mt-1 block w-full rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none";

/* Registro free (2026-10-06, decision de Victor): abrir un prompt pide cuenta. La casilla
 * de correos de promocion va SIN marcar: el consentimiento tiene que ser expreso (LFPDPPP
 * en Mexico, RGPD para visitantes de la UE). Viaja en options.data (magic link) o en la
 * cookie asai_signup (Google) y el callback solo da de alta en Resend a quien dijo que si.
 * `next` (ya validado en el servidor) se guarda en la cookie asai_next. */
export default function LoginForm({ locale = "en", next }: { locale?: Locale; next?: string }) {
  const c = COPY[locale] ?? COPY.en;
  const [marketing, setMarketing] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Presentacion del estado enviado (2026-11-05): reenvio con espera y reloj para la cuenta atras.
  const [resending, setResending] = useState(false);
  const [submittedAt, setSubmittedAt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (status !== "sent") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  function siteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, "");
  }

  /* UTM y referrer de la primera visita (cookie asai_utm que pone src/proxy.ts)
   * mas lo que el usuario escribio. Solo claves con valor. */
  function captureData(): Record<string, string> {
    const firstTouch = parseFirstTouch(readBrowserCookie(UTM_COOKIE));
    return signupMetadata(firstTouch, { company, role, locale, marketing: marketing ? "yes" : "no" });
  }

  function rememberNext() {
    if (!next) return;
    try {
      writeBrowserCookie(NEXT_COOKIE, next, NEXT_COOKIE_MAX_AGE);
    } catch {
      /* sin cookie se vuelve al inicio */
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);
    rememberNext();

    const redirectTo = `${siteUrl()}/auth/callback`;
    const sb = createClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, data: captureData() },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  async function onGoogle() {
    setGoogleLoading(true);
    setErrorMsg(null);
    rememberNext();
    const redirectTo = `${siteUrl()}/auth/callback`;
    // signInWithOAuth no lleva options.data: los campos viajan en una cookie
    // corta que /auth/callback lee y borra. Los UTM ya estan en asai_utm.
    try {
      writeBrowserCookie(
        SIGNUP_COOKIE,
        JSON.stringify({ company: company.trim(), role: role.trim(), locale, marketing: marketing ? "yes" : "no" }),
        SIGNUP_COOKIE_MAX_AGE,
      );
    } catch {
      /* sin cookie no pasa nada: el perfil queda sin empresa ni rol */
    }
    const sb = createClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setGoogleLoading(false);
      setErrorMsg(error.message);
    }
  }

  /* Medicion del embudo (2026-11-05): se envuelven onGoogle y onSubmit para no tocarlos. */
  function handleGoogleClick() {
    track("signup_google_clicked", { locale, has_next: !!next, marketing_opt_in: marketing });
    void onGoogle();
  }

  function handleEmailSubmit(e: FormEvent) {
    const isResend = status === "sent";
    track("signup_email_submitted", {
      locale,
      has_next: !!next,
      marketing_opt_in: marketing,
      has_company: !!company.trim(),
      has_role: !!role.trim(),
      resend: isResend,
    });
    setResending(isResend);
    const at = Date.now();
    setSubmittedAt(at);
    setNow(at);
    void onSubmit(e);
  }

  if (status === "sent" || (resending && status === "sending")) {
    const wait = Math.max(0, Math.ceil((submittedAt + RESEND_SECONDS * 1000 - now) / 1000));
    return (
      <div className="text-sm" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--lime-soft)] text-[var(--accent)]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 5.5l7 5.5 7-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-lg font-extrabold text-zinc-900">{c.sent_title}</p>
        </div>
        <p className="mt-3 text-zinc-600">
          {c.sent_body_before}
          <span className="break-all font-mono text-zinc-900">{email}</span>
          {c.sent_body_after}
        </p>
        <dl className="mt-4 space-y-2.5 rounded-[var(--radius-md)] bg-zinc-50 p-4">
          <div>
            <dt className="text-eyebrow text-zinc-500">{c.sent_from_label}</dt>
            <dd className="mt-0.5 font-mono text-zinc-900">noreply@artostudio.ai</dd>
          </div>
          <div>
            <dt className="text-eyebrow text-zinc-500">{c.sent_subject_label}</dt>
            <dd className="mt-0.5 text-zinc-800">{c.sent_subject}</dd>
          </div>
          <div>
            <dt className="text-eyebrow text-zinc-500">{c.sent_missing_label}</dt>
            <dd className="mt-0.5 text-zinc-800">{c.sent_missing}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-500">{c.sent_note}</p>
        <form onSubmit={handleEmailSubmit} className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={wait > 0 || status === "sending"}
            className="rounded-[var(--radius-sm)] border border-zinc-900 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:border-zinc-300 disabled:text-zinc-500"
          >
            {status === "sending" ? c.sending : wait > 0 ? c.resend_wait(wait) : c.resend}
          </button>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            {c.other_email}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label htmlFor={CONSENT_INPUT_ID} className="flex items-start gap-2.5 text-sm text-zinc-600">
        <input
          id={CONSENT_INPUT_ID}
          name="marketing"
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300"
        />
        <span>
          {c.consent}{" "}
          <Link href={`/${locale}/privacy`} className="underline underline-offset-2">
            {locale === "es" ? "Aviso de privacidad" : "Privacy policy"}
          </Link>
        </span>
      </label>

      <div>
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={googleLoading}
          className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[var(--radius-sm)] bg-zinc-900 px-4 py-3 text-base font-semibold text-white shadow-[var(--shadow-sm)] transition hover:bg-zinc-700 disabled:opacity-50"
        >
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-[4px] bg-white">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.347 2.827.957 4.042l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
            </svg>
          </span>
          {googleLoading ? c.redirecting : c.google}
        </button>
        <p className="mt-1.5 text-center text-xs text-zinc-500">{c.google_hint}</p>
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-zinc-200" />
        <span>{c.divider}</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-3">
        <div>
          <label htmlFor={EMAIL_INPUT_ID} className="block text-sm font-medium text-zinc-700">
            {c.email_label}
          </label>
          <input
            id={EMAIL_INPUT_ID}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD_CLASS}
            placeholder={c.email_placeholder}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={COMPANY_INPUT_ID} className="block text-sm font-medium text-zinc-700">
              {c.company_label}{" "}
              <span className="font-normal text-zinc-500">({c.optional})</span>
            </label>
            <input
              id={COMPANY_INPUT_ID}
              name="company"
              type="text"
              autoComplete="organization"
              maxLength={200}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={FIELD_CLASS}
              placeholder={c.company_placeholder}
            />
          </div>
          <div>
            <label htmlFor={ROLE_INPUT_ID} className="block text-sm font-medium text-zinc-700">
              {c.role_label}{" "}
              <span className="font-normal text-zinc-500">({c.optional})</span>
            </label>
            <input
              id={ROLE_INPUT_ID}
              name="role"
              type="text"
              autoComplete="organization-title"
              maxLength={200}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={FIELD_CLASS}
              placeholder={c.role_placeholder}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded-[var(--radius-sm)] border border-zinc-900 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          {status === "sending" ? c.sending : c.send}
        </button>
        {errorMsg && <p className="text-sm text-[var(--bad)]">{errorMsg}</p>}
      </form>
    </div>
  );
}
