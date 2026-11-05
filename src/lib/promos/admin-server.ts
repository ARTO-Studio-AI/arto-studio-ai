import { createAdminClient } from "@/lib/supabase/admin";
import { collisions, type Collision } from "./eleccion";
import { invalidatePromos, loadPromoState, rowToPromo, type PromoDbState, type PromoRow } from "./estado";
import { verifyPromoInStripe, type CouponVerification } from "./stripe-cupon";
import { AUDIENCE_LABEL, validatePromo, type PromoDef, type PromoInput } from "./tipos";

/* Escrituras de /admin/promociones (5 nov 2026). Todo con service role; quien llama ya paso
 * el candado de admin (catalogAdmin en cada ruta: sesion de admin, nunca el Bearer).
 *
 *   - Guardar valida con validatePromo (la misma puerta que lee la base).
 *   - Prender (o guardar prendida) vuelve a leer el cupon en Stripe en ese momento y solo
 *     prende si coincide con lo configurado (stripe-cupon.ts). Nunca se confia en lo que
 *     diga el navegador. Si cambia algo del descuento, la verificacion anterior se borra.
 *   - Cada cambio deja fila en promotion_changes: quien, cuando, de que a que.
 *   - Si la base no responde o falta la tabla, no se escribe nada y se dice por que. */

export class PromoAdminError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly errors: string[] = [],
    readonly verification: CouponVerification | null = null,
  ) {
    super(message);
  }
}

export type ChangeAction = "create" | "update" | "enable" | "disable";

export interface ChangeRow {
  id: number;
  promotion_id: string;
  action: ChangeAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changed_by: string;
  created_at: string;
}

type Fetcher = Parameters<typeof verifyPromoInStripe>[1];

/* Campos que deciden el descuento: si cambia alguno, el cupon se vuelve a verificar. */
const DISCOUNT_FIELDS = ["kind", "percent_off", "amount_off_cents", "currency", "duration_months", "trial_days", "stripe_coupon_id"] as const;

/* Lo que no se compara en el registro: lo pone el servidor en cada escritura. */
const NOISE = new Set(["created_at", "created_by", "updated_at", "updated_by", "coupon_verified_at", "coupon_snapshot"]);

function inputToRow(p: PromoInput) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    percent_off: p.percentOff,
    amount_off_cents: p.amountOffCents,
    currency: p.currency,
    duration_months: p.months,
    trial_days: p.trialDays,
    stripe_coupon_id: p.couponId,
    clock_hours: p.clockHours,
    audience: p.audience,
    utm_campaign: p.utmCampaign,
    starts_at: p.startsAt,
    ends_at: p.endsAt,
    copy: p.copy,
  };
}

/** Campos que cambiaron entre dos versiones de la fila (sin las marcas del servidor). */
export function changedFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): { field: string; from: unknown; to: unknown }[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: { field: string; from: unknown; to: unknown }[] = [];
  for (const k of keys) {
    if (NOISE.has(k)) continue;
    const a = before?.[k] ?? null;
    const b = after?.[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: k, from: a, to: b });
  }
  return out;
}

async function freshState(): Promise<PromoDbState> {
  const state = await loadPromoState({ fresh: true });
  if (!state.ok) {
    throw new PromoAdminError(
      state.missing
        ? "Falta la tabla promotions (migración 0022). No se guardó nada; el sitio sigue con la promo de la variable."
        : "No pude leer la base; no se guardó nada. Intenta de nuevo en un momento.",
      503,
    );
  }
  return state;
}

async function writeLog(row: Omit<ChangeRow, "id" | "created_at">): Promise<void> {
  const { error } = await createAdminClient().from("promotion_changes").insert(row);
  if (error) throw new Error(`promotion_changes: ${error.message}`);
}

const strip = (row: Record<string, unknown> | null) => (row ? Object.fromEntries(Object.entries(row).filter(([k]) => !NOISE.has(k))) : null);

/** Avisos de choque que tocan a esta promo, ya con la promo nueva puesta. */
function collisionWarnings(promos: PromoDef[], id: string): string[] {
  const byId = new Map(promos.map((p) => [p.id, p]));
  return collisions(promos)
    .filter((c: Collision) => c.ids.includes(id))
    .map((c) => {
      const other = c.ids.find((x) => x !== id)!;
      const p = byId.get(id)!;
      const publico = p.audience === "utm" ? `campaña «${p.utmCampaign}»` : AUDIENCE_LABEL[p.audience].toLowerCase();
      return `Choca con «${other}» (mismo público: ${publico}, fechas encimadas). Mientras se enciman sale «${c.winner}», la de inicio más reciente.`;
    });
}

function withReplaced(state: PromoDbState, row: PromoRow): PromoDef[] {
  const { promo } = rowToPromo(row);
  const rest = state.promos.filter((p) => p.id !== row.id);
  return promo ? [...rest, promo] : rest;
}

