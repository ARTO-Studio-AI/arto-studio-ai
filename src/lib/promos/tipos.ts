/* Promociones administrables (decision de Victor, 5 nov 2026: «Estas promos van a ser algo
 * usual y vamos a empezar a poner cada vez mas. Hay que disenar un sistema para poderlas
 * levantar y quitar rapidamente, desde el backend»).
 *
 * Este modulo es logica pura y lo leen el navegador, el servidor y /admin: tipos, validacion
 * de lo que se guarda y como se pinta el precio. No importa nada de Node ni de Next.
 *
 * Una promo es:
 *   - Tipo: porcentaje o monto fijo (con un cupon que Victor crea en Stripe y aqui solo se
 *     pega su id), o dias de prueba gratis (subscription_data[trial_period_days], sin cupon).
 *   - Cuanto y cuanto dura: valor, meses que aplica y horas del reloj de cada visitante.
 *   - Textos ES y EN: titulo, subtitulo, boton e insignia de /pricing.
 *   - A quien le sale: sin cuenta, cuenta gratis que nunca tuvo Pro, o quien llego con cierto
 *     utm_campaign (cookie asai_utm, src/lib/attribution.ts).
 *   - Fechas de inicio y fin: se prende y se apaga sola. Ademas un interruptor (enabled).
 * La eleccion de cual le toca a quien vive en eleccion.ts. */

export const PROMO_KINDS = ["percent", "amount", "trial"] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

export const PROMO_AUDIENCES = ["anon", "free_never_pro", "utm"] as const;
export type PromoAudience = (typeof PROMO_AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<PromoAudience, string> = {
  anon: "Sin cuenta",
  free_never_pro: "Cuenta gratis que nunca tuvo Pro",
  utm: "Llega con una campaña (utm_campaign)",
};

export const KIND_LABEL: Record<PromoKind, string> = {
  percent: "Porcentaje (cupón)",
  amount: "Monto fijo (cupón)",
  trial: "Días de prueba gratis",
};

/* La promo que venia en la variable STRIPE_PROMO_COUPON_24H (PR 123). Las cookies viejas
 * (formato v1, sin id) cuentan como de esta promo, y si se pasa a la base conserva este id
 * para que nadie estrene reloj por el cambio. */
export const LEGACY_PROMO_ID = "pro-50-24h";

/* Precio de lista de Pro que se pinta tachado. El cobro real es el price de Stripe. */
export const PRO_PRICE_USD = 9;

export const PROMO_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const COUPON_ID_RE = /^[A-Za-z0-9_-]{1,200}$/;

export interface PromoCopy {
  title: string;
  subtitle: string;
  cta: string;
  badge: string;
}

export const COPY_FIELDS: { key: keyof PromoCopy; label: string; max: number }[] = [
  { key: "title", label: "Título", max: 80 },
  { key: "subtitle", label: "Subtítulo", max: 200 },
  { key: "cta", label: "Botón", max: 40 },
  { key: "badge", label: "Insignia de pricing", max: 40 },
];

/** Promo ya validada. Fechas en ms. */
export interface PromoDef {
  id: string;
  name: string;
  kind: PromoKind;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  /** Meses que aplica el descuento (1 = solo el primer pago). null en prueba gratis. */
  months: number | null;
  trialDays: number | null;
  couponId: string | null;
  clockHours: number;
  audience: PromoAudience;
  utmCampaign: string | null;
  startsAt: number;
  endsAt: number;
  enabled: boolean;
  copy: { es: PromoCopy; en: PromoCopy };
  /** "env" = la de STRIPE_PROMO_COUPON_24H, solo mientras la base no tiene promos. */
  source: "db" | "env";
}

/** Lo que el navegador recibe de la promo que le toca (en su idioma). */
export interface PromoOffer {
  id: string;
  kind: PromoKind;
  percentOff: number | null;
  amountOffCents: number | null;
  months: number | null;
  trialDays: number | null;
  clockHours: number;
  audience: PromoAudience;
  copy: PromoCopy;
}

export function offerOf(p: PromoDef, locale: "es" | "en"): PromoOffer {
  return {
    id: p.id,
    kind: p.kind,
    percentOff: p.percentOff,
    amountOffCents: p.amountOffCents,
    months: p.months,
    trialDays: p.trialDays,
    clockHours: p.clockHours,
    audience: p.audience,
    copy: p.copy[locale] ?? p.copy.es,
  };
}

/* ------------------------------------------------------------ validacion */

/* Reglas de escritura del proyecto (CLAUDE.md): sin guion largo y sin estas palabras. */
const BANNED = [
  "leverage",
  "empower",
  "revolutionize",
  "seamless",
  "robust",
  "holistic",
  "cutting-edge",
  "next-generation",
  "ecosystem",
  "disruptive",
  "synergy",
  "scalable",
  "optimize",
  "elevate",
  "delve",
  "foster",
  "paradigm shift",
  "game-changer",
  "actionable insights",
];

/** Problemas de estilo de un texto: guion largo o palabra prohibida. */
export function copyProblems(text: string): string[] {
  const out: string[] = [];
  if (text.includes("\u2014")) out.push("lleva guion largo");
  const lower = text.toLowerCase();
  for (const w of BANNED) {
    const re = new RegExp(`(^|[^a-z])${w.replace(/[-\s]/g, "[-\\s]")}([^a-z]|$)`);
    if (re.test(lower)) out.push(`usa la palabra «${w}»`);
  }
  return out;
}

/** Lo que llega del formulario de /admin. Las fechas, en ISO. */
export interface PromoInput {
  id: string;
  name: string;
  kind: PromoKind;
  percentOff: number | null;
  amountOffCents: number | null;
  currency: string | null;
  months: number | null;
  trialDays: number | null;
  couponId: string | null;
  clockHours: number;
  audience: PromoAudience;
  utmCampaign: string | null;
  startsAt: string;
  endsAt: string;
  copy: { es: PromoCopy; en: PromoCopy };
}

const str = (v: unknown): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "");
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

