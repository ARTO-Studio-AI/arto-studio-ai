"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export default function UndoButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "ask" | "busy" | "error">("idle");
  async function undo() {
    setState("busy");
    const r = await fetch("/api/admin/catalogo/deshacer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch_id: batchId }) });
    if (!r.ok) return setState("error");
    router.refresh();
  }
  if (state === "ask")
    return (
      <span className="flex gap-2">
        <Button size="sm" onClick={undo}>Sí, deshacer</Button>
        <Button size="sm" variant="ghost" onClick={() => setState("idle")}>No</Button>
      </span>
    );
  return (
    <Button size="sm" variant="secondary" disabled={state === "busy"} onClick={() => setState("ask")}>
      {state === "error" ? "Reintentar" : state === "busy" ? "Deshaciendo…" : "Deshacer"}
    </Button>
  );
}
