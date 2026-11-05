"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import type { PendingBatch } from "@/lib/review";
import type { ReviewPrompt } from "@/lib/review-server";
import { VERTICALS } from "@/types/prompt";

/* Lista de revision (2026-11-05): botones por prompt y por lote. Despublicar un lote pide
 * confirmacion; cualquier despublicacion ofrece deshacer con el mismo endpoint del historial. */

export type QueueBatch = PendingBatch & { prompts: ReviewPrompt[] };
type Action = "approve" | "unpublish";

const DATE = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data: data as Record<string, unknown> };
}

export default function ReviewQueue({ batches }: { batches: QueueBatch[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState<string | null>(null); // lote que pide confirmar
  const [message, setMessage] = useState<{ text: string; batchId?: string; bad?: boolean } | null>(null);

  async function run(key: string, action: Action, ids: string[]) {
    setBusy(key);
    setAsk(null);
    const r = await post("/api/admin/catalogo/revision", { action, ids, confirm: String(ids.length) });
    setBusy(null);
    if (!r.ok) return setMessage({ text: String(r.data.error ?? "No se pudo guardar."), bad: true });
    const n = Number(r.data.done ?? 0);
    const missing = Array.isArray(r.data.missing) && r.data.missing.length ? ` ${r.data.missing.length} ya no existen.` : "";
    const what = action === "approve" ? (n === 1 ? "aprobado" : "aprobados") : n === 1 ? "despublicado" : "despublicados";
    setMessage({ text: `${n} ${n === 1 ? "prompt" : "prompts"} ${what}.${missing}`, batchId: typeof r.data.batchId === "string" ? r.data.batchId : undefined });
    router.refresh();
  }

  async function undo(batchId: string) {
    setBusy("undo");
    const r = await post("/api/admin/catalogo/deshacer", { batch_id: batchId });
    setBusy(null);
    setMessage(r.ok ? { text: `Deshecho: ${Number(r.data.reverted ?? 0)} vuelven a estar disponibles y regresan a esta lista.` } : { text: String(r.data.error ?? "No se pudo deshacer."), bad: true });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {message && (
        <div role="status" aria-live="polite" className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${message.bad ? "border-red-200 bg-red-50 text-red-800" : "border-zinc-200 bg-white text-zinc-700"}`}>
          <span>{message.text}</span>
          {message.batchId && <Button size="sm" variant="secondary" onClick={() => undo(message.batchId!)} disabled={busy !== null}>Deshacer</Button>}
        </div>
      )}
      {batches.map((b) => {
        const ids = b.prompts.map((p) => p.id);
        return (
          <section key={b.batchId} aria-label={b.summary}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-zinc-900">{b.summary}</h2>
                <p className="text-xs text-zinc-500">{ids.length} por revisar · {b.changedBy} · {DATE.format(new Date(b.createdAt))}</p>
              </div>
              {ask === b.batchId ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                  <span>{ids.length === 1 ? "¿Despublicar el prompt de este lote?" : `¿Despublicar los ${ids.length} de este lote?`} Se puede deshacer.</span>
                  <Button size="sm" onClick={() => run(b.batchId, "unpublish", ids)} disabled={busy !== null}>Sí, despublicar {ids.length}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAsk(null)}>No</Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => run(b.batchId, "approve", ids)} disabled={busy !== null}>{busy === b.batchId ? "Guardando…" : `Aprobar lote (${ids.length})`}</Button>
                  <Button size="sm" variant="secondary" onClick={() => setAsk(b.batchId)} disabled={busy !== null}>Despublicar lote</Button>
                </div>
              )}
            </div>
            <ul className="space-y-3">
              {b.prompts.map((p) => (
                <PromptCard key={p.id} p={p} busy={busy} onAction={(a) => run(p.id, a, [p.id])} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PromptCard({ p, busy, onAction }: { p: ReviewPrompt; busy: string | null; onAction: (a: Action) => void }) {
  const vertical = VERTICALS[p.category]?.label_es ?? p.category;
  return (
    <li className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-500">{p.id}</span>
            <Badge tone="tier">{p.tier === "pro" ? "Pro" : "Free"}</Badge>
            <Badge>{vertical}</Badge>
            {!p.is_published && <Badge tone="soon">No disponible</Badge>}
          </div>
          <p className="mt-1.5 font-medium text-zinc-900">{p.title_es}</p>
          <p className="text-sm text-zinc-500">{p.title_en}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={() => onAction("approve")} disabled={busy !== null}>{busy === p.id ? "Guardando…" : "Aprobar"}</Button>
          <Button size="sm" variant="secondary" onClick={() => onAction("unpublish")} disabled={busy !== null}>Despublicar</Button>
        </div>
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-eyebrow text-zinc-500">Para qué sirve</dt>
          <dd className="mt-0.5 text-zinc-700">{p.use_case || "Sin dato"}</dd>
        </div>
        <div>
          <dt className="text-eyebrow text-zinc-500">Qué entrega</dt>
          <dd className="mt-0.5 text-zinc-700">{p.expected_output || "Sin dato"}</dd>
        </div>
      </dl>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900">Ver el prompt completo</summary>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="text-eyebrow mb-1 text-zinc-500">Español</p>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] bg-zinc-50 p-3 font-sans text-xs text-zinc-800">{p.prompt_es}</pre>
          </div>
          <div>
            <p className="text-eyebrow mb-1 text-zinc-500">English</p>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] bg-zinc-50 p-3 font-sans text-xs text-zinc-800">{p.prompt_en}</pre>
          </div>
        </div>
      </details>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <a href={`/es/prompts/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline">Ficha pública ↗</a>
        <Link href={`/admin/catalogo/${p.id}`} className="text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline">Editar</Link>
      </div>
    </li>
  );
}
