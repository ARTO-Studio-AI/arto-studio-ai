"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { VERTICALS, type Category } from "@/types/prompt";
import GeneratorPanel, { type DraftFields } from "./GeneratorPanel";

/* Editor de un prompt: espanol e ingles lado a lado. Al guardar se recalcula el embedding si
 * cambio algo que lo afecta, y el cambio queda en el historial. */

export interface EditorPrompt {
  id: string;
  title_en: string;
  title_es: string;
  prompt_en: string;
  prompt_es: string;
  category: Category;
  subcategory: string;
  ai_model: string;
  difficulty: string;
  tier: string;
  tags: string[] | null;
  use_case: string | null;
  expected_output: string | null;
  is_published: boolean;
}

const FIELD = "mt-1 w-full rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none";
const LABEL = "block text-sm font-medium text-zinc-700";

export default function PromptEditor({ initial, subcategories }: { initial: EditorPrompt | null; subcategories: string[] }) {
  const router = useRouter();
  const [p, setP] = useState({
    title_en: initial?.title_en ?? "",
    title_es: initial?.title_es ?? "",
    prompt_en: initial?.prompt_en ?? "",
    prompt_es: initial?.prompt_es ?? "",
    category: (initial?.category ?? "branding") as string,
    subcategory: initial?.subcategory ?? "",
    ai_model: initial?.ai_model ?? "claude",
    difficulty: initial?.difficulty ?? "intermediate",
    tier: initial?.tier ?? "free",
    tags: (initial?.tags ?? []).join(", "),
    use_case: initial?.use_case ?? "",
    expected_output: initial?.expected_output ?? "",
    is_published: initial?.is_published ?? false,
  });
  const [status, setStatus] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof p, v: string | boolean) => setP((s) => ({ ...s, [k]: v }));
  const useDraft = (d: DraftFields) => {
    setP((s) => ({ ...s, ...d, tags: d.tags.join(", "), is_published: false }));
    setStatus({ text: "Borrador cargado. Revísalo y pulsa «Crear prompt»; entra como no disponible." });
  };

  async function save() {
    setBusy(true);
    setStatus({ text: "Guardando…" });
    const r = await fetch("/api/admin/catalogo/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: initial?.id, prompt: { ...p, tags: p.tags.split(",").map((t) => t.trim()).filter(Boolean) } }),
    });
    const data = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
    setBusy(false);
    if (!r.ok) return setStatus({ text: data.error ?? "No se pudo guardar.", bad: true });
    setStatus({ text: initial ? "Guardado." : `Creado como ${data.id}.` });
    if (!initial && data.id) router.push(`/admin/catalogo/${data.id}`);
    else router.refresh();
  }

  return (
    <div className="grid gap-5">
      {!initial && <GeneratorPanel onUse={useDraft} />}
      <div className="grid gap-4 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 lg:grid-cols-2">
        <div>
          <label className={LABEL}>Título (español)<input className={FIELD} value={p.title_es} onChange={(e) => set("title_es", e.target.value)} /></label>
          <label className={`${LABEL} mt-3`}>Prompt (español)<textarea className={`${FIELD} min-h-[260px] font-mono text-xs`} value={p.prompt_es} onChange={(e) => set("prompt_es", e.target.value)} /></label>
        </div>
        <div>
          <label className={LABEL}>Title (English)<input className={FIELD} value={p.title_en} onChange={(e) => set("title_en", e.target.value)} /></label>
          <label className={`${LABEL} mt-3`}>Prompt (English)<textarea className={`${FIELD} min-h-[260px] font-mono text-xs`} value={p.prompt_en} onChange={(e) => set("prompt_en", e.target.value)} /></label>
        </div>
      </div>

      <div className="grid gap-4 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className={LABEL}>Vertical
          <select className={FIELD} value={p.category} onChange={(e) => set("category", e.target.value)}>
            {Object.entries(VERTICALS).map(([k, v]) => <option key={k} value={k}>{v.label_es} · {v.code}</option>)}
          </select>
        </label>
        <label className={LABEL}>Subcategoría
          <input className={FIELD} list="subcats" value={p.subcategory} onChange={(e) => set("subcategory", e.target.value)} placeholder="por ejemplo, brand_strategy" />
          <datalist id="subcats">{subcategories.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label className={LABEL}>Modelo de IA<input className={FIELD} value={p.ai_model} onChange={(e) => set("ai_model", e.target.value)} /></label>
        <label className={LABEL}>Dificultad
          <select className={FIELD} value={p.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
            {["beginner", "intermediate", "advanced", "expert"].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className={LABEL}>Plan
          <select className={FIELD} value={p.tier} onChange={(e) => set("tier", e.target.value)}>
            <option value="free">Gratis</option>
            <option value="pro">Pro</option>
          </select>
        </label>
        <label className={LABEL}>Etiquetas<input className={FIELD} value={p.tags} onChange={(e) => set("tags", e.target.value)} placeholder="separadas por coma" /></label>
        <label className={`${LABEL} sm:col-span-2 lg:col-span-3`}>Caso de uso<textarea className={`${FIELD} min-h-[70px]`} value={p.use_case} onChange={(e) => set("use_case", e.target.value)} /></label>
        <label className={`${LABEL} sm:col-span-2 lg:col-span-3`}>Resultado esperado<textarea className={`${FIELD} min-h-[70px]`} value={p.expected_output} onChange={(e) => set("expected_output", e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={p.is_published} onChange={(e) => set("is_published", e.target.checked)} /> Disponible en el sitio
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy}>{initial ? "Guardar cambios" : "Crear prompt"}</Button>
        <Button href="/admin/catalogo" variant="ghost">Volver al catálogo</Button>
        {status && <span className={`text-sm ${status.bad ? "text-[var(--bad)]" : "text-zinc-600"}`}>{status.text}</span>}
      </div>
    </div>
  );
}
