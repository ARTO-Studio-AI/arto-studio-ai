import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/catalog-server";
import { Card } from "@/components/ui";
import { guardAdmin, PageHead, Table, TD } from "../_kit";

/* /admin/canales (fase 4, 2026-10-12): de donde llegan los registros. Lee el primer toque
 * guardado en profiles (utm_*, signup_source, referrer) y cruza con la lista de
 * promociones y los planes de pago. Solo lectura.
 * 2026-10-16: suma la lista de espera del Pack ARTO y de Agentes (tabla waitlist, migracion
 * 0018), con su propio primer toque, porque esos correos no tienen cuenta. */

export const dynamic = "force-dynamic";

const PERIODS = [{ key: "30", label: "30 días", days: 30 }, { key: "90", label: "90 días", days: 90 }, { key: "todo", label: "Todo", days: 0 }] as const;
const sinceIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

interface P {
  email: string | null;
  tier: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  signup_source: string | null;
  referrer: string | null;
  created_at: string;
}

interface Agg { key: string; label: string; sub?: string; n: number; lista: number; pago: number }

interface W {
  email: string;
  source: string;
  marketing_opt_in: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  created_at: string;
}

interface WAgg { key: string; label: string; sub?: string; n: number; pidio: number; confirmo: number }

const WAITLIST_LABEL: Record<string, string> = { skills: "Pack ARTO", agents: "Agentes" };

