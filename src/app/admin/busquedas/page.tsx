import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/catalog-server";
import { Badge, Card } from "@/components/ui";
import { fecha, guardAdmin, PageHead, Table, TD } from "../_kit";

/* /admin/busquedas (fase 4, 2026-10-12): que busca la gente en la biblioteca y que no
 * encuentra. La busqueda inteligente siempre devuelve prompts, asi que «no encontro» se
 * mide con la similitud del mejor resultado: por debajo de 0.45 el catalogo no cubre bien
 * lo que pidieron. Cada una lleva a «Nuevo prompt» con la idea ya escrita. */

export const dynamic = "force-dynamic";

const WEAK = 0.45;
const PARTIAL = 0.55;
const PERIODS = [7, 30, 90] as const;

interface Q {
  id: string;
  query: string;
  query_lang: string | null;
  results_count: number | null;
  top_result_id: string | null;
  top_similarity: number | null;
  user_tier: string | null;
  created_at: string;
}

// Fuera del componente: la regla de pureza de React no deja llamar Date.now() al pintar.
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

function cover(sim: number | null): { label: string; tone: "live" | "soon" | "neutral" } {
  if (sim === null) return { label: "—", tone: "neutral" };
  if (sim < WEAK) return { label: "no la cubre", tone: "soon" };
  if (sim < PARTIAL) return { label: "a medias", tone: "neutral" };
  return { label: "bien cubierta", tone: "live" };
}

export default async function Busquedas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await guardAdmin();
  const sp = await searchParams;
  const days = PERIODS.find((d) => String(d) === sp.dias) ?? 30;
  const since = daysAgo(days);
  const sb = createAdminClient();
  const rows = await selectAll<Q>(
    () =>
      sb
        .from("search_queries")
        .select("id, query, query_lang, results_count, top_result_id, top_similarity, user_tier, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
    20000,
  );

  const weak = rows.filter((r) => r.top_similarity !== null && r.top_similarity < WEAK).sort((a, b) => (a.top_similarity ?? 0) - (b.top_similarity ?? 0));
  const groups = new Map<string, { key: string; text: string; n: number; sims: number[]; last: string }>();
  for (const r of rows) {
    const k = norm(r.query);
    const g = groups.get(k) ?? { key: k, text: r.query, n: 0, sims: [], last: r.created_at };
    g.n++;
    if (r.top_similarity !== null) g.sims.push(r.top_similarity);
    groups.set(k, g);
  }
  const top = [...groups.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last)).slice(0, 30);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const es = rows.filter((r) => r.query_lang === "es").length;
  const signed = rows.filter((r) => r.user_tier).length;

  const tiles = [
    { label: `Búsquedas · ${days} días`, value: rows.length.toLocaleString("es-MX"), sub: `${groups.size.toLocaleString("es-MX")} distintas` },
    { label: "El catálogo no las cubre", value: weak.length.toLocaleString("es-MX"), sub: `similitud menor a ${WEAK}`, href: "#no-cubre" },
    { label: "Idioma", value: rows.length ? `${Math.round((es / rows.length) * 100)}% ES` : "—", sub: `${rows.length - es} en inglés` },
    { label: "Con sesión", value: signed.toLocaleString("es-MX"), sub: `${rows.length - signed} sin cuenta` },
  ];

  const createHref = (q: string, lang: string | null) => `/admin/catalogo/nuevo?idea=${encodeURIComponent(q.slice(0, 600))}${lang ? `&lang=${encodeURIComponent(lang)}` : ""}`;

  return (
    <div>
      <PageHead eyebrow="Producto" title="Búsquedas">
        <div className="flex gap-2 text-sm">
          {PERIODS.map((d) => (
            <Link key={d} href={`/admin/busquedas?dias=${d}`} className={`rounded-full border px-3 py-1 ${d === days ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:text-zinc-900"}`}>
              {d} días
            </Link>
          ))}
        </div>
      </PageHead>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} padding="md" href={t.href}>
            <p className="text-eyebrow text-zinc-500">{t.label}</p>
            <p className="font-display mt-2 text-4xl font-extrabold tracking-[-0.03em] text-zinc-900">{t.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{t.sub}</p>
          </Card>
        ))}
      </div>

      <h2 id="no-cubre" className="text-eyebrow mb-1 mt-8 text-zinc-500">Lo que el catálogo no cubre bien</h2>
      <p className="mb-3 text-sm text-zinc-500">Ideas para prompts nuevos. «Crear prompt» abre el generador con la búsqueda ya escrita.</p>
      <Table head={["Búsqueda", "Similitud", "Mejor resultado", "Idioma", "Fecha", ""]} empty={weak.length === 0 && "Nada en este periodo: todo lo que buscaron tiene al menos un prompt cercano."}>
        {weak.map((r) => (
          <tr key={r.id}>
            <td className={`${TD} max-w-md text-zinc-900`}>{r.query}</td>
            <td className={`${TD} font-mono text-xs`}>{r.top_similarity?.toFixed(2)}</td>
            <td className={`${TD} font-mono text-xs`}>{r.top_result_id ? <Link className="hover:underline" href={`/admin/catalogo/${r.top_result_id}`}>{r.top_result_id}</Link> : "—"}</td>
            <td className={TD}>{r.query_lang ?? "—"}</td>
            <td className={`${TD} whitespace-nowrap text-zinc-500`}>{fecha(r.created_at)}</td>
            <td className={TD}><Link className="whitespace-nowrap text-sm text-zinc-900 underline-offset-2 hover:underline" href={createHref(r.query, r.query_lang)}>Crear prompt →</Link></td>
          </tr>
        ))}
      </Table>

      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Lo más buscado</h2>
      <Table head={["Búsqueda", "Veces", "Cobertura", "Última vez"]} empty={top.length === 0 && "Sin búsquedas en este periodo."}>
        {top.map((g) => {
          const a = avg(g.sims);
          const c = cover(a);
          return (
            <tr key={g.key}>
              <td className={`${TD} max-w-md text-zinc-900`}>{g.text}</td>
              <td className={TD}>{g.n}</td>
              <td className={TD}><Badge tone={c.tone} dot={c.tone === "live"} mono={false}>{c.label}{a !== null ? ` · ${a.toFixed(2)}` : ""}</Badge></td>
              <td className={`${TD} whitespace-nowrap text-zinc-500`}>{fecha(g.last)}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
