"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";

/* Form copy per locale. The email label used to wrap the input AND sit
 * right next to the submit button, so screen readers and crawlers read it
 * as "EmailSend magic link". The label now points at the input by id and
 * the button stays a sibling. */
const COPY: Record<Locale, {
  google: string;
  redirecting: string;
  divider: string;
  email_label: string;
  email_placeholder: string;
  send: string;
  sending: string;
  sent_title: string;
  sent_body_before: string;
  sent_body_after: string;
}> = {
  en: {
    google: "Sign in with Google",
    redirecting: "Redirecting…",
    divider: "or continue with email",
    email_label: "Email",
    email_placeholder: "you@example.com",
    send: "Send magic link",
    sending: "Sending…",
    sent_title: "Check your email.",
    sent_body_before: "We sent a magic link to ",
    sent_body_after: ". Click it to sign in.",
  },
  es: {
    google: "Inicia sesión con Google",
    redirecting: "Redirigiendo…",
    divider: "o continúa con tu correo",
    email_label: "Correo electrónico",
    email_placeholder: "tu@ejemplo.com",
    send: "Enviar enlace mágico",
    sending: "Enviando…",
    sent_title: "Revisa tu correo.",
    sent_body_before: "Te enviamos un enlace mágico a ",
    sent_body_after: ". Ábrelo para iniciar sesión.",
  },
};

const EMAIL_INPUT_ID = "login-email";

export default function LoginForm({ locale = "en" }: { locale?: Locale }) {
  const c = COPY[locale] ?? COPY.en;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  function siteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, "");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);

    const redirectTo = `${siteUrl()}/auth/callback`;
    const sb = createClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
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
    const redirectTo = `${siteUrl()}/auth/callback`;
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

  if (status === "sent") {
    return (
      <div className="text-sm">
        <p className="font-medium text-neutral-900">{c.sent_title}</p>
        <p className="mt-1 text-neutral-500">
          {c.sent_body_before}
          <span className="font-mono">{email}</span>
          {c.sent_body_after}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onGoogle}
        disabled={googleLoading}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-500 disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
          <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.347 2.827.957 4.042l3.007-2.332z" />
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
        {googleLoading ? c.redirecting : c.google}
      </button>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200" />
        <span>{c.divider}</span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor={EMAIL_INPUT_ID} className="block text-sm font-medium text-neutral-700">
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
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            placeholder={c.email_placeholder}
          />
        </div>
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {status === "sending" ? c.sending : c.send}
        </button>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
      </form>
    </div>
  );
}