/** Ultimos cambios para la pagina. Si la tabla no esta, lista vacia y el error. */
export async function recentChanges(limit = 50): Promise<{ rows: ChangeRow[]; error: string | null }> {
  try {
    const { data, error } = await createAdminClient()
      .from("promotion_changes")
      .select("id, promotion_id, action, before, after, changed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as ChangeRow[], error: null };
  } catch (err) {
    return { rows: [], error: (err as Error).message };
  }
}

/** Solo verifica (boton «Verificar cupón» del formulario). No escribe nada. */
export async function verifyOnly(raw: unknown, fetcher?: Fetcher): Promise<CouponVerification> {
  const { promo, errors } = validatePromo(raw);
  if (!promo) throw new PromoAdminError("Revisa el formulario", 400, errors);
  return verifyPromoInStripe(promo, fetcher);
}

/**
 * Crea o edita una promo. enable = como queda despues de guardar (prendida o apagada).
 * Prendida exige que el cupon coincida en Stripe en este momento.
 */
export async function savePromo(input: { raw: unknown; enable: boolean; isNew: boolean; actor: string; fetcher?: Fetcher }) {
  const { promo, errors } = validatePromo(input.raw);
  if (!promo) throw new PromoAdminError("No se guardó nada", 400, errors);
  const state = await freshState();
  const before = state.rows.find((r) => r.id === promo.id) ?? null;
  if (input.isNew && before) throw new PromoAdminError(`Ya hay una promo con el id «${promo.id}». Usa otro id o edita esa.`, 409);
  if (!input.isNew && !before) throw new PromoAdminError(`No hay ninguna promo con el id «${promo.id}».`, 404);

  const fields = inputToRow(promo);
  // percent_off llega de Postgres como numeric (a veces texto): se compara como numero.
  const norm = (k: string, v: unknown) => (v === undefined || v === null ? null : k === "percent_off" ? Number(v) : v);
  const discountChanged = !before || DISCOUNT_FIELDS.some((k) => norm(k, before[k]) !== norm(k, fields[k]));
  let verifiedAt: string | null = discountChanged ? null : (before?.coupon_verified_at ?? null);
  let snapshot: unknown = discountChanged ? null : (before?.coupon_snapshot ?? null);
  let verification: CouponVerification | null = null;
  if (input.enable) {
    verification = await verifyPromoInStripe(promo, input.fetcher);
    if (!verification.ok) throw new PromoAdminError("El cupón no coincide con lo configurado; no se guardó nada.", 409, [], verification);
    verifiedAt = new Date().toISOString();
    snapshot = verification.snapshot;
  }

  const now = new Date().toISOString();
  const row = {
    ...fields,
    enabled: input.enable,
    coupon_verified_at: verifiedAt,
    coupon_snapshot: snapshot,
    updated_by: input.actor,
    updated_at: now,
  };
  const sb = createAdminClient();
  if (before) {
    const { error } = await sb.from("promotions").update(row).eq("id", promo.id);
    if (error) throw new Error(`promotions: ${error.message}`);
  } else {
    const { error } = await sb.from("promotions").insert({ ...row, created_by: input.actor, created_at: now });
    if (error) throw new Error(`promotions: ${error.message}`);
  }
  const after = { ...(before ?? {}), ...row } as PromoRow;
  await writeLog({ promotion_id: promo.id, action: before ? "update" : "create", before: strip(before as unknown as Record<string, unknown>), after: strip(after as unknown as Record<string, unknown>), changed_by: input.actor });
  invalidatePromos();
  return { id: promo.id, created: !before, enabled: input.enable, verification, warnings: input.enable ? collisionWarnings(withReplaced(state, after), promo.id) : [] };
}

/** Prende o apaga una promo. Prender vuelve a verificar el cupon en Stripe. */
export async function setPromoEnabled(input: { id: unknown; enabled: unknown; actor: string; fetcher?: Fetcher }) {
  if (typeof input.id !== "string" || !input.id) throw new PromoAdminError("Falta el id");
  if (typeof input.enabled !== "boolean") throw new PromoAdminError("enabled va en true o false");
  const state = await freshState();
  const before = state.rows.find((r) => r.id === input.id);
  if (!before) throw new PromoAdminError(`No hay ninguna promo con el id «${input.id}».`, 404);
  if (before.enabled === input.enabled) return { id: input.id, changed: false, enabled: input.enabled, verification: null, warnings: [] as string[] };

  const now = new Date().toISOString();
  let patch: Record<string, unknown> = { enabled: input.enabled, updated_by: input.actor, updated_at: now };
  let verification: CouponVerification | null = null;
  if (input.enabled) {
    const { promo, errors } = rowToPromo(before);
    if (!promo) throw new PromoAdminError("La promo guardada no pasa la validación; edítala antes de prenderla.", 409, errors);
    verification = await verifyPromoInStripe({ ...promo, endsAt: new Date(promo.endsAt).toISOString() }, input.fetcher);
    if (!verification.ok) throw new PromoAdminError("El cupón no coincide con lo configurado; la promo sigue apagada.", 409, [], verification);
    patch = { ...patch, coupon_verified_at: now, coupon_snapshot: verification.snapshot };
  }
  const { error } = await createAdminClient().from("promotions").update(patch).eq("id", input.id);
  if (error) throw new Error(`promotions: ${error.message}`);
  const after = { ...before, ...patch } as PromoRow;
  await writeLog({
    promotion_id: input.id,
    action: input.enabled ? "enable" : "disable",
    before: { enabled: before.enabled },
    after: { enabled: input.enabled },
    changed_by: input.actor,
  });
  invalidatePromos();
  return { id: input.id, changed: true, enabled: input.enabled, verification, warnings: input.enabled ? collisionWarnings(withReplaced(state, after), input.id) : [] };
}
