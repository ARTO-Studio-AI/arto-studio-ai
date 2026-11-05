"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { BarCard, PromoBarText, PromoModalCard, PromoPriceView } from "@/components/promo/PromoViews";
import {
  AUDIENCE_LABEL,
  COPY_FIELDS,
  KIND_LABEL,
  PROMO_AUDIENCES,
  PROMO_KINDS,
  validatePromo,
  type PromoAudience,
  type PromoCopy,
  type PromoDef,
  type PromoInput,
  type PromoKind,
  type PromoOffer,
} from "@/lib/promos/tipos";
import type { CouponVerification } from "@/lib/promos/stripe-cupon";

/* Cliente de /admin/promociones (5 nov 2026): lista, formulario con vista previa ES/EN,
 * verificacion del cupon en Stripe, prender y apagar, y registro de cambios. Todo lo que
 * escribe pasa por /api/admin/promociones/*, que vuelve a validar y a leer Stripe. */

type SerialPromo = Omit<PromoDef, "startsAt" | "endsAt"> & { startsAt: string; endsAt: string };

export interface PromoView {
  promo: SerialPromo;
  enabled: boolean;
  status: "live" | "covered" | "scheduled" | "ended" | "off";
  coveredBy: string | null;
  audienceText: string;
  discountText: string;
  startsText: string;
  endsText: string;
  verifiedText: string | null;
  updatedText: string;
}

export interface ChangeView {
  id: number;
  when: string;
  who: string;
  promo: string;
  action: "create" | "update" | "enable" | "disable";
  fields: { field: string; from: string; to: string }[];
}

type PreviewDict = Record<"es" | "en", { promo: Dictionary["promo"]; features: readonly string[] }>;

const FIELD = "rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none disabled:bg-zinc-100";
const LABEL = "text-sm font-medium text-zinc-700";

const STATUS: Record<PromoView["status"], { text: string; tone: "live" | "soon" | "neutral" | "tier" }> = {
  live: { text: "Sale ahora", tone: "live" },
  covered: { text: "Tapada", tone: "tier" },
  scheduled: { text: "Programada", tone: "soon" },
  ended: { text: "Terminó", tone: "neutral" },
  off: { text: "Apagada", tone: "neutral" },
};

const ACTION: Record<ChangeView["action"], string> = { create: "Creó", update: "Editó", enable: "Prendió", disable: "Apagó" };

/* Ciudad de Mexico no cambia de horario desde 2022: UTC-6 todo el ano. */
const CDMX_OFFSET_MS = 6 * 3_600_000;
const toLocalInput = (iso: string) => new Date(Date.parse(iso) - CDMX_OFFSET_MS).toISOString().slice(0, 16);
const fromLocalInput = (v: string) => (v ? `${v}:00-06:00` : "");

interface FormState {
  id: string;
  name: string;
  kind: PromoKind;
  percentOff: string;
  amountOff: string;
  currency: string;
  months: string;
  trialDays: string;
  couponId: string;
  clockPreset: "24" | "48" | "72" | "libre";
  clockHours: string;
  audience: PromoAudience;
  utmCampaign: string;
  startsAt: string;
  endsAt: string;
  copy: { es: PromoCopy; en: PromoCopy };
}

const emptyCopy = (): PromoCopy => ({ title: "", subtitle: "", cta: "", badge: "" });

function blankForm(): FormState {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 7 * 24 * 3_600_000);
  return {
    id: "",
    name: "",
    kind: "percent",
    percentOff: "",
    amountOff: "",
    currency: "usd",
    months: "1",
    trialDays: "",
    couponId: "",
    clockPreset: "24",
    clockHours: "24",
    audience: "anon",
    utmCampaign: "",
    startsAt: toLocalInput(start.toISOString()),
    endsAt: toLocalInput(end.toISOString()),
    copy: { es: emptyCopy(), en: emptyCopy() },
  };
}

function formOf(p: PromoInput | SerialPromo): FormState {
  const h = String(p.clockHours);
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    percentOff: p.percentOff === null ? "" : String(p.percentOff),
    amountOff: p.amountOffCents === null ? "" : (p.amountOffCents / 100).toFixed(2),
    currency: p.currency ?? "usd",
    months: p.months === null ? "1" : String(p.months),
    trialDays: p.trialDays === null ? "" : String(p.trialDays),
    couponId: p.couponId ?? "",
    clockPreset: h === "24" || h === "48" || h === "72" ? h : "libre",
    clockHours: h,
    audience: p.audience,
    utmCampaign: p.utmCampaign ?? "",
    startsAt: toLocalInput(p.startsAt),
    endsAt: toLocalInput(p.endsAt),
    copy: { es: { ...p.copy.es }, en: { ...p.copy.en } },
  };
}

