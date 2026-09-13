import type { PostHog } from "posthog-js";

/* Wrapper de PostHog para el navegador (Fase 1C, 13 sep 2026).
 *
 * Reglas:
 *   - Si falta NEXT_PUBLIC_POSTHOG_KEY, todo es no-op y se avisa una sola vez en
 *     consola. Nunca truena: un sitio sin analitica es mejor que un sitio caido.
 *   - Se respeta navigator.doNotTrack: con DNT activo no se inicializa nada.
 *   - person_profiles: 'identified_only'. Los anonimos no crean perfil de persona;
 *     al iniciar sesion se llama identify() con el id de Supabase, nunca con el email.
 *   - Los eventos son tipados (AnalyticsEvents). Un evento que no este aqui no se
 *     manda; asi docs/METRICS.md y el codigo no se separan.
 *   - posthog-js se carga con import() dinamico solo cuando hay key, para que el
 *     bundle de las paginas y las pruebas en node no lo arrastren.
 *
 * Servidor: src/lib/analytics-server.ts (posthog-node) para signup y login, que
 * ocurren en /auth/callback sin navegador de por medio. */

export type AnalyticsTier = "anon" | "free" | "pro" | "enterprise" | (string & {});

export interface AnalyticsEvents {
  roast_started: { industry: string; company_size: string; has_url: boolean; has_description: boolean };
  roast_completed: { industry: string; overall: number; source: string };
  roast_shared: {
    channel: "x" | "linkedin" | "whatsapp" | "copy_link" | "download_square" | "download_story";
    overall: number;
  };
  roast_email_submitted: { industry: string; overall: number };
  signup_completed: {
    provider: string;
    signup_source: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    locale: string;
    has_company: boolean;
    has_role: boolean;
  };
  login_completed: { provider: string };
  prompt_opened: {
    prompt_id: string;
    prompt_tier: string;
    used: number;
    limit: number;
    tier: AnalyticsTier;
    locale: string;
  };
  free_limit_reached: { prompt_id: string; tier: AnalyticsTier; signed_in: boolean; locale: string };
  limit_cta_clicked: { cta: "pricing" | "library" | "signup"; prompt_id: string; locale: string };
  prompt_copied: { prompt_id: string; prompt_tier: string; locale: string };
  search_performed: { lang: string; query_length: number; results_count: number; ok: boolean };
  favorite_added: { prompt_id: string };
  pricing_viewed: { locale: string; signed_in: boolean };
  checkout_started: { plan: "pro"; price_usd: number; locale: string; signed_in: boolean };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

let client: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;
let warned = false;

function warnOnce(message: string): void {
  if (warned) return;
  warned = true;
  console.warn(`[analytics] ${message}`);
}

/** Key publica de PostHog o null si no esta definida (o esta vacia). */
export function analyticsKey(): string | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function analyticsHost(): string {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  return host && host.trim() ? host.trim().replace(/\/+$/, "") : DEFAULT_POSTHOG_HOST;
}

/** true si el navegador pide no rastrear (navigator.doNotTrack, window.doNotTrack o msDoNotTrack). */
export function doNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { msDoNotTrack?: string | null };
  const win = globalThis as { doNotTrack?: string | null };
  const value = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack ?? null;
  return value === "1" || value === "yes";
}

/**
 * Inicializa posthog-js una sola vez. Devuelve el cliente o null si no aplica
 * (sin key, DNT activo, fuera del navegador o fallo de carga). Nunca lanza.
 */
export function initAnalytics(): Promise<PostHog | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const key = analyticsKey();
    if (!key) {
      warnOnce("NEXT_PUBLIC_POSTHOG_KEY ausente; los eventos quedan en modo no-op");
      return null;
    }
    if (doNotTrack()) {
      warnOnce("doNotTrack activo; PostHog no se inicializa");
      return null;
    }
    if (typeof window === "undefined") return null;
    try {
      const mod = await import("posthog-js");
      const ph = mod.default;
      ph.init(key, {
        api_host: analyticsHost(),
        person_profiles: "identified_only",
        // App Router: las navegaciones de cliente cambian el history, no recargan.
        capture_pageview: "history_change",
        capture_pageleave: true,
        // Solo eventos tipados; el autocapture de clics mete ruido sin nombre.
        autocapture: false,
        // H-47 (13 sep 2026): grabacion de sesiones apagada de forma explicita, sin
        // depender del ajuste del proyecto en PostHog. Se enciende solo por decision
        // de Victor y despues de tener aviso de cookies (H-48). D9 en docs/DECISIONES.md.
        disable_session_recording: true,
        respect_dnt: true,
        persistence: "localStorage+cookie",
      });
      client = ph;
      return ph;
    } catch (error) {
      warnOnce(`no se pudo cargar posthog-js: ${String(error)}`);
      return null;
    }
  })();
  return initPromise;
}

/** Manda un evento tipado. No-op silencioso si no hay cliente. */
export function track<E extends AnalyticsEvent>(event: E, props: AnalyticsEvents[E]): void {
  if (client) {
    try {
      client.capture(event, props);
    } catch {
      /* nunca romper la UI por analitica */
    }
    return;
  }
  void initAnalytics()
    .then((ph) => {
      ph?.capture(event, props);
    })
    .catch(() => {});
}

/**
 * Enlaza la sesion anonima con el usuario de Supabase (solo el id, nunca email).
 * Con null (sesion cerrada) resetea la identidad para no seguir atribuyendo
 * eventos anonimos al usuario anterior.
 */
export function identifyUser(userId: string | null): void {
  void initAnalytics()
    .then((ph) => {
      if (!ph) return;
      if (userId) {
        if (ph.get_distinct_id() !== userId) ph.identify(userId);
        return;
      }
      const maybe = ph as unknown as { _isIdentified?: () => boolean };
      if (typeof maybe._isIdentified === "function" && maybe._isIdentified()) ph.reset();
    })
    .catch(() => {});
}

/** Solo para pruebas: vuelve al estado inicial del modulo. */
export function __resetAnalyticsForTests(): void {
  client = null;
  initPromise = null;
  warned = false;
}
