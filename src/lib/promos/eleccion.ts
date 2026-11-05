import type { PromoAudience, PromoDef } from "./tipos";

/* Cual promo le toca a quien (5 nov 2026). Logica pura, sin base ni red.
 *
 * Reglas (fichas de Victor del 5 nov 2026):
 *   - Una promo esta viva si esta prendida y ahora cae entre su inicio y su fin.
 *   - Solo una promo viva a la vez por publico. Si dos chocan, gana la de inicio mas
 *     reciente (empate: el id mayor, para que sea estable) y /admin avisa.
 *   - Publico: «sin cuenta», «cuenta gratis que nunca tuvo Pro» o «llega con cierto
 *     utm_campaign». Cada utm_campaign es un publico distinto.
 *   - Si a una persona le tocan dos (por ejemplo, llego con la campana y no tiene cuenta),
 *     gana la de la campana: es la mas especifica.
 *   - Quien tiene o tuvo suscripcion no recibe ninguna (lo vuelve a revisar el checkout).
 *   - El reloj de cada persona dura clockHours desde su primera visita, pero nunca pasa del
 *     fin de la promo: la promo se apaga sola para todos a su hora. */

export function isLive(p: PromoDef, now: number): boolean {
  return p.enabled && p.startsAt <= now && now < p.endsAt;
}

export const normCampaign = (c: string | null | undefined): string => (c ?? "").trim().toLowerCase();

/** Llave del publico: cada utm_campaign cuenta como publico propio. */
export function audienceKey(p: Pick<PromoDef, "audience" | "utmCampaign">): string {
  return p.audience === "utm" ? `utm:${normCampaign(p.utmCampaign)}` : p.audience;
}

const beats = (a: PromoDef, b: PromoDef) => a.startsAt > b.startsAt || (a.startsAt === b.startsAt && a.id > b.id);

/** La promo viva que gana en cada publico. */
export function winners(promos: readonly PromoDef[], now: number): Map<string, PromoDef> {
  const out = new Map<string, PromoDef>();
  for (const p of promos) {
    if (!isLive(p, now)) continue;
    const k = audienceKey(p);
    const cur = out.get(k);
    if (!cur || beats(p, cur)) out.set(k, p);
  }
  return out;
}

/** Las promos vivas que ganan su publico ahora (las tapadas no entran). */
export function livePromos(promos: readonly PromoDef[], now: number): PromoDef[] {
  return [...winners(promos, now).values()];
}

export interface Collision {
  audience: string;
  /** Las promos prendidas cuyas fechas se enciman en ese publico. */
  ids: string[];
  /** La que sale mientras se enciman: la de inicio mas reciente. */
  winner: string;
}

/** Choques entre promos prendidas del mismo publico con fechas encimadas. Para /admin. */
export function collisions(promos: readonly PromoDef[]): Collision[] {
  const on = promos.filter((p) => p.enabled);
  const out: Collision[] = [];
  const seen = new Set<string>();
  for (const a of on) {
    for (const b of on) {
      if (a.id >= b.id || audienceKey(a) !== audienceKey(b)) continue;
      if (!(a.startsAt < b.endsAt && b.startsAt < a.endsAt)) continue;
      const key = `${a.id}|${b.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ audience: audienceKey(a), ids: [a.id, b.id], winner: beats(a, b) ? a.id : b.id });
    }
  }
  return out;
}

export interface Visitor {
  /** Trae cookie de sesion de Supabase. */
  signedIn: boolean;
  /** Con sesion: true si es cuenta gratis que nunca tuvo suscripcion. null si no se sabe. */
  neverPro: boolean | null;
  /** utm_campaign de la primera visita (cookie asai_utm), si hay. */
  utmCampaign: string | null;
}

/** La promo que le toca a esta persona ahora, o null. */
export function promoForVisitor(promos: readonly PromoDef[], v: Visitor, now: number): PromoDef | null {
  if (v.signedIn && v.neverPro !== true) return null;
  const w = winners(promos, now);
  const campaign = normCampaign(v.utmCampaign);
  if (campaign) {
    const byUtm = w.get(`utm:${campaign}`);
    if (byUtm) return byUtm;
  }
  const audience: PromoAudience = v.signedIn ? "free_never_pro" : "anon";
  return w.get(audience) ?? null;
}

/** true si alguna promo viva necesita saber si la sesion es de una cuenta que nunca tuvo Pro. */
export function needsAccountCheck(promos: readonly PromoDef[], now: number): boolean {
  return livePromos(promos, now).some((p) => p.audience === "free_never_pro" || p.audience === "utm");
}

export function needsCampaign(promos: readonly PromoDef[], now: number): boolean {
  return livePromos(promos, now).some((p) => p.audience === "utm");
}

export interface ClockWindow {
  active: boolean;
  expired: boolean;
  endsAt: number | null;
}

/** Reloj de una persona: clockHours desde su inicio, cortado al fin de la promo. */
export function clockWindow(p: Pick<PromoDef, "clockHours" | "endsAt">, start: number | null, now: number): ClockWindow {
  if (start === null) return { active: false, expired: false, endsAt: null };
  const endsAt = Math.min(start + p.clockHours * 3_600_000, p.endsAt);
  return { active: now < endsAt, expired: now >= endsAt, endsAt };
}

/**
 * De los relojes que trae la cookie, el que sigue corriendo para una promo viva (si hay
 * varios, el de inicio mas reciente). Asi lo que la persona vio con reloj es lo que se
 * cobra, aunque despues cambie de publico (por ejemplo, al crear su cuenta). Cuenta
 * cualquier promo viva, aunque otra la haya tapado despues en su publico: a quien ya le
 * corria el reloj se le respeta hasta que vence, se apaga o llega el fin de la promo.
 */
export function runningClock(
  promos: readonly PromoDef[],
  starts: ReadonlyMap<string, number>,
  now: number,
): { promo: PromoDef; start: number; window: ClockWindow } | null {
  const live = new Map(promos.filter((p) => isLive(p, now)).map((p) => [p.id, p]));
  let best: { promo: PromoDef; start: number; window: ClockWindow } | null = null;
  for (const [id, start] of starts) {
    const promo = live.get(id);
    if (!promo) continue;
    const window = clockWindow(promo, start, now);
    if (!window.active) continue;
    if (!best || start > best.start) best = { promo, start, window };
  }
  return best;
}
