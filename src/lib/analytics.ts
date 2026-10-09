import type { PostHog } from "posthog-js";
import { browserConsent } from "@/lib/consent";

/* Wrapper de PostHog para el navegador (Fase 1C, 13 sep 2026).
 *
 * Reglas:
 *   - Si falta NEXT_PUBLIC_POSTHOG_KEY, todo es no-op y se avisa una sola vez en
 *     consola. Nunca truena: un sitio sin analitica es mejor que un sitio caido.
 *   - Se respeta navigator.doNotTrack: con DNT activo no se inicializa nada.
 *   - Sin consentimiento de analitica (cookie asai_consent = "all", src/lib/consent.ts)
 *     no se inicializa ni se escribe nada (H-48, 9 oct 2026). Si la persona acepta
 *     despues, el aviso vuelve a llamar initAnalytics(); si retira el consentimiento,
 *     revokeAnalytics() apaga la captura y borra lo que PostHog guardo.
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
  signup_wall_viewed: { prompt_id: string; locale: string };
  signup_wall_clicked: { prompt_id: string; locale: string };
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
/* posthog-js ya inicializado en esta carga. Sobrevive a revokeAnalytics(): un segundo
 * init() es no-op, asi que al volver a aceptar se llama opt_in_capturing() sobre este. */
let loaded: PostHog | null = null;
/* Sube con cada revokeAnalytics(). Un init en vuelo que empezo antes no termina (H-48). */
let generation = 0;
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
  // Sin consentimiento no se cachea la promesa: si la persona acepta despues,
  // la siguiente llamada si inicializa.
  if (typeof window !== "undefined" && browserConsent() !== "all") return Promise.resolve(null);
  const started = generation;
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
      // Mientras cargaba el modulo la persona pudo retirar el consentimiento.
      if (started !== generation || browserConsent() !== "all") return null;
      if (loaded) {
        ph.opt_in_capturing();
        client = ph;
        return ph;
      }
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
        // Lighthouse Fase 6 (13 sep 2026): sin encuestas. Si no, posthog-js baja
        // surveys.js (34 KiB) en cada visita y no usamos encuestas de PostHog.
        disable_surveys: true,
        respect_dnt: true,
        persistence: "localStorage+cookie",
        // Un solo host: la cookie ph_* queda en creative.artostudio.ai y no en
        // .artostudio.ai, asi revokeAnalytics() la puede borrar.
        cross_subdomain_cookie: false,
        // Con opt-out, PostHog deja de guardar cookie y localStorage. Sin esto, tras retirar el
        // consentimiento el SDK volvia a escribir ph_* con el distinct_id despues de que
        // revokeAnalytics() lo borraba (prueba en produccion, 9 oct 2026).
        opt_out_persistence_by_default: true,
      });
      // La cookie asai_consent manda: si quedo un opt-out guardado de una visita en la
      // que se rechazo, al aceptar ahora se levanta.
      if (ph.has_opted_out_capturing()) ph.opt_in_capturing();
      loaded = ph;
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

/**
 * La persona retiro el consentimiento: se deja de capturar en esta carga y se borra
 * lo que PostHog guardo en el navegador (cookie ph_* y claves ph_* de localStorage).
 * Nunca lanza.
 */
export function revokeAnalytics(): void {
  generation += 1;
  try {
    // reset() primero: si va despues, borra el opt-out recien guardado y el SDK sigue
    // mandando $pageview y $pageleave (posthog-js lo advierte en reset()).
    loaded?.reset();
    loaded?.opt_out_capturing();
  } catch {
    /* nunca romper la UI por analitica */
  }
  client = null;
  initPromise = null;
  if (typeof document === "undefined") return;
  // Con opt_out_persistence_by_default el SDK ya borra ph_* al hacer opt-out; este barrido
  // queda como respaldo para cuando `loaded` es null (el init nunca termino).
  // Antes del 9 oct PostHog escribia su cookie en .artostudio.ai (cross_subdomain_cookie
  // por defecto); sin domain= no se borra, asi que se intenta en los dos.
  const labels = typeof location === "undefined" ? [] : location.hostname.split(".");
  const parent = labels.length > 1 ? `; domain=.${labels.slice(-2).join(".")}` : "";
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name?.startsWith("ph_")) continue;
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
    if (parent) document.cookie = `${name}=; path=/; max-age=0; samesite=lax${parent}`;
  }
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("ph_")) localStorage.removeItem(key);
  } catch {
    /* localStorage bloqueado */
  }
}

/** Solo para pruebas: vuelve al estado inicial del modulo. */
export function __resetAnalyticsForTests(): void {
  client = null;
  initPromise = null;
  loaded = null;
  generation = 0;
  warned = false;
}