function groupWaitlist(rows: W[], keyOf: (w: W) => { key: string; label: string; sub?: string } | null, inList: Set<string>): WAgg[] {
  const m = new Map<string, WAgg>();
  for (const w of rows) {
    const k = keyOf(w);
    if (!k) continue;
    const a = m.get(k.key) ?? { ...k, n: 0, pidio: 0, confirmo: 0 };
    a.n++;
    if (w.marketing_opt_in) a.pidio++;
    if (inList.has(w.email)) a.confirmo++;
    m.set(k.key, a);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

function host(ref: string | null): string | null {
  if (!ref) return null;
  try {
    return new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function group(rows: P[], keyOf: (p: P) => { key: string; label: string; sub?: string } | null, inList: Set<string>): Agg[] {
  const m = new Map<string, Agg>();
  for (const p of rows) {
    const k = keyOf(p);
    if (!k) continue;
    const a = m.get(k.key) ?? { ...k, n: 0, lista: 0, pago: 0 };
    a.n++;
    if (p.email && inList.has(p.email)) a.lista++;
    if (p.tier !== "free") a.pago++;
    m.set(k.key, a);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function WaitlistTable({ data, head, empty }: { data: WAgg[]; head: string; empty: string }) {
  return (
    <Table head={[head, "Correos", "Marcaron promociones", "En la lista"]} empty={data.length === 0 && empty}>
      {data.map((a) => (
        <tr key={a.key}>
          <td className={`${TD} text-zinc-900`}>{a.label}{a.sub && <span className="ml-2 text-xs text-zinc-500">{a.sub}</span>}</td>
          <td className={TD}>{a.n}</td>
          <td className={TD}>{a.pidio} <span className="text-xs text-zinc-400">({pct(a.pidio, a.n)})</span></td>
          <td className={TD}>{a.confirmo} <span className="text-xs text-zinc-400">({pct(a.confirmo, a.n)})</span></td>
        </tr>
      ))}
    </Table>
  );
}

function AggTable({ data, head, empty }: { data: Agg[]; head: string; empty: string }) {
  return (
    <Table head={[head, "Registros", "En la lista", "Con plan"]} empty={data.length === 0 && empty}>
      {data.map((a) => (
        <tr key={a.key}>
          <td className={`${TD} text-zinc-900`}>{a.label}{a.sub && <span className="ml-2 text-xs text-zinc-500">{a.sub}</span>}</td>
          <td className={TD}>{a.n}</td>
          <td className={TD}>{a.lista} <span className="text-xs text-zinc-400">({pct(a.lista, a.n)})</span></td>
          <td className={TD}>{a.pago}</td>
        </tr>
      ))}
    </Table>
  );
}

export default async function Canales({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await guardAdmin();
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.periodo) ?? PERIODS[0];
  const sb = createAdminClient();
  const [rows, subs, waits] = await Promise.all([
    selectAll<P>(() => {
      let q = sb.from("profiles").select("email, tier, utm_source, utm_medium, utm_campaign, signup_source, referrer, created_at").order("created_at", { ascending: false });
      if (period.days) q = q.gte("created_at", sinceIso(period.days));
      return q;
    }),
    selectAll<{ email: string }>(() => sb.from("newsletter_subscribers").select("email").eq("status", "active").order("email")),
    selectAll<W>(() => {
      let q = sb.from("waitlist").select("email, source, marketing_opt_in, utm_source, utm_medium, utm_campaign, referrer, created_at").order("created_at", { ascending: false });
      if (period.days) q = q.gte("created_at", sinceIso(period.days));
      return q;
    }),
  ]);
  const inList = new Set(subs.map((s) => s.email));

  const bySource = group(rows, (p) => {
    const src = p.utm_source || p.signup_source || (host(p.referrer) ? "referido" : "directo");
    return { key: `${src}|${p.utm_medium ?? ""}`, label: src, sub: p.utm_medium ?? undefined };
  }, inList);
  const byCampaign = group(rows, (p) => (p.utm_campaign ? { key: p.utm_campaign, label: p.utm_campaign, sub: p.utm_source ?? undefined } : null), inList);
  const byReferrer = group(rows, (p) => {
    const h = host(p.referrer);
    return h && h !== "artostudio.ai" && !h.endsWith(".artostudio.ai") ? { key: h, label: h } : null;
  }, inList);

  const waitBySource = groupWaitlist(waits, (w) => {
    const src = w.utm_source || (host(w.referrer) ? "referido" : "directo");
    const list = WAITLIST_LABEL[w.source] ?? w.source;
    return { key: `${w.source}|${src}|${w.utm_medium ?? ""}`, label: `${list} · ${src}`, sub: w.utm_medium ?? undefined };
  }, inList);
  const waitByCampaign = groupWaitlist(waits, (w) => (w.utm_campaign ? { key: `${w.source}|${w.utm_campaign}`, label: `${WAITLIST_LABEL[w.source] ?? w.source} · ${w.utm_campaign}`, sub: w.utm_source ?? undefined } : null), inList);

  const total = rows.length;
  const conUtm = rows.filter((r) => r.utm_source).length;

  return (
    <div>
      <PageHead eyebrow="Adquisición" title="Canales">
        <div className="flex gap-2 text-sm">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/admin/canales?periodo=${p.key}`} className={`rounded-full border px-3 py-1 ${p.key === period.key ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:text-zinc-900"}`}>
              {p.label}
            </Link>
          ))}
        </div>
      </PageHead>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Registros", value: total, sub: period.days ? `últimos ${period.days} días` : "desde el inicio" },
          { label: "Con campaña (UTM)", value: conUtm, sub: `${pct(conUtm, total)} del total` },
          { label: "Se unieron a la lista", value: rows.filter((r) => r.email && inList.has(r.email)).length, sub: "aceptaron promociones" },
        ].map((t) => (
          <Card key={t.label} padding="md">
            <p className="text-eyebrow text-zinc-500">{t.label}</p>
            <p className="font-display mt-2 text-4xl font-extrabold tracking-[-0.03em] text-zinc-900">{t.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{t.sub}</p>
          </Card>
        ))}
      </div>
      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Por fuente</h2>
      <AggTable data={bySource} head="Fuente · medio" empty="Sin registros en este periodo." />
      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Por campaña</h2>
      <AggTable data={byCampaign} head="Campaña · fuente" empty="Ningún registro llegó con utm_campaign." />
      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Sitios que mandan gente</h2>
      <AggTable data={byReferrer} head="Sitio" empty="Ningún registro trae un sitio de origen externo." />
      <h2 className="text-eyebrow mb-2 mt-10 text-zinc-500">Lista de espera · por fuente</h2>
      <WaitlistTable data={waitBySource} head="Lista · fuente · medio" empty="Nadie se anotó en una lista de espera en este periodo." />
      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Lista de espera · por campaña</h2>
      <WaitlistTable data={waitByCampaign} head="Lista · campaña · fuente" empty="Ningún correo de la lista de espera llegó con utm_campaign." />
      <p className="mt-6 text-xs text-zinc-500">
        Fuente: el primer toque (cookie asai_utm), que solo se guarda con consentimiento de analítica. Quien rechazó la analítica cuenta como «directo». En la lista de espera, «En la lista» es quien ya confirmó el doble opt-in; las filas anteriores al 16 de octubre no tienen primer toque y salen como «directo».
      </p>
    </div>
  );
}
