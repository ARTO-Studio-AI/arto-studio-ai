"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import type { Lang } from "@/lib/i18n";

interface Collection {
  id: string;
  name: string;
  prompt_ids: string[];
}

export default function AddToCollectionButton({
  promptId,
  lang,
  signedIn,
}: { promptId: string; lang: Lang; signedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const labels = lang === "es"
    ? { add: "Guardar en colección", noCollections: "Aún no tienes colecciones.", in: "Ya en esta colección", create: "+ Crear colección nueva", placeholder: "Nombre de la colección", signIn: "Inicia sesión para guardar" }
    : { add: "Save to collection", noCollections: "No collections yet.", in: "Already in this collection", create: "+ New collection", placeholder: "Collection name", signIn: "Sign in to save" };

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function loadCollections() {
    setLoading(true);
    const resp = await fetch("/api/collections");
    setLoading(false);
    if (resp.ok) {
      const data = await resp.json();
      setCollections(data.collections ?? []);
    }
  }

  async function toggleClick() {
    if (!signedIn) {
      router.push(`/login?next=/prompts/${promptId}`);
      return;
    }
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) loadCollections();
  }

  async function addTo(collectionId: string) {
    await fetch(`/api/collections/${collectionId}/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt_id: promptId }),
    });
    setOpen(false);
    router.refresh();
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    setCreating(true);
    const resp = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (resp.ok) {
      const data = await resp.json();
      await addTo(data.collection.id);
    }
    setCreating(false);
    setNewName("");
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        onClick={toggleClick}
        className="rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500"
      >
        {labels.add}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-[var(--radius-md)] border border-zinc-200 bg-white p-3 shadow-lg">
          {loading ? (
            <p className="text-xs text-zinc-500">…</p>
          ) : (
            <>
              {collections.length === 0 ? (
                <p className="px-2 py-1 text-xs text-zinc-500">{labels.noCollections}</p>
              ) : (
                <ul className="max-h-56 overflow-y-auto">
                  {collections.map((c) => {
                    const already = (c.prompt_ids ?? []).includes(promptId);
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => !already && addTo(c.id)}
                          disabled={already}
                          className="block w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm hover:bg-zinc-100 disabled:cursor-default disabled:bg-zinc-50 disabled:text-zinc-500"
                        >
                          <span className="line-clamp-1">{c.name}</span>
                          {already && <span className="text-[10px] text-zinc-500">{labels.in}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-2 border-t border-zinc-200 pt-2">
                <input
                  type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder={labels.placeholder} maxLength={80}
                  className="block w-full rounded-[var(--radius-sm)] border border-zinc-300 px-2 py-1.5 text-xs focus:border-zinc-900 focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") createAndAdd(); }}
                />
                <button onClick={createAndAdd} disabled={!newName.trim() || creating}
                  className="mt-1.5 block w-full rounded-[var(--radius-sm)] bg-zinc-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
                  {creating ? "…" : labels.create}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
