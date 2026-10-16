"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { buttonClass } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { WaitlistSource } from "@/lib/waitlist";

/* Lista de espera del Pack ARTO (/skills) y de Agentes (/agents). POSTea a /api/waitlist.
 * El correo queda para el aviso de apertura. La casilla de promociones va sin marcar y
 * con enlace al aviso de privacidad; si la marca, el servidor la da de alta con doble
 * opt-in (2026-10-16). Si cambia el texto de `consent`, sube WAITLIST_CONSENT_VERSION
 * en src/lib/waitlist.ts. */

const COPY = {
  es: {
    placeholder: "tu@empresa.com",
    label: "Correo electrónico",
    consent: "Quiero recibir por correo promociones, prompts nuevos y skills de ARTO. Puedo darme de baja cuando quiera.",
    privacy: "Aviso de privacidad",
    saving: "Guardando...",
    saved: "Guardado",
    ok: "Listo. Te avisamos por correo el día que abra.",
    ok_confirm: "Listo. Si aún no estabas en nuestra lista, te llega un correo para confirmar las promociones. Revisa tu bandeja.",
    ok_confirm_failed: "Quedaste en la lista de espera, pero no pudimos mandarte el correo para confirmar las promociones. Inténtalo más tarde.",
    err_email: "Escribe un correo válido.",
    err_rate: "Demasiados intentos. Prueba de nuevo en una hora.",
    err_generic: "No pudimos guardar tu correo. Inténtalo de nuevo.",
    err_network: "Sin conexión. Inténtalo de nuevo.",
  },
  en: {
    placeholder: "you@company.com",
    label: "Email",
    consent: "Send me ARTO's promotions, new prompts and skills by email. I can unsubscribe anytime.",
    privacy: "Privacy policy",
    saving: "Saving...",
    saved: "Saved",
    ok: "Done. We'll email you the day it opens.",
    ok_confirm: "Done. If you weren't on our list yet, you'll get an email to confirm promotions. Check your inbox.",
    ok_confirm_failed: "You're on the waitlist, but we couldn't send the email to confirm promotions. Please try again later.",
    err_email: "Enter a valid email.",
    err_rate: "Too many tries. Try again in an hour.",
    err_generic: "We couldn't save your email. Try again.",
    err_network: "No connection. Try again.",
  },
} as const;

interface Props {
  source?: WaitlistSource;
  cta?: string;
  locale: Locale;
}

export default function NewsletterForm({ source = "general", cta, locale }: Props) {
  const t = COPY[locale === "en" ? "en" : "es"];
  const consentId = useId();
  const [email, setEmail] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source, lang: locale, marketing }),
      });
      const data = (await res.json().catch(() => ({}))) as { marketing?: boolean; confirmation_failed?: boolean };
      if (res.ok) {
        setStatus("ok");
        setMessage(
          !data.marketing ? t.ok : data.confirmation_failed ? t.ok_confirm_failed : t.ok_confirm,
        );
        setEmail("");
      } else {
        setStatus("error");
        setMessage(res.status === 400 ? t.err_email : res.status === 429 ? t.err_rate : t.err_generic);
      }
    } catch {
      setStatus("error");
      setMessage(t.err_network);
    }
  }

  const locked = status === "loading" || status === "ok";

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-md flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.label}
          className="flex-1 rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-zinc-900 focus:outline-none"
          disabled={locked}
        />
        <button type="submit" disabled={locked} className={buttonClass("primary", "md")}>
          {status === "loading" ? t.saving : status === "ok" ? t.saved : cta}
        </button>
      </div>
      <label htmlFor={consentId} className="flex items-start gap-2.5 text-left text-xs text-zinc-500">
        <input
          id={consentId}
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          disabled={locked}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300"
        />
        <span>
          {t.consent}{" "}
          <Link href={`/${locale}/privacy`} target="_blank" rel="noopener" className="underline underline-offset-2">
            {t.privacy}
          </Link>
        </span>
      </label>
      {message && (
        <p className={`text-xs ${status === "error" ? "text-[var(--bad)]" : "text-zinc-600"}`} role={status === "error" ? "alert" : "status"}>
          {message}
        </p>
      )}
    </form>
  );
}
