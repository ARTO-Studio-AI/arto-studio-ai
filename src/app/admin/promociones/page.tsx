import { getDictionary } from "@/i18n/dictionaries";
import { envPromo, promoSigningReady } from "@/lib/promo-server";
import { changedFields, recentChanges } from "@/lib/promos/admin-server";
import { collisions, isLive, winners, audienceKey } from "@/lib/promos/eleccion";
import { loadPromoState, sitePromosFrom } from "@/lib/promos/estado";
import { AUDIENCE_LABEL, discountSummary, type PromoDef, type PromoInput } from "@/lib/promos/tipos";
import { fecha, guardAdmin, PageHead } from "../_kit";
import PromosClient, { type ChangeView, type PromoView } from "./PromosClient";

/* /admin/promociones (5 nov 2026). Levantar y quitar promos de Pro sin tocar codigo: crear,
 * editar, prender, apagar y ver quien cambio que. Ver src/lib/promos/ y la decision en
 * docs/DECISIONES.md («Promociones administrables»). */

export const dynamic = "force-dynamic";

type Status = PromoView["status"];

function statusOf(p: PromoDef, now: number, win: Map<string, PromoDef>): { status: Status; coveredBy: string | null } {
  if (!p.enabled) return { status: "off", coveredBy: null };
  if (now < p.startsAt) return { status: "scheduled", coveredBy: null };
  if (now >= p.endsAt) return { status: "ended", coveredBy: null };
  const w = win.get(audienceKey(p));
  return w && w.id !== p.id ? { status: "covered", coveredBy: w.id } : { status: "live", coveredBy: null };
}

function envDraft(p: PromoDef): PromoInput {
  const now = Date.now();
  return {
    id: p.id,
    name: "Primer mes de Pro al 50% por 24 h",
    kind: p.kind,
    percentOff: p.percentOff,
    amountOffCents: null,
    currency: null,
    months: p.months,
    trialDays: null,
    couponId: p.couponId,
    clockHours: p.clockHours,
    audience: p.audience,
    utmCampaign: null,
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + 30 * 24 * 3_600_000).toISOString(),
    copy: p.copy,
  };
}

const short = (v: unknown): string => {
  if (v === null || v === undefined) return "vacío";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 140 ? `${s.slice(0, 137)}...` : s;
};

/* Todo lo que pinta la pagina, leido en este momento (fuera del componente: Date.now). */
async function loadView() {
  const now = Date.now();
  const state = await loadPromoState({ fresh: true });
  const env = envPromo();
  const site = sitePromosFrom(state, env);
  const log = state.ok ? await recentChanges(50) : { rows: [], error: null };
  const win = winners(state.promos, now);
  const byId = new Map(state.rows.map((r) => [r.id, r]));

  const rows: PromoView[] = state.promos.map((p) => {
    const row = byId.get(p.id)!;
    const st = statusOf(p, now, win);
    return {
      promo: { ...p, startsAt: new Date(p.startsAt).toISOString(), endsAt: new Date(p.endsAt).toISOString() },
      enabled: p.enabled,
      status: st.status,
      coveredBy: st.coveredBy,
      audienceText: p.audience === "utm" ? `Campaña «${p.utmCampaign}»` : AUDIENCE_LABEL[p.audience],
      discountText: discountSummary(p),
      startsText: fecha(new Date(p.startsAt).toISOString()),
      endsText: fecha(new Date(p.endsAt).toISOString()),
      verifiedText: row.coupon_verified_at ? fecha(row.coupon_verified_at) : null,
      updatedText: `${fecha(row.updated_at)} · ${row.updated_by}`,
    };
  });

  const changes: ChangeView[] = log.rows.map((c) => ({
    id: c.id,
    when: fecha(c.created_at),
    who: c.changed_by,
    promo: c.promotion_id,
    action: c.action,
    fields: changedFields(c.before, c.after).map((f) => ({ field: f.field, from: short(f.from), to: short(f.to) })),
  }));

  const clashes = collisions(state.promos).map((c) => ({ ...c, live: c.ids.every((id) => { const p = state.promos.find((x) => x.id === id); return p ? isLive(p, now) : false; }) }));
  return { state, env, site, log, rows, changes, clashes, draft: state.ok && state.rows.length === 0 && env ? envDraft(env) : null };
}