/**
 * Valida y normaliza una promo que viene de /admin o de una fila de la base. Devuelve la
 * promo limpia (con los campos que no aplican a su tipo en null) o la lista de errores.
 * Es la unica puerta: la usan el formulario (aviso inmediato), el servidor antes de guardar
 * y el lector de la base (una fila rota se ignora y se avisa, no tumba el sitio).
 */
export function validatePromo(raw: unknown): { promo: PromoInput | null; errors: string[] } {
  const errors: string[] = [];
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const id = str(r.id);
  if (!PROMO_ID_RE.test(id) || id.length < 3 || id.length > 60) errors.push("El id va en minúsculas, números y guiones (3 a 60), por ejemplo «buen-fin-30».");
  const name = str(r.name);
  if (!name || name.length > 120) errors.push("Ponle un nombre interno (hasta 120 caracteres).");

  const kind = r.kind as PromoKind;
  if (!PROMO_KINDS.includes(kind)) errors.push("Tipo inválido: porcentaje, monto fijo o días de prueba.");

  let percentOff: number | null = null;
  let amountOffCents: number | null = null;
  let currency: string | null = null;
  let months: number | null = null;
  let trialDays: number | null = null;
  let couponId: string | null = null;

  if (kind === "percent" || kind === "amount") {
    couponId = str(r.couponId) || null;
    if (!couponId || !COUPON_ID_RE.test(couponId)) errors.push("Pega el id del cupón de Stripe (letras, números, _ o -).");
    months = num(r.months);
    if (months === null || !Number.isInteger(months) || months < 1 || months > 36) errors.push("Meses que aplica: un entero de 1 a 36 (1 = solo el primer pago).");
  }
  if (kind === "percent") {
    percentOff = num(r.percentOff);
    if (percentOff === null || percentOff <= 0 || percentOff > 100 || Math.abs(Math.round(percentOff * 100) - percentOff * 100) > 1e-6) {
      errors.push("Porcentaje: de 0.01 a 100, con hasta dos decimales.");
    }
  }
  if (kind === "amount") {
    amountOffCents = num(r.amountOffCents);
    if (amountOffCents === null || !Number.isInteger(amountOffCents) || amountOffCents < 1 || amountOffCents > 1_000_000) {
      errors.push("Monto: en centavos, entero y mayor que cero (450 = 4.50).");
    }
    currency = str(r.currency).toLowerCase() || null;
    if (!currency || !/^[a-z]{3}$/.test(currency)) errors.push("Moneda: código de 3 letras, por ejemplo «usd».");
  }
  if (kind === "trial") {
    trialDays = num(r.trialDays);
    if (trialDays === null || !Number.isInteger(trialDays) || trialDays < 1 || trialDays > 730) errors.push("Días de prueba: un entero de 1 a 730.");
  }

  const clockHours = num(r.clockHours);
  if (clockHours === null || !Number.isInteger(clockHours) || clockHours < 1 || clockHours > 720) errors.push("Horas del reloj: un entero de 1 a 720.");

  const audience = r.audience as PromoAudience;
  if (!PROMO_AUDIENCES.includes(audience)) errors.push("Público inválido.");
  let utmCampaign: string | null = null;
  if (audience === "utm") {
    utmCampaign = str(r.utmCampaign) || null;
    if (!utmCampaign || utmCampaign.length > 200) errors.push("Escribe el utm_campaign exacto de la campaña.");
  }

  const startsAt = str(r.startsAt);
  const endsAt = str(r.endsAt);
  const s = Date.parse(startsAt);
  const e = Date.parse(endsAt);
  if (!Number.isFinite(s)) errors.push("Fecha de inicio inválida.");
  if (!Number.isFinite(e)) errors.push("Fecha de fin inválida.");
  if (Number.isFinite(s) && Number.isFinite(e) && e <= s) errors.push("La fecha de fin va después de la de inicio.");

  const copyRaw = (r.copy && typeof r.copy === "object" ? r.copy : {}) as Record<string, unknown>;
  const copy = { es: {} as PromoCopy, en: {} as PromoCopy };
  for (const lang of ["es", "en"] as const) {
    const c = (copyRaw[lang] && typeof copyRaw[lang] === "object" ? copyRaw[lang] : {}) as Record<string, unknown>;
    for (const f of COPY_FIELDS) {
      const v = str(c[f.key]);
      copy[lang][f.key] = v;
      const where = `${f.label} ${lang.toUpperCase()}`;
      if (!v) errors.push(`Falta: ${where}.`);
      else if (v.length > f.max) errors.push(`${where}: máximo ${f.max} caracteres.`);
      for (const p of copyProblems(v)) errors.push(`${where} ${p}.`);
    }
  }

  if (errors.length) return { promo: null, errors };
  return {
    promo: {
      id,
      name,
      kind,
      percentOff,
      amountOffCents,
      currency,
      months,
      trialDays,
      couponId,
      clockHours: clockHours!,
      audience,
      utmCampaign,
      startsAt: new Date(s).toISOString(),
      endsAt: new Date(e).toISOString(),
      copy,
    },
    errors: [],
  };
}

