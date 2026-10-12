"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";

interface PlanRow { line: number; id: string | null; action: "create" | "update" | "same" | "error"; fields: string[]; errors: string[]; title: string }
interface Summary { creates: number; updates: number; same: number; errors: number }

const LABEL: Record<PlanRow["action"], string> = { create: "alta", update: "edición", same: "sin cambios", error: "error" };

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

export default function ImportClient() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; bad?: boolean; batchId?: string } | null>(null);
  const total = summary ? summary.creates + summary.updates : 0;

  async function onFile(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    setCsv(await f.text());
    setPlan(null);
    setSummary(null);
    setStatus(null);
  }

  async function review() {
    setBusy(true);
    setStatus(null);
    const r = await post("/api/admin/catalogo/importar", { csv });
    setBusy(false);
    if (!r.ok) return setStatus({ text: String(r.data.error ?? "No se pudo leer el CSV."), bad: true });
    setPlan(r.data.plan as PlanRow[]);
    setSummary(r.data.summary as Summary);
    setWarnings((r.data.warnings as string[]) ?? []);
    setConfirm("");
  }

  async function apply() {
    setBusy(true);
    const r = await post("/api/admin/catalogo/importar", { csv, apply: true, confirm });
    if (!r.ok) {
      setBusy(false);
      return setStatus({ text: String(r.data.error ?? "No se pudo aplicar."), bad: true });
    }
    const created = (r.data.created as string[]) ?? [];
    let text = `Listo: ${r.data.updated} editados y ${created.length} altas${created.length ? ` (${created.slice(0, 5).join(", ")}${created.length > 5 ? "…" : ""}), como no disponibles` : ""}.`;
    if (Number(r.data.embeddingsPending)) {
      setStatus({ text: `${text} Recalculando embeddings…` });
      for (let i = 0; i < 30; i++) {
        const e = await post("/api/admin/catalogo/embeddings", {});
        if (!e.ok || !Number(e.data.remaining) || !Number(e.data.done)) break;
      }
      text += " Embeddings al día.";
    }
    setBusy(false);
    setPlan(null);
    setSummary(null);
    setStatus({ text, batchId: String(r.data.batchId) });
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-900">
          Elegir archivo CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileName && <span className="text-sm text-zinc-500">{fileName}</span>}
        <Button onClick={review} disabled={!csv || busy} size="sm">Revisar</Button>
      </div>

      {status && (
        <div role="status" aria-live="polite" className={`rounded-[var(--radius-md)] border px-4 py-3 text-sm ${status.bad ? "border-red-200 bg-red-50 text-red-800" : "border-zinc-200 bg-white text-zinc-700"}`}>
          {status.text}
          {status.batchId && <> <Link className="ml-2 underline-offset-2 hover:underline" href="/admin/catalogo/historial">Ver en el historial (ahí se deshace)</Link></>}
        </div>
      )}

      {summary && plan && (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge tone="live" dot>{summary.creates} altas</Badge>
            <Badge tone="inverse">{summary.updates} ediciones</Badge>
            <Badge tone="neutral">{summary.same} sin cambios</Badge>
            {summary.errors > 0 && <Badge tone="soon">{summary.errors} con error</Badge>}
          </div>
          {warnings.map((w) => <p key={w} className="text-sm text-[var(--warn)]">{w}</p>)}
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-zinc-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>{["Fila", "ID", "Qué pasa", "Título", "Detalle"].map((h) => <th key={h} className="text-eyebrow px-3 py-2.5 font-medium text-zinc-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {plan.map((p) => (
                  <tr key={p.line} className={p.action === "error" ? "bg-red-50" : ""}>
                    <td className="px-3 py-2 text-zinc-500">{p.line}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.id ?? "nuevo"}</td>
                    <td className="px-3 py-2">{LABEL[p.action]}</td>
                    <td className="px-3 py-2 text-zinc-900">{p.title || "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-600">{p.action === "error" ? p.errors.join(" · ") : p.fields.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {summary.errors > 0 ? (
            <p className="text-sm text-zinc-600">Corrige las filas con error en el archivo y vuelve a revisarlo. No se aplica nada mientras haya errores.</p>
          ) : total > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              {total > 50 && (
                <label className="text-sm text-zinc-600">
                  Escribe <strong>{total}</strong> para confirmar:
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="ml-2 w-24 rounded-[var(--radius-sm)] border border-zinc-300 px-2 py-1" />
                </label>
              )}
              <Button onClick={apply} disabled={busy || (total > 50 && confirm !== String(total))}>Aplicar {total} cambios</Button>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">El archivo no cambia nada del catálogo.</p>
          )}
        </div>
      )}
    </div>
  );
}
