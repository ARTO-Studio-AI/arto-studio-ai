"use client";

import { useEffect, useSyncExternalStore } from "react";
import { toPromoState, type PromoApiResponse, type PromoState } from "@/lib/promo";

/* Estado de la promo en el navegador (5 nov 2026). Un solo POST /api/promo por carga de
 * pagina, compartido por la barra, la ventana y /pricing. El servidor decide que promo
 * toca, sus textos y su reloj; aqui solo se guarda su respuesta y se cuenta hacia atras. */

let state: PromoState | null = null;
let requested = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot(): PromoState | null {
  return state;
}

function getServerSnapshot(): PromoState | null {
  return null;
}

function loadPromo(locale: string): void {
  if (requested) return;
  requested = true;
  fetch("/api/promo", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  })
    .then((r) => (r.ok ? (r.json() as Promise<PromoApiResponse>) : null))
    .then((data) => {
      state = toPromoState(data, Date.now());
      emit();
    })
    .catch(() => {
      /* sin red la promo no se pinta: mejor nada que un reloj inventado */
    });
}

/** Estado actual sin suscribirse (para un clic). */
export function currentPromo(): PromoState | null {
  return state;
}

/** Marca la promo como vencida cuando el reloj llega a cero en esta carga. */
export function markPromoExpired(): void {
  if (!state?.active) return;
  state = { active: false, expired: true, endsAt: null, promoId: state.promoId, offer: null };
  emit();
}

/** Promo del visitante. Con enabled=false no se pregunta al servidor y devuelve null. */
export function usePromo(enabled: boolean, locale: string): PromoState | null {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (enabled) loadPromo(locale);
  }, [enabled, locale]);
  return enabled ? s : null;
}

/* Un solo intervalo de 1 s para todos los relojes de la pagina. */
const tickListeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribeTick(onChange: () => void): () => void {
  tickListeners.add(onChange);
  if (!timer) timer = setInterval(() => tickListeners.forEach((l) => l()), 1000);
  return () => {
    tickListeners.delete(onChange);
    if (tickListeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function nowSecond(): number {
  return Math.floor(Date.now() / 1000);
}

/** Milisegundos que faltan, redondeados al segundo. null sin fecha de fin. */
export function useRemaining(endsAt: number | null): number | null {
  const sec = useSyncExternalStore(subscribeTick, nowSecond, () => 0);
  const remaining = endsAt === null || sec === 0 ? null : Math.max(0, endsAt - sec * 1000);
  useEffect(() => {
    if (remaining === 0) markPromoExpired();
  }, [remaining]);
  return remaining;
}