/** Lo que se manda al servidor (y a validatePromo para el aviso inmediato). */
function rawOf(f: FormState): Record<string, unknown> {
  const coupon = f.kind !== "trial";
  return {
    id: f.id.trim(),
    name: f.name,
    kind: f.kind,
    percentOff: f.kind === "percent" ? f.percentOff : null,
    amountOffCents: f.kind === "amount" && f.amountOff.trim() !== "" ? Math.round(Number(f.amountOff) * 100) : null,
    currency: f.kind === "amount" ? f.currency : null,
    months: coupon ? f.months : null,
    trialDays: f.kind === "trial" ? f.trialDays : null,
    couponId: coupon ? f.couponId : null,
    clockHours: f.clockPreset === "libre" ? f.clockHours : f.clockPreset,
    audience: f.audience,
    utmCampaign: f.audience === "utm" ? f.utmCampaign : null,
    startsAt: fromLocalInput(f.startsAt),
    endsAt: fromLocalInput(f.endsAt),
    copy: f.copy,
  };
}

async function post(path: string, body: unknown) {
  const r = await fetch(`/api/admin/promociones/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

function Checks({ v }: { v: CouponVerification }) {
  return (
    <div className={`rounded-[var(--radius-sm)] border px-3 py-2 text-sm ${v.ok ? "border-zinc-300 bg-white" : "border-red-300 bg-red-50"}`}>
      <p className="font-semibold">{v.ok ? "El cupón coincide con lo configurado." : "El cupón no coincide: así no se puede prender."}</p>
      <ul className="mt-1 space-y-0.5">
        {v.checks.map((c) => (
          <li key={c.label}>
            <span className={c.ok ? "text-zinc-900" : "font-semibold text-red-700"}>{c.ok ? "Sí" : "No"}</span> · {c.label}: <span className="text-zinc-600">{c.detail}</span>
          </li>
        ))}
      </ul>
      {v.warnings.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-amber-800">
          {v.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Preview({ form, dict }: { form: FormState; dict: PreviewDict }) {
  const [lang, setLang] = useState<"es" | "en">("es");
  const [endsAt] = useState(() => Date.now() + 24 * 3_600_000);
  // Aunque el formulario tenga errores se ve lo que hay, con ceros de relleno.
  const raw = rawOf(form);
  const offer: PromoOffer = {
    id: form.id || "vista-previa",
    kind: form.kind,
    percentOff: Number(raw.percentOff) || 0,
    amountOffCents: Number(raw.amountOffCents) || 0,
    months: Number(raw.months) || 1,
    trialDays: Number(raw.trialDays) || 0,
    clockHours: Number(raw.clockHours) || 24,
    audience: form.audience,
    copy: form.copy[lang],
  };
  const d = dict[lang];
  const href = "#vista-previa";
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <p className="text-eyebrow text-zinc-500">Vista previa</p>
        {(["es", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${lang === l ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"}`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-1 text-xs text-zinc-500">Barra de abajo</p>
        <BarCard
          title={<PromoBarText offer={offer} dict={d.promo} endsAt={endsAt} />}
          sub={null}
          href={href}
          cta={offer.copy.cta || "…"}
          ctaShort={d.promo.cta_short}
          closeLabel={d.promo.close_bar}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-zinc-500">Ventana</p>
          <div className="rounded-[var(--radius-md)] bg-zinc-950/50 p-3">
            <PromoModalCard offer={offer} dict={d.promo} features={d.features} endsAt={endsAt} href={href} />
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-zinc-500">Tarjeta de Pro en /pricing</p>
          <div className="rounded-[var(--radius-md)] border border-zinc-200 bg-white p-4">
            <PromoPriceView offer={offer} dict={d.promo} endsAt={endsAt} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Editor({
  initial,
  isNew,
  wasEnabled,
  dict,
  onDone,
  onCancel,
}: {
  initial: FormState;
  isNew: boolean;
  wasEnabled: boolean;
  dict: PreviewDict;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState<CouponVerification | null>(null);
  const [status, setStatus] = useState<{ text: string; bad?: boolean; list?: string[] } | null>(null);
  const errors = useMemo(() => validatePromo(rawOf(f)).errors, [f]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }));
  const setCopy = (lang: "es" | "en", key: keyof PromoCopy, v: string) => setF((x) => ({ ...x, copy: { ...x.copy, [lang]: { ...x.copy[lang], [key]: v } } }));

  async function verify() {
    setBusy(true);
    setStatus(null);
    const r = await post("verificar", { promo: rawOf(f) });
    setBusy(false);
    if (!r.ok) return setStatus({ text: String(r.data.error ?? "No se pudo verificar."), bad: true, list: (r.data.errors as string[]) ?? [] });
    setVerification(r.data as unknown as CouponVerification);
  }

  async function save(enable: boolean) {
    setBusy(true);
    setStatus(null);
    const r = await post("guardar", { promo: rawOf(f), enable, isNew });
    setBusy(false);
    if (r.data.verification) setVerification(r.data.verification as CouponVerification);
    if (!r.ok) return setStatus({ text: String(r.data.error ?? "No se pudo guardar."), bad: true, list: (r.data.errors as string[]) ?? [] });
    const warnings = (r.data.warnings as string[]) ?? [];
    onDone(`«${f.id}» ${isNew ? "creada" : "guardada"} ${enable ? "y prendida" : "apagada"}.${warnings.length ? ` ${warnings.join(" ")}` : ""}`);
  }

  const coupon = f.kind !== "trial";
  return (
    <div className="grid gap-5 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{isNew ? "Nueva promo" : `Editar «${f.id}»`}</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cerrar sin guardar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          Id (va en la cookie y en PostHog como promo_id)
          <input className={`${FIELD} mt-1 block w-full font-mono`} value={f.id} disabled={!isNew} onChange={(e) => set("id", e.target.value.toLowerCase())} placeholder="buen-fin-30" />
        </label>
        <label className={LABEL}>
          Nombre interno
          <input className={`${FIELD} mt-1 block w-full`} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Buen Fin: 30% tres meses" />
        </label>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="text-eyebrow mb-2 text-zinc-500">Descuento</legend>
        <label className={LABEL}>
          Tipo
          <select className={`${FIELD} mt-1 block w-full`} value={f.kind} onChange={(e) => set("kind", e.target.value as PromoKind)}>
            {PROMO_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {f.kind === "percent" && (
          <label className={LABEL}>
            Porcentaje
            <input className={`${FIELD} mt-1 block w-full`} inputMode="decimal" value={f.percentOff} onChange={(e) => set("percentOff", e.target.value)} placeholder="50" />
          </label>
        )}
        {f.kind === "amount" && (
          <>
            <label className={LABEL}>
              Monto (en unidades, 4.50)
              <input className={`${FIELD} mt-1 block w-full`} inputMode="decimal" value={f.amountOff} onChange={(e) => set("amountOff", e.target.value)} placeholder="4.50" />
            </label>
            <label className={LABEL}>
              Moneda
              <input className={`${FIELD} mt-1 block w-full font-mono`} value={f.currency} onChange={(e) => set("currency", e.target.value.toLowerCase())} placeholder="usd" />
            </label>
          </>
        )}
        {coupon && (
          <>
            <label className={LABEL}>
              Meses que aplica (1 = solo el primer pago)
              <input className={`${FIELD} mt-1 block w-full`} inputMode="numeric" value={f.months} onChange={(e) => set("months", e.target.value)} />
            </label>
            <label className={`${LABEL} sm:col-span-2`}>
              Id del cupón en Stripe (créalo en el panel de Stripe, solo para el producto Pro)
              <input className={`${FIELD} mt-1 block w-full font-mono`} value={f.couponId} onChange={(e) => set("couponId", e.target.value.trim())} placeholder="BUENFIN30" />
            </label>
          </>
        )}
        {f.kind === "trial" && (
          <label className={LABEL}>
            Días de prueba gratis
            <input className={`${FIELD} mt-1 block w-full`} inputMode="numeric" value={f.trialDays} onChange={(e) => set("trialDays", e.target.value)} placeholder="7" />
          </label>
        )}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="text-eyebrow mb-2 text-zinc-500">Reloj, público y fechas</legend>
        <label className={LABEL}>
          Horas del reloj de cada persona
          <div className="mt-1 flex gap-2">
            <select className={`${FIELD} block`} value={f.clockPreset} onChange={(e) => set("clockPreset", e.target.value as FormState["clockPreset"])}>
              <option value="24">24 h</option>
              <option value="48">48 h</option>
              <option value="72">72 h</option>
              <option value="libre">Libre</option>
            </select>
            {f.clockPreset === "libre" && (
              <input className={`${FIELD} block w-24`} inputMode="numeric" value={f.clockHours} onChange={(e) => set("clockHours", e.target.value)} aria-label="Horas" />
            )}
          </div>
        </label>
        <label className={LABEL}>
          A quién le sale
          <select className={`${FIELD} mt-1 block w-full`} value={f.audience} onChange={(e) => set("audience", e.target.value as PromoAudience)}>
            {PROMO_AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        {f.audience === "utm" ? (
          <label className={LABEL}>
            utm_campaign exacto
            <input className={`${FIELD} mt-1 block w-full font-mono`} value={f.utmCampaign} onChange={(e) => set("utmCampaign", e.target.value)} placeholder="buen-fin-meta" />
          </label>
        ) : (
          <span />
        )}
        <label className={LABEL}>
          Empieza (hora CDMX)
          <input type="datetime-local" className={`${FIELD} mt-1 block w-full`} value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </label>
        <label className={LABEL}>
          Termina (hora CDMX)
          <input type="datetime-local" className={`${FIELD} mt-1 block w-full`} value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </label>
      </fieldset>
      {f.audience === "utm" && (
        <p className="-mt-3 text-xs text-zinc-500">
          Se lee de la cookie asai_utm (primera visita, 30 días), que solo existe si la persona aceptó la analítica en el aviso de cookies.
        </p>
      )}

      <fieldset className="grid gap-4 lg:grid-cols-2">
        <legend className="text-eyebrow mb-2 text-zinc-500">Textos</legend>
        {(["es", "en"] as const).map((lang) => (
          <div key={lang} className="grid gap-2">
            <p className="text-sm font-semibold">{lang === "es" ? "Español" : "Inglés"}</p>
            {COPY_FIELDS.map((cf) => (
              <label key={cf.key} className={LABEL}>
                {cf.label} <span className="font-normal text-zinc-400">({f.copy[lang][cf.key].length}/{cf.max})</span>
                <input className={`${FIELD} mt-1 block w-full`} value={f.copy[lang][cf.key]} onChange={(e) => setCopy(lang, cf.key, e.target.value)} />
              </label>
            ))}
          </div>
        ))}
      </fieldset>

      <Preview form={f} dict={dict} />

      {errors.length > 0 && (
        <ul className="list-disc rounded-[var(--radius-sm)] border border-amber-300 bg-amber-50 py-2 pl-8 pr-3 text-sm text-amber-900">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {verification && <Checks v={verification} />}
      {status && (
        <div className={`rounded-[var(--radius-sm)] px-3 py-2 text-sm ${status.bad ? "border border-red-300 bg-red-50 text-red-800" : "bg-zinc-100 text-zinc-800"}`}>
          <p>{status.text}</p>
          {status.list && status.list.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {status.list.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={verify} disabled={busy || errors.length > 0}>
          {coupon ? "Verificar cupón en Stripe" : "Verificar en Stripe"}
        </Button>
        <Button variant="secondary" onClick={() => save(false)} disabled={busy || errors.length > 0}>
          {wasEnabled ? "Guardar y apagar" : "Guardar apagada"}
        </Button>
        <Button onClick={() => save(true)} disabled={busy || errors.length > 0}>
          {wasEnabled ? "Guardar (sigue prendida)" : "Guardar y prender"}
        </Button>
      </div>
    </div>
  );
}

export default function PromosClient({
  rows,
  changes,
  changesError,
  canWrite,
  envDraft,
  preview,
}: {
  rows: PromoView[];
  changes: ChangeView[];
  changesError: string | null;
  canWrite: boolean;
  envDraft: PromoInput | null;
  preview: PreviewDict;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ form: FormState; isNew: boolean; wasEnabled: boolean; key: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; bad?: boolean; verification?: CouponVerification } | null>(null);

  async function toggle(row: PromoView) {
    setBusy(row.promo.id);
    setStatus(null);
    const r = await post("estado", { id: row.promo.id, enabled: !row.enabled });
    setBusy(null);
    if (!r.ok) {
      return setStatus({ text: String(r.data.error ?? "No se pudo cambiar."), bad: true, verification: (r.data.verification as CouponVerification) ?? undefined });
    }
    const warnings = (r.data.warnings as string[]) ?? [];
    setStatus({ text: `«${row.promo.id}» ${row.enabled ? "apagada" : "prendida"}.${warnings.length ? ` ${warnings.join(" ")}` : ""}` });
    router.refresh();
  }

  const open = (form: FormState, isNew: boolean, wasEnabled: boolean) => {
    setStatus(null);
    setEditing({ form, isNew, wasEnabled, key: Date.now() });
  };

  return (
    <div className="grid gap-6">
      {canWrite && !editing && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => open(blankForm(), true, false)}>Nueva promo</Button>
          {envDraft && (
            <Button variant="secondary" onClick={() => open(formOf(envDraft), true, false)}>
              Pasar la promo de la variable a la base
            </Button>
          )}
        </div>
      )}

      {status && (
        <div className={`rounded-[var(--radius-sm)] px-3 py-2 text-sm ${status.bad ? "border border-red-300 bg-red-50 text-red-800" : "bg-zinc-100 text-zinc-800"}`}>
          <p>{status.text}</p>
          {status.verification && <div className="mt-2"><Checks v={status.verification} /></div>}
        </div>
      )}

      {editing && (
        <Editor
          key={editing.key}
          initial={editing.form}
          isNew={editing.isNew}
          wasEnabled={editing.wasEnabled}
          dict={preview}
          onCancel={() => setEditing(null)}
          onDone={(text) => {
            setEditing(null);
            setStatus({ text });
            router.refresh();
          }}
        />
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              {["Estado", "Promo", "Público", "Descuento", "Reloj", "Fechas (CDMX)", "Cupón", ""].map((h) => (
                <th key={h} className="text-eyebrow whitespace-nowrap px-4 py-2.5 font-medium text-zinc-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.promo.id}>
                <td className="px-4 py-2.5 align-top">
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].text}</Badge>
                  {r.coveredBy && <p className="mt-1 text-xs text-zinc-500">Sale «{r.coveredBy}»</p>}
                </td>
                <td className="px-4 py-2.5 align-top">
                  <p className="font-medium text-zinc-900">{r.promo.name}</p>
                  <p className="font-mono text-xs text-zinc-500">{r.promo.id}</p>
                  <p className="text-xs text-zinc-400">{r.updatedText}</p>
                </td>
                <td className="px-4 py-2.5 align-top text-zinc-700">{r.audienceText}</td>
                <td className="px-4 py-2.5 align-top text-zinc-700">{r.discountText}</td>
                <td className="px-4 py-2.5 align-top text-zinc-700">{r.promo.clockHours} h</td>
                <td className="whitespace-nowrap px-4 py-2.5 align-top text-xs text-zinc-700">
                  {r.startsText}
                  <br />
                  {r.endsText}
                </td>
                <td className="px-4 py-2.5 align-top text-xs text-zinc-700">
                  {r.promo.couponId ? <span className="font-mono">{r.promo.couponId}</span> : "Sin cupón"}
                  <br />
                  {r.verifiedText ? `Verificado ${r.verifiedText}` : "Sin verificar"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 align-top">
                  {canWrite && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" disabled={Boolean(editing) || busy !== null} onClick={() => open(formOf(r.promo), false, r.enabled)}>
                        Editar
                      </Button>
                      <Button size="sm" variant={r.enabled ? "secondary" : "primary"} disabled={busy !== null} onClick={() => toggle(r)}>
                        {busy === r.promo.id ? "…" : r.enabled ? "Apagar" : "Prender"}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-500">Todavía no hay promos en la base.</p>}
      </div>

      <section>
        <h2 className="text-eyebrow mb-2 text-zinc-500">Registro de cambios</h2>
        {changesError && <p className="mb-2 text-sm text-red-700">No pude leer el registro: {changesError}</p>}
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                {["Cuándo", "Quién", "Promo", "Qué", "De qué a qué"].map((h) => (
                  <th key={h} className="text-eyebrow whitespace-nowrap px-4 py-2.5 font-medium text-zinc-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {changes.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 align-top text-xs text-zinc-700">{c.when}</td>
                  <td className="px-4 py-2.5 align-top text-xs text-zinc-700">{c.who}</td>
                  <td className="px-4 py-2.5 align-top font-mono text-xs">{c.promo}</td>
                  <td className="px-4 py-2.5 align-top text-zinc-700">{ACTION[c.action]}</td>
                  <td className="px-4 py-2.5 align-top text-xs text-zinc-700">
                    {c.fields.length === 0
                      ? "Sin cambios de campos"
                      : c.fields.map((x) => (
                          <p key={x.field} className="break-all">
                            <span className="font-mono">{x.field}</span>: {x.from} → {x.to}
                          </p>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {changes.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-500">Sin cambios todavía.</p>}
        </div>
      </section>
    </div>
  );
}
