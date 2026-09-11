"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Lang } from "@/lib/i18n";

export default function CreateCollectionForm({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels = lang === "es"
    ? { name: "Nombre", desc: "Descripción (opcional)", public_label: "Pública (visible para otros)", create: "Crear colección", creating: "Creando…", name_placeholder: "Ej. Pipeline de branding 2026" }
    : { name: "Name", desc: "Description (optional)", public_label: "Public (visible to others)", create: "Create collection", creating: "Creating…", name_placeholder: "e.g. Branding pipeline 2026" };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);

    const resp = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, is_public: isPublic }),
    });

    setBusy(false);
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      setError(data.error || "failed");
      return;
    }
    setName(""); setDescription(""); setIsPublic(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="text" required value={name} onChange={(e) => setName(e.target.value)}
        placeholder={labels.name_placeholder}
        maxLength={80}
        className="block w-full rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
      />
      <textarea
        value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder={labels.desc} rows={2} maxLength={500}
        className="block w-full resize-none rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          {labels.public_label}
        </label>
        <button type="submit" disabled={busy || !name.trim()}
          className="rounded-[var(--radius-sm)] bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
          {busy ? labels.creating : labels.create}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </form>
  );
}