export default async function Promociones() {
  await guardAdmin();
  const { state, env, site, log, rows, changes, clashes, draft } = await loadView();
  const dict = { es: getDictionary("es"), en: getDictionary("en") };

  return (
    <div>
      <PageHead eyebrow="Ventas" title="Promociones" />
      <p className="-mt-4 mb-6 max-w-3xl text-sm text-zinc-600">
        Levanta y quita promos de Pro sin tocar código. El cupón se crea en Stripe y aquí solo se pega su id: antes de prender, el
        servidor lo lee en Stripe y revisa que coincida con lo que configuraste. Solo sale una promo a la vez por público; si dos
        chocan, gana la de inicio más reciente. Los cambios se ven en el sitio en menos de un minuto. Fechas en hora de Ciudad de
        México.
      </p>

      {!state.ok && (
        <div role="alert" className="mb-5 rounded-[var(--radius-lg)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">
            {state.missing ? "Falta la tabla promotions (migración 0022)." : "No pude leer la base de promociones."}
          </p>
          <p className="mt-1">
            {site.source === "env"
              ? "El sitio sigue con la promo de la variable STRIPE_PROMO_COUPON_24H, igual que antes."
              : site.source === "db"
                ? "El sitio sigue con el último estado bueno que leyó."
                : "El sitio no muestra ninguna promo."}{" "}
            Mientras tanto no se puede guardar nada aquí.
          </p>
          {state.error && <p className="mt-1 font-mono text-xs">{state.error}</p>}
        </div>
      )}

      {!promoSigningReady() && (
        <div role="alert" className="mb-5 rounded-[var(--radius-lg)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Falta el secreto de firma (PROMO_SIGNING_SECRET o ARTO_API_KEY_SALT): sin él no sale ninguna promo.
        </div>
      )}

      {state.ok && state.rows.length === 0 && env && (
        <div className="mb-5 rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Hoy sale la promo de la variable STRIPE_PROMO_COUPON_24H (50% el primer mes, reloj de 24 h, sin cuenta).</p>
          <p className="mt-1">
            En cuanto guardes la primera promo aquí, la variable deja de usarse, aunque la guardes apagada. Para no dejar hueco, pásala a
            la base con el botón y guárdala prendida: conserva su id, así nadie estrena reloj por el cambio.
          </p>
        </div>
      )}

      {state.issues.length > 0 && (
        <div role="alert" className="mb-5 rounded-[var(--radius-lg)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">Promos en la base que no salen porque no pasan la validación:</p>
          <ul className="mt-1 list-disc pl-5">
            {state.issues.map((i) => (
              <li key={i.id}>
                <span className="font-mono">{i.id}</span>: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {clashes.length > 0 && (
        <div role="alert" className="mb-5 rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Promos prendidas que chocan (mismo público y fechas encimadas):</p>
          <ul className="mt-1 list-disc pl-5">
            {clashes.map((c) => (
              <li key={c.ids.join("|")}>
                <span className="font-mono">{c.ids.join(" y ")}</span>: mientras se enciman sale <span className="font-mono">{c.winner}</span>, la de inicio más
                reciente{c.live ? " (pasa ahora)" : ""}.
              </li>
            ))}
          </ul>
        </div>
      )}

      <PromosClient
        rows={rows}
        changes={changes}
        changesError={log.error}
        canWrite={state.ok}
        envDraft={draft}
        preview={{
          es: { promo: dict.es.promo, features: dict.es.pricing.tier_pro_features },
          en: { promo: dict.en.promo, features: dict.en.pricing.tier_pro_features },
        }}
      />
    </div>
  );
}
