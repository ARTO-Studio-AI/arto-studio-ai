"use client";

import { useEffect, type ReactNode } from "react";
import { identifyUser, initAnalytics } from "@/lib/analytics";
import { CONSENT_CHANGED_EVENT } from "@/lib/consent";

/* Monta PostHog una vez por carga y enlaza la sesion con el usuario de Supabase.
 * El root layout pasa userId (solo el id, nunca el email) desde el servidor; con
 * null se resetea la identidad al cerrar sesion. Sin key, con doNotTrack o sin
 * consentimiento de analitica (H-48), el wrapper no hace nada y este componente
 * tampoco. Si la persona acepta en el aviso de cookies, se vuelve a intentar. */

export default function PostHogProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  useEffect(() => {
    void initAnalytics();
    identifyUser(userId);
    const onConsent = () => identifyUser(userId);
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsent);
  }, [userId]);
  return <>{children}</>;
}
