"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { VERTICALS } from "@/types/prompt";

/* Panel «Generar borrador con IA» del alta. Pide uno por llamada (para caber en 60 s) y
 * hace hasta 3 en paralelo. Nada se guarda hasta que la persona pulsa «Crear prompt». */

export interface DraftFields {
  title_es: string; title_en: string; prompt_es: string; prompt_en: string; category: string; subcategory: string;
  ai_model: string; difficulty: string; tier: string; tags: string[]; use_case: string; expected_output: string;
}

const FIELD = "mt-1 w-full rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none";

export default function GeneratorPanel({ onUse, initialIdea = "" }: { onUse: (d: DraftFields) => void; initialIdea?: string }) {
  const [category, setCategory] = useState("branding");
  const [tier, setTier] = useState("free");
  const [subcategory, setSubcategory] = useState("");
  const [idea, setIdea] = useState(initialIdea);
  const [count, setCount] = useState(2);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<DraftFields[]>([]);
  const [notes, setNotes] = useState<string[]>([]);

  async function generate() {
    setBusy(true);
    setDrafts([]);
    setNotes([]);
    const calls = Array.from({ length: count }, () =>
      fetch("/api/admin/catalogo/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, tier, idea, subcategory, count: 1 }),
      }).then(async (r) => ({ ok: r.ok, data: (await r.json().catch(() => ({}))) as { drafts?: DraftFields[]; rejected?: { title: string; reason: string }[]; error?: string } })),
    );
    const results = await Promise.all(calls);
    const out: DraftFields[] = [];
    const msgs: string[] = [];
    for (const r of results) {
      if (!r.ok) msgs.push(r.data.error ?? "Una generación falló.");
      out.push(...(r.data.drafts ?? []));
      for (const x of r.data.rejected ?? []) msgs.push(`Descartado «${x.title}»: ${x.reason}.`);
    }
    setDrafts(out);
    setNotes([...new Set(msgs)]);
    setBusy(false);
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-zinc-300 bg-[var(--paper)] p-5">
      <p className="text-eyebrow text-zinc-500">Generar borrador con IA</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="text-sm font-medium text-zinc-700">Vertical
          <select className={FIELD} value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(VERTICALS).map(([k, v]) => <option key={k} value={k}>{v.label_es}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">Plan
          <select className={FIELD} value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="free">Gratis</option>
            <option value="pro">Pro</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">Subcategoría (opcional)
          <input className={FIELD} value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="brand_strategy" />
        </label>
        <label className="text-sm font-medium text-zinc-700">Cuántos
          <select className={FIELD} value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700 sm:col-span-4">Idea
          <textarea className={`${FIELD} min-h-[70px]`} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Por ejemplo: un prompt para encontrar el nombre de una marca de café de especialidad a partir de su origen y su tono" />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={generate} disabled={busy || idea.trim().length < 10}>{busy ? "Generando…" : "Generar"}</Button>
        <span className="text-xs text-zinc-500">Tarda entre 20 y 50 segundos. No se guarda nada hasta que pulses «Crear prompt».</span>
      </div>
      <div role="status" aria-live="polite">
        {notes.map((n) => <p key={n} className="mt-2 text-xs text-[var(--warn)]">{n}</p>)}
      </div>
      {drafts.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {drafts.map((d, i) => (
            <div key={`${d.title_en}-${i}`} className="rounded-[var(--radius-md)] border border-zinc-200 bg-white p-4">
              <p className="font-semibold text-zinc-900">{d.title_es}</p>
              <p className="text-xs text-zinc-500">{d.title_en} · {d.subcategory} · {d.ai_model} · {d.difficulty}</p>
              <p className="mt-2 line-clamp-4 text-sm text-zinc-600">{d.prompt_es}</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => onUse(d)}>Usar este borrador</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
