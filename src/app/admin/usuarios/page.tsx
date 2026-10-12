import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, Button } from "@/components/ui";
import { fecha, guardAdmin, PageHead, Pager, PAGE_SIZE, pageOf, Table, TD } from "../_kit";

/* /admin/usuarios (fase 1, 2026-10-12): quien se registro, por que canal y si acepto
 * correos de promocion. Solo lectura. El consentimiento se lee de newsletter_subscribers
 * (estado de la lista); la prueba con fecha y version vive en attribution_events. */

export const dynamic = "force-dynamic";

const TIERS = ["free", "pro", "enterprise"] as const;

export default async function Usuarios({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await guardAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const tier = typeof sp.tier === "string" && (TIERS as readonly string[]).includes(sp.tier) ? sp.tier : "";
  const page = pageOf(sp.p);
  const from = (page - 1) * PAGE_SIZE;

  const sb = createAdminClient();
  let query = sb
    .from("profiles")
    .select("id, email, full_name, company, role, tier, subscription_status, signup_source, utm_source, utm_campaign, signup_locale, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  // Busqueda por correo o empresa. Se quitan los caracteres que el filtro or() de
  // PostgREST interpreta (coma, parentesis, comillas) y los comodines % y _.
  const safe = q.replace(/[%_,()"*\\]/g, "");
  if (safe) query = query.or(`email.ilike.%${safe}%,company.ilike.%${safe}%`);
  if (tier) query = query.eq("tier", tier);
  const { data: rows, count, error } = await query;

  const emails = (rows ?? []).map((r) => r.email).filter(Boolean) as string[];
  const { data: subs } = emails.length
    ? await sb.from("newsletter_subscribers").select("email, status").in("email", emails)
    : { data: [] as { email: string; status: string }[] };
  const listStatus = new Map((subs ?? []).map((s) => [s.email, s.status]));

  return (
    <div>
      <PageHead eyebrow="Personas" title="Usuarios">
        <form className="flex flex-wrap items-center gap-2" action="/admin/usuarios">
          <input name="q" defaultValue={q} placeholder="Correo o empresa" className="rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none" />
          <select name="tier" defaultValue={tier} className="rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm">
            <option value="">Todos los planes</option>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Button type="submit" size="sm">Filtrar</Button>
        </form>
      </PageHead>
      {error && <p className="mb-4 text-sm text-[var(--bad)]">No se pudo leer la tabla de perfiles: {error.message}</p>}
      <Table head={["Correo", "Empresa · rol", "Plan", "Canal", "Idioma", "Lista", "Alta"]} empty={!error && (rows ?? []).length === 0 && "Sin usuarios con ese filtro."}>
        {(rows ?? []).map((r) => {
          const st = listStatus.get(r.email ?? "");
          return (
            <tr key={r.id}>
              <td className={TD}>
                <div className="text-zinc-900">{r.email}</div>
                {r.full_name && <div className="text-xs text-zinc-500">{r.full_name}</div>}
              </td>
              <td className={TD}>{[r.company, r.role].filter(Boolean).join(" · ") || "—"}</td>
              <td className={TD}>
                <Badge tone={r.tier === "free" ? "neutral" : "inverse"} dot={r.tier !== "free"}>{r.tier}</Badge>
                {r.subscription_status && r.subscription_status !== "inactive" && <div className="mt-1 text-xs text-zinc-500">{r.subscription_status}</div>}
              </td>
              <td className={TD}>
                {r.utm_source || r.signup_source || "directo"}
                {r.utm_campaign && <div className="text-xs text-zinc-500">{r.utm_campaign}</div>}
              </td>
              <td className={TD}>{r.signup_locale ?? "—"}</td>
              <td className={TD}>{st ? <Badge tone={st === "active" ? "live" : "soon"} dot={st === "active"}>{st}</Badge> : <span className="text-zinc-400">no</span>}</td>
              <td className={`${TD} whitespace-nowrap text-zinc-500`}>{fecha(r.created_at)}</td>
            </tr>
          );
        })}
      </Table>
      <Pager base="/admin/usuarios" page={page} total={count ?? 0} params={{ q: q || undefined, tier: tier || undefined }} />
    </div>
  );
}