/* ------------------------------------------------------------ como se pinta */

export function usd(n: number): string {
  const r = Math.round(n * 100) / 100;
  return `$${r % 1 === 0 ? r : r.toFixed(2)}`;
}

/** Textos de la parte del diccionario que se usan para el precio (dict.promo). */
export interface PriceStrings {
  first_month: string;
  first_months: string;
  trial_days: string;
  free_label: string;
  then: string;
  then_trial: string;
  modal_eyebrow: string;
  modal_eyebrow_one: string;
}

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

export interface PriceView {
  /** Precio de lista tachado; null en prueba gratis. */
  strike: string | null;
  /** Lo que se paga (o «Gratis»). */
  now: string;
  /** «el primer mes», «los primeros 3 meses», «7 días». */
  unit: string;
  /** Letra pequena: que pasa despues. */
  then: string;
  /** «Solo 24 horas». */
  eyebrow: string;
}

/** Precio con descuento para la barra, la ventana y /pricing. Nunca negativo. */
export function priceView(offer: Pick<PromoOffer, "kind" | "percentOff" | "amountOffCents" | "months" | "trialDays" | "clockHours">, t: PriceStrings, base = PRO_PRICE_USD): PriceView {
  const eyebrow = offer.clockHours === 1 ? t.modal_eyebrow_one : fill(t.modal_eyebrow, { h: offer.clockHours });
  if (offer.kind === "trial") {
    return { strike: null, now: t.free_label, unit: fill(t.trial_days, { n: offer.trialDays ?? 0 }), then: t.then_trial, eyebrow };
  }
  const off = offer.kind === "percent" ? base * ((offer.percentOff ?? 0) / 100) : (offer.amountOffCents ?? 0) / 100;
  const months = offer.months ?? 1;
  return {
    strike: usd(base),
    now: usd(Math.max(0, base - off)),
    unit: months === 1 ? t.first_month : fill(t.first_months, { n: months }),
    then: t.then,
    eyebrow,
  };
}

/** Resumen de una linea para /admin: «50% el primer mes», «$2 USD 3 meses», «7 días gratis». */
export function discountSummary(p: Pick<PromoDef, "kind" | "percentOff" | "amountOffCents" | "currency" | "months" | "trialDays">): string {
  if (p.kind === "trial") return `${p.trialDays} días de prueba gratis`;
  const v = p.kind === "percent" ? `${p.percentOff}%` : `${((p.amountOffCents ?? 0) / 100).toFixed(2)} ${(p.currency ?? "").toUpperCase()}`;
  return `${v} ${p.months === 1 ? "el primer pago" : `durante ${p.months} meses`}`;
}
