import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui";
import { VERTICALS } from "@/types/prompt";
import { applyFilter, CATEGORIES, DIFFICULTIES, filterToParams, parseFilter, TIERS, type CatalogFilter } from "@/lib/catalog";
import { guardAdmin, PageHead, Pager, PAGE_SIZE, pageOf } from "../_kit";
import { distinctValues } from "@/lib/catalog-server";
import CatalogTable, { type CatalogRow } from "./CatalogTable";
import EmbeddingsButton from "./EmbeddingsButton";

/* /admin/catalogo (fase 2 del rediseno, 2026-10-12). Todo el catalogo con una busqueda,
 * filtros por clasificacion, cambios en linea (disponible y plan) y por lotes con historial
 * y deshacer. Los skills se suman cuando exista su tabla (fase 3). */

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

async function countWhere(f: CatalogFilter): Promise<number | null> {
  try {
    const { count, error } = await applyFilter(createAdminClient().from("prompts").select("id", { count: "exact", head: true }), f);
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

export default async function Catalogo({ searchParams }: { searchParams: SP }) {
  await guardAdmin();
  const sp = await searchParams;
  const filter = parseFilter(sp);
  const page = pageOf(sp.p);
  const from = (page - 1) * PAGE_SIZE;
  const sb = createAdminClient();

  const listQuery = applyFilter(
    sb.from("prompts").select("id, title_es, title_en, category, subcategory, tier, is_published, is_featured, ai_model, difficulty, view_count, copy_count, favorite_count, updated_at", { count: "exact" }),
    filter,
  )
    .order("id")
    .range(from, from + PAGE_SIZE - 1);

  const [list, models, total, noPub, sinEmb, destacados] = await Promise.all([
    listQuery,
    distinctValues("ai_model"),
    countWhere({}),
    countWhere({ pending: "no_publicado" }),
    countWhere({ pending: "sin_embedding" }),
    countWhere({ pending: "destacado" }),
  ]);
  const aiModels = models;
  const rows = (list.data ?? []) as CatalogRow[];
  const params = filterToParams(filter);
  const n = (c: number | null) => (c === null ? "—" : c.toLocaleString("es-MX"));

  const pendings = [
    { key: "sin_embedding", label: "sin embedding (no salen en la búsqueda)", value: sinEmb },
    { key: "no_publicado", label: "no disponibles", value: noPub },
    { key: "destacado", label: "destacados en la home", value: destacados },
  ];

  const SELECT = "rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-2.5 py-2 text-sm";
  return (
    <div>
      <PageHead eyebrow="Catálogo" title={`Prompts · ${n(total)}`}>
        <div className="flex gap-2">
          <Button href="/admin/catalogo/historial" variant="ghost" size="sm">Historial</Button>
          <Button href="/admin/catalogo/nuevo" size="sm">Nuevo prompt</Button>
        </div>
      </PageHead>

      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        {pendings.map((p) => (
          <Link
            key={p.key}
            href={`/admin/catalogo?pending=${p.key}`}
            className={`rounded-full border px-3 py-1 ${filter.pending === p.key ? "border-zinc-900 text-zinc-900" : "border-zinc-200 text-zinc-500 hover:text-zinc-900"}`}
          >
            <span className="font-semibold text-zinc-900">{n(p.value)}</span> {p.label}
          </Link>
        ))}
        {(sinEmb ?? 0) > 0 && <EmbeddingsButton pending={sinEmb ?? 0} />}
      </div>

      <form action="/admin/catalogo" className="mb-5 grid gap-2 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input name="q" defaultValue={filter.q ?? ""} placeholder="Buscar por título, texto, ID o subcategoría" className={`${SELECT} sm:col-span-2`} />
        <select name="category" defaultValue={filter.category ?? ""} className={SELECT}>
          <option value="">Todas las verticales</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{VERTICALS[c].label_es} · {VERTICALS[c].code}</option>)}
        </select>
        <select name="tier" defaultValue={filter.tier ?? ""} className={SELECT}>
          <option value="">Gratis y Pro</option>
          {TIERS.map((t) => <option key={t} value={t}>{t === "free" ? "Gratis" : "Pro"}</option>)}
        </select>
        <select name="published" defaultValue={filter.published ?? ""} className={SELECT}>
          <option value="">Disponibles y no disponibles</option>
          <option value="si">Disponibles</option>
          <option value="no">No disponibles</option>
        </select>
        <select name="ai_model" defaultValue={filter.ai_model ?? ""} className={SELECT}>
          <option value="">Cualquier modelo de IA</option>
          {aiModels.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select name="difficulty" defaultValue={filter.difficulty ?? ""} className={SELECT}>
          <option value="">Cualquier dificultad</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="flex gap-2">
          <Button type="submit" size="sm">Filtrar</Button>
          <Button href="/admin/catalogo" variant="ghost" size="sm">Limpiar</Button>
        </div>
      </form>

      {list.error && <p className="mb-4 text-sm text-[var(--bad)]">No se pudo leer el catálogo: {list.error.message}</p>}
      <CatalogTable rows={rows} filter={params} totalInFilter={list.count ?? 0} />
      <Pager base="/admin/catalogo" page={page} total={list.count ?? 0} params={params} />
    </div>
  );
}
