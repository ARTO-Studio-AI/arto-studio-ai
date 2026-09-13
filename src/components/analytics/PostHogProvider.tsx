"use client";

import { useEffect, type ReactNode } from "react";
import { identifyUser, initAnalytics } from "@/lib/analytics";

/* Monta PostHog una vez por carga y enlaza la sesion con el usuario de Supabase.
 * El root layout pasa userId (solo el id, nunca el email) desde el servidor; con
 * null se resetea la identidad al cerrar sesion. Sin key o con doNotTrack, el
 * wrapper no hace nada y este componente tampoco. */

export default function PostHogProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  useEffect(() => {
    void initAnalytics();
    identifyUser(userId);
  }, [userId]);
  return <>{children}</>;
}
