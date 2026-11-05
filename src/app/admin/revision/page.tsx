import Link from "next/link";
import { countPending, type PendingBatch } from "@/lib/review";
import { loadPendingBatches, loadReviewPrompts, type ReviewPrompt } from "@/lib/review-server";
import { guardAdmin, PageHead } from "../_kit";
import ReviewQueue, { type QueueBatch } from "./ReviewQueue";

/* /admin/revision (2026-11-05, ficha de Victor: «Salen y los reviso despues»). Los prompts
 * que suben las rondas de Code se publican como hoy y aparecen aqui, por lote y el mas
 * reciente primero, hasta que Victor los aprueba o los despublica. */

export const dynamic = "force-dynamic";

const MAX_SHOWN = 200; // prompts con texto completo por carga; una ronda trae 20

export default async function Revision() {
  await guardAdmin();
  let batches: PendingBatch[] = [];
  let prompts = new Map<string, ReviewPrompt>();
  let error: string | null = null;
  let shownCount = 0;
  try {
    batches = await loadPendingBatches();
    const shown: PendingBatch[] = [];
    for (const b of batches) {
      if (shownCount && shownCount + b.ids.length > MAX_SHOWN) break;
      shown.push(b);
      shownCount += b.ids.length;
    }
    prompts = await loadReviewPrompts(shown.flatMap((b) => b.ids));
  } catch (e) {
    error = e instanceof Error ? e.message : "Error inesperado";
  }
  const total = countPending(batches);
  const queue: QueueBatch[] = batches
    .map((b) => ({ ...b, prompts: b.ids.map((id) => prompts.get(id)).filter((p): p is ReviewPrompt => Boolean(p)) }))
    .filter((b) => b.prompts.length > 0);

  return (
    <div>
      <PageHead eyebrow="Catálogo" title="Revisión">
        <Link href="/admin/catalogo/historial" className="text-sm text-zinc-500 hover:text-zinc-900">Historial de cambios →</Link>
      </PageHead>
      <p className="-mt-4 mb-6 text-sm text-zinc-500">
        Los prompts que suben las rondas ya están publicados. Aprobar solo los saca de esta lista; despublicar los quita del sitio y se puede deshacer en el historial.
      </p>
      {error && <p className="mb-4 text-sm text-[var(--bad)]">No se pudo leer la revisión: {error}</p>}
      {!error && (
        <p className="mb-6 text-sm text-zinc-700">
          <span className="font-display text-2xl font-extrabold tracking-[-0.03em] text-zinc-900">{total.toLocaleString("es-MX")}</span>{" "}
          {total === 1 ? "prompt por revisar" : "prompts por revisar"} en {batches.length} {batches.length === 1 ? "lote" : "lotes"}
          {queue.length < batches.length && ` · aquí van los ${shownCount} más recientes; al resolverlos aparecen los siguientes`}
        </p>
      )}
      {!error && total === 0 && (
        <p className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">No hay nada por revisar.</p>
      )}
      {queue.length > 0 && <ReviewQueue batches={queue} />}
    </div>
  );
}
