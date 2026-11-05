"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

/* Selector de estado de un skill, bundle o mod en /admin/skills (2026-11-05). Guarda en
 * POST /api/admin/skills/estado y refresca la pagina; el registro queda abajo. */

const OPTIONS = [
  ["published", "Publicado"],
  ["coming_soon", "Muy pronto"],
  ["hidden", "Oculto"],
] as const;

export default function EstadoControl({ kind, slug, status }: { kind: "skill" | "bundle" | "mod"; slug: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/skills/estado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, slug, status: value }),
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      const body = (await r?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "No se pudo guardar");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          aria-label={`Estado de ${slug}`}
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800"
        >
          {OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        {value !== status && (
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-[var(--bad)]">{error}</p>}
    </div>
  );
}
