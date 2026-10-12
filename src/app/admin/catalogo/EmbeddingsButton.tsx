"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

/* Repone los embeddings que faltan, de 200 en 200, hasta terminar. */
export default function EmbeddingsButton({ pending }: { pending: number }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; text?: string }>({ busy: false });
  async function run() {
    setState({ busy: true, text: "Calculando…" });
    for (let i = 0; i < 30; i++) {
      const r = await fetch("/api/admin/catalogo/embeddings", { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as { done?: number; remaining?: number; error?: string };
      if (!r.ok) return setState({ busy: false, text: d.error ?? "No se pudo calcular." });
      setState({ busy: true, text: `Faltan ${d.remaining ?? 0}…` });
      if (!d.remaining || !d.done) break;
    }
    setState({ busy: false, text: "Listo." });
    router.refresh();
  }
  return (
    <span className="flex items-center gap-2" role="status" aria-live="polite">
      <Button size="sm" variant="secondary" onClick={run} disabled={state.busy}>Calcular embeddings ({pending})</Button>
      {state.text && <span className="text-xs text-zinc-500">{state.text}</span>}
    </span>
  );
}
