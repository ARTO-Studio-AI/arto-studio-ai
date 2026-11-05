import { createAdminClient } from "@/lib/supabase/admin";
import { envPromo } from "@/lib/promo-server";
import { isLive } from "./eleccion";
import { validatePromo, type PromoDef } from "./tipos";

/* Promociones del sitio, lado servidor (5 nov 2026). Solo se importa desde codigo de
 * servidor: usa service role. Mismo patron que src/lib/catalogo/efectivo.ts (PR 124).
 *
 * Lee la tabla promotions (migracion 0022) con cache en memoria de 60 s por instancia: un
 * cambio en /admin/promociones se ve al instante en la instancia que lo hizo y en menos de
 * un minuto en las demas, sin redeploy.
 *
 * Respaldo:
 *   - Base sin promos (cero filas): sale la de la variable STRIPE_PROMO_COUPON_24H, igual
 *     que en el PR 123. En cuanto hay una fila (aunque este apagada) la variable ya no cuenta.
 *   - Sin la tabla o con la base caida: el ultimo estado bueno de la instancia; si nunca leyo
 *     nada, la variable. El sitio sigue como hoy y /admin/promociones avisa en rojo.
 *   - Una fila que no pasa la validacion se ignora (no tumba el sitio) y se avisa en /admin. */

export const PROMOS_TTL_MS = 60_000;
/* Tras un error se reintenta antes, para no quedarse un minuto sin los cambios del admin. */
const RETRY_MS = 10_000;

export interface PromoRow {
  id: string;
  name: string;
  kind: string;
  percent_off: number | string | null;
  amount_off_cents: number | null;
  currency: string | null;
  duration_months: number | null;
  trial_days: number | null;
  stripe_coupon_id: string | null;
  clock_hours: number;
  audience: string;
  utm_campaign: string | null;
  starts_at: string;
  ends_at: string;
  enabled: boolean;
  copy: unknown;
  coupon_verified_at: string | null;
  coupon_snapshot: unknown;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export const PROMO_COLUMNS =
  "id, name, kind, percent_off, amount_off_cents, currency, duration_months, trial_days, stripe_coupon_id, clock_hours, audience, utm_campaign, starts_at, ends_at, enabled, copy, coupon_verified_at, coupon_snapshot, created_by, created_at, updated_by, updated_at";

export interface PromoIssue {
  id: string;
  message: string;
}

export interface PromoDbState {
  /** Promos de la base que pasan la validacion (prendidas y apagadas). */
  promos: PromoDef[];
  /** Filas en la base, incluidas las que no pasan la validacion. */
  rows: PromoRow[];
  issues: PromoIssue[];
  /** false si no se pudo leer la base (o no se intento). */
  ok: boolean;
  /** true si el error fue que la tabla no existe (falta la migracion 0022). */
  missing: boolean;
  error: string | null;
}

const EMPTY: PromoDbState = { promos: [], rows: [], issues: [], ok: false, missing: false, error: "sin leer" };

/** Fila de la base a PromoDef, con la misma validacion que /admin. */
export function rowToPromo(row: PromoRow): { promo: PromoDef | null; errors: string[] } {
  const { promo, errors } = validatePromo({
    id: row.id,
    name: row.name,
    kind: row.kind,
    percentOff: row.percent_off === null ? null : Number(row.percent_off),
    amountOffCents: row.amount_off_cents,
    currency: row.currency,
    months: row.duration_months,
    trialDays: row.trial_days,
    couponId: row.stripe_coupon_id,
    clockHours: row.clock_hours,
    audience: row.audience,
    utmCampaign: row.utm_campaign,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    copy: row.copy,
  });
  if (!promo) return { promo: null, errors };
  return {
    promo: { ...promo, startsAt: Date.parse(promo.startsAt), endsAt: Date.parse(promo.endsAt), enabled: row.enabled === true, source: "db" },
    errors: [],
  };
}

let cached: { state: PromoDbState; at: number; ttl: number } | null = null;
let lastGood: PromoDbState | null = null;
let inflight: Promise<PromoDbState> | null = null;

const isMissingTable = (err: { code?: string; message?: string }) =>
  err.code === "PGRST205" || err.code === "42P01" || /could not find the table|does not exist/i.test(err.message ?? "");

async function readState(): Promise<PromoDbState> {
  const { data, error } = await createAdminClient().from("promotions").select(PROMO_COLUMNS).order("starts_at", { ascending: false });
  if (error) {
    const e = new Error(`promotions: ${error.message}`) as Error & { missing?: boolean };
    e.missing = isMissingTable(error);
    throw e;
  }
  const rows = (data ?? []) as PromoRow[];
  const promos: PromoDef[] = [];
  const issues: PromoIssue[] = [];
  for (const row of rows) {
    const { promo, errors } = rowToPromo(row);
    if (promo) promos.push(promo);
    else issues.push({ id: String(row.id), message: `No pasa la validacion y no sale: ${errors.join(" ")}` });
  }
  return { promos, rows, issues, ok: true, missing: false, error: null };
}

/** Estado de la base, con cache corta. Nunca lanza. */
export async function loadPromoState({ fresh = false }: { fresh?: boolean } = {}): Promise<PromoDbState> {
  const now = Date.now();
  if (!fresh && cached && now - cached.at < cached.ttl) return cached.state;
  if (!fresh && inflight) return inflight;
  const run = (async () => {
    try {
      const state = await readState();
      lastGood = state;
      cached = { state, at: Date.now(), ttl: PROMOS_TTL_MS };
      return state;
    } catch (err) {
      const e = err as Error & { missing?: boolean };
      const missing = e.missing === true;
      console.error("[promos] no pude leer promotions, sigo con", lastGood ? "el ultimo estado bueno" : "la variable de respaldo", e.message);
      const state: PromoDbState = lastGood ? { ...lastGood, ok: false, missing, error: e.message } : { ...EMPTY, missing, error: e.message };
      // Si falta la tabla no tiene caso reintentar cada 10 s.
      cached = { state, at: Date.now(), ttl: missing ? PROMOS_TTL_MS : RETRY_MS };
      return state;
    } finally {
      inflight = null;
    }
  })();
  if (!fresh) inflight = run;
  return run;
}

export interface SitePromos {
  /** Las promos que cuentan para el sitio (de la base o la de la variable). */
  promos: PromoDef[];
  source: "db" | "env" | "none";
  /** true si no se pudo leer la base y nunca hubo lectura buena: se sirve la variable. */
  degraded: boolean;
}

/** De donde salen las promos ahora: la base si tiene filas, si no la variable. */
export function sitePromosFrom(state: PromoDbState, env: PromoDef | null): SitePromos {
  if (state.rows.length > 0) return { promos: state.promos, source: "db", degraded: false };
  const degraded = !state.ok;
  return env ? { promos: [env], source: "env", degraded } : { promos: [], source: "none", degraded };
}

/** Promos del sitio con cache de 60 s. Nunca lanza. */
export async function getSitePromos(opts: { fresh?: boolean } = {}): Promise<SitePromos> {
  return sitePromosFrom(await loadPromoState(opts), envPromo());
}

/** true si ahora hay al menos una promo viva en el sitio. */
export async function anyLivePromo(): Promise<boolean> {
  const now = Date.now();
  return (await getSitePromos()).promos.some((p) => isLive(p, now));
}

/** Lo llama /admin despues de escribir, para que esta instancia lo vea al instante. */
export function invalidatePromos(): void {
  cached = null;
}

/** Solo para pruebas. */
export function __resetPromoCache(): void {
  cached = null;
  lastGood = null;
  inflight = null;
}
