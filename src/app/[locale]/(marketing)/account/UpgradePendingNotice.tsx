"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, { waiting: string; slow: string }> = {
  en: {
    waiting: "Payment received. Your plan will activate in a few seconds.",
    slow: "Still activating. If your plan does not show up in a minute, reload this page or write to hello@artogroup.com.",
  },
  es: {
    waiting: "Tu pago se recibió; tu plan se activa en unos segundos.",
    slow: "Sigue activándose. Si en un minuto no aparece tu plan, recarga esta página o escribe a hello@artogroup.com.",
  },
};

const INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10;

/* Se muestra mientras el perfil sigue en `free` tras volver de Stripe.
 * Refresca el server component cada 3 s para releer el tier real que
 * escribe el webhook; tras 10 intentos deja de insistir. */
export function UpgradePendingNotice({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const copy = COPY[locale];

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) return;
    const timer = setTimeout(() => {
      router.refresh();
      setAttempts((n) => n + 1);
    }, INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [attempts, router]);

  const gaveUp = attempts >= MAX_ATTEMPTS;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
    >
      {!gaveUp && (
        <span
          aria-hidden="true"
          className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"
        />
      )}
      <p>{gaveUp ? copy.slow : copy.waiting}</p>
    </div>
  );
}
