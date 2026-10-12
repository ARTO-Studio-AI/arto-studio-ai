"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { VERTICALS, type Category } from "@/types/prompt";

/* Tabla del Catalogo: seleccion, cambios en linea y por lotes con confirmacion y deshacer. */

export interface CatalogRow {
  id: string;
  title_es: string;
  title_en: string;
  category: Category;
  subcategory: string;
  tier: string;
  is_published: boolean;
  is_featured: boolean;
  ai_model: string;
  difficulty: string;
  view_count: number | null;
  copy_count: number | null;
  favorite_count: number | null;
}

type Patch = Record<string, unknown>;
type Scope = { ids: string[] } | { filter: Record<string, string> };

const ACTIONS: { label: string; patch: Patch }[] = [
  { label: "Hacer disponibles", patch: { is_published: true } },
  { label: "Hacer no disponibles", patch: { is_published: false } },
  { label: "Pasar a gratis", patch: { tier: "free" } },
  { label: "Pasar a Pro", patch: { tier: "pro" } },
  { label: "Destacar", patch: { is_featured: true } },
  { label: "Quitar de destacados", patch: { is_featured: false } },
];

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: data as Record<string, unknown> };
}

export default function CatalogTable({ rows, filter, totalInFilter }: { rows: CatalogRow[]; filter: Record<string, string>; totalInFilter: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allInFilter, setAllInFilter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; batchId?: string; bad?: boolean } | null>(null);
  const [pending, setPending] = useState<{ scope: Scope; patch: Patch; count: number; summary: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");

  const pageIds = rows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const scope: Scope = allInFilter ? { filter } : { ids: [...selected] };
  const scopeCount = allInFilter ? totalInFilter : selected.size;

  function toggle(id: string) {
    setAllInFilter(false);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function preview(sc: Scope, patch: Patch) {
    setBusy(true);
    setMessage(null);
    const r = await post("/api/admin/catalogo/lote", { ...sc, patch, dry_run: true });
    setBusy(false);
    if (!r.ok) return setMessage({ text: String(r.data.error ?? "No se pudo calcular el cambio."), bad: true });
    setConfirmText("");
    setPending({ scope: sc, patch, count: Number(r.data.count ?? 0), summary: String(r.data.summary ?? "") });
  }

  async function apply() {
    if (!pending) return;
    setBusy(true);
    const r = await post("/api/admin/catalogo/lote", { ...pending.scope, patch: pending.patch, confirm: confirmText });
    setBusy(false);
    if (!r.ok) return setMessage({ text: String(r.data.error ?? "No se pudo aplicar."), bad: true });
    setPending(null);
    setSelected(new Set());
    setAllInFilter(false);
    const changed = Number(r.data.changed ?? 0);
    const pendingEmb = Number(r.data.embeddingsPending ?? 0);
    setMessage({
      text: changed
        ? `Listo: ${changed} ${changed === 1 ? "prompt cambió" : "prompts cambiaron"} (${r.data.summary}).${pendingEmb ? ` ${pendingEmb} quedan sin embedding: usa «Calcular embeddings».` : ""}`
        : "No había nada que cambiar.",
      batchId: changed ? String(r.data.batchId) : undefined,
    });
    router.refresh();
  }

  async function undo(batchId: string) {
    setBusy(true);
    const r = await post("/api/admin/catalogo/deshacer", { batch_id: batchId });
    setBusy(false);
    const skipped = Array.isArray(r.data.skipped) ? (r.data.skipped as string[]) : [];
    setMessage(
      r.ok
        ? { text: `Deshecho: ${r.data.reverted} revertidos.${skipped.length ? ` ${skipped.length} no se tocaron porque alguien los cambió después (${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? "…" : ""}).` : ""}` }
        : { text: String(r.data.error ?? "No se pudo deshacer."), bad: true },
    );
    router.refresh();
  }

  // Cambio en linea: un solo prompt, sin confirmacion; se puede deshacer desde el aviso.
  async function inline(id: string, patch: Patch) {
    setBusy(true);
    const r = await post("/api/admin/catalogo/lote", { ids: [id], patch });
    setBusy(false);
    if (!r.ok) return setMessage({ text: String(r.data.error ?? "No se pudo cambiar."), bad: true });
    setMessage({ text: `${id}: ${r.data.summary}.`, batchId: String(r.data.batchId) });
    router.refresh();
  }

  const splitTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <div>
      {message && (
        <div role="status" aria-live="polite" className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${message.bad ? "border-red-200 bg-red-50 text-red-800" : "border-zinc-200 bg-white text-zinc-700"}`}>
          <span>{message.text}</span>
          {message.batchId && <Button size="sm" variant="secondary" onClick={() => undo(message.batchId!)} disabled={busy}>Deshacer</Button>}
        </div>
      )}

      {(selected.size > 0 || allInFilter) && (
        <div className="sticky top-0 z-10 mb-4 rounded-[var(--radius-lg)] border border-zinc-900 bg-white p-3 shadow-[var(--shadow-md)]">
          <p className="mb-2 text-sm text-zinc-700">
            <span className="font-semibold text-zinc-900">{scopeCount.toLocaleString("es-MX")}</span> {allInFilter ? "prompts del filtro" : "seleccionados"}
            {!allInFilter && allPageSelected && totalInFilter > selected.size && (
              <button type="button" className="ml-3 underline-offset-2 hover:underline" onClick={() => setAllInFilter(true)}>
                Seleccionar los {totalInFilter.toLocaleString("es-MX")} del filtro
              </button>
            )}
            <button type="button" className="ml-3 text-zinc-500 hover:text-zinc-900" onClick={() => { setSelected(new Set()); setAllInFilter(false); }}>Quitar selección</button>
          </p>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <Button key={a.label} size="sm" variant="secondary" disabled={busy} onClick={() => preview(scope, a.patch)}>{a.label}</Button>
            ))}
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-2 py-1 text-xs">
              <option value="">Mover a vertical…</option>
              {Object.entries(VERTICALS).map(([k, v]) => <option key={k} value={k}>{v.label_es}</option>)}
            </select>
            {category && <Button size="sm" variant="secondary" disabled={busy} onClick={() => preview(scope, { category })}>Mover</Button>}
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="etiquetas, separadas por coma" className="rounded-[var(--radius-sm)] border border-zinc-300 px-2 py-1 text-xs" />
            {tags && (
              <>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => preview(scope, { add_tags: splitTags(tags) })}>Agregar etiquetas</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => preview(scope, { remove_tags: splitTags(tags) })}>Quitar etiquetas</Button>
              </>
            )}
          </div>
        </div>
      )}

      {pending && (
        <div role="alertdialog" aria-label="Confirmar cambio" className="mb-4 rounded-[var(--radius-lg)] border border-[var(--warn)] bg-white p-4 text-sm">
          <p className="text-zinc-900">
            Vas a <strong>{pending.summary}</strong> en <strong>{pending.count.toLocaleString("es-MX")}</strong> prompts. Queda en el historial y se puede deshacer.
          </p>
          {pending.count > 50 && (
            <label className="mt-3 block text-zinc-600">
              Escribe <strong>{pending.count}</strong> para confirmar:
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="ml-2 w-28 rounded-[var(--radius-sm)] border border-zinc-300 px-2 py-1" />
            </label>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy || pending.count === 0 || (pending.count > 50 && confirmText !== String(pending.count))} onClick={apply}>Aplicar</Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>
              <th className="px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Seleccionar la página"
                  checked={allPageSelected}
                  onChange={() => { setAllInFilter(false); setSelected(allPageSelected ? new Set() : new Set(pageIds)); }}
                />
              </th>
              {["ID", "Título", "Vertical", "Disponible", "Plan", "Modelo", "Uso"].map((h) => (
                <th key={h} className="text-eyebrow whitespace-nowrap px-3 py-2.5 font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) || allInFilter ? "bg-[var(--accent-soft)]" : ""}>
                <td className="px-3 py-2.5 align-top">
                  <input type="checkbox" aria-label={`Seleccionar ${r.id}`} checked={allInFilter || selected.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs text-zinc-500">
                  <Link href={`/admin/catalogo/${r.id}`} className="hover:text-zinc-900">{r.id}</Link>
                  {r.is_featured && <div className="mt-1"><Badge tone="live" dot>destacado</Badge></div>}
                </td>
                <td className="px-3 py-2.5 align-top">
                  <Link href={`/admin/catalogo/${r.id}`} className="text-zinc-900 hover:underline">{r.title_es}</Link>
                  <div className="text-xs text-zinc-500">{r.title_en}</div>
                </td>
                <td className="px-3 py-2.5 align-top text-zinc-700">
                  {VERTICALS[r.category]?.label_es ?? r.category}
                  <div className="text-xs text-zinc-400">{r.subcategory.replace(/_/g, " ")}</div>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <button type="button" disabled={busy} onClick={() => inline(r.id, { is_published: !r.is_published })} aria-pressed={r.is_published} aria-label={`${r.id}: ${r.is_published ? "disponible; hacer no disponible" : "no disponible; hacer disponible"}`}>
                    <Badge tone={r.is_published ? "live" : "soon"} dot={r.is_published}>{r.is_published ? "sí" : "no"}</Badge>
                  </button>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <button type="button" disabled={busy} onClick={() => inline(r.id, { tier: r.tier === "pro" ? "free" : "pro" })} aria-label={`${r.id}: plan ${r.tier === "pro" ? "Pro; pasar a gratis" : "gratis; pasar a Pro"}`}>
                    <Badge tone={r.tier === "pro" ? "inverse" : "neutral"} dot={r.tier === "pro"}>{r.tier === "pro" ? "Pro" : "gratis"}</Badge>
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-zinc-500">{r.ai_model}<div>{r.difficulty}</div></td>
                <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-zinc-500">
                  {r.view_count ?? 0} vistas<div>{r.copy_count ?? 0} copias · {r.favorite_count ?? 0} fav.</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-500">Ningún prompt cumple este filtro.</p>}
      </div>
    </div>
  );
}
