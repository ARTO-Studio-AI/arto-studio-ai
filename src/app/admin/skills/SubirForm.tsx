"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

/* Subida manual de un skill o un mod desde /admin/skills (2026-11-05). Manda la ficha (archivo
 * o texto pegado) y el paquete a POST /api/admin/skills/subir, que corre la misma validacion
 * que scripts/add-skill.mjs y add-mod.mjs. Todo entra oculto: se publica despues en la tabla. */

const MAX_BYTES = Math.floor(4.4 * 1024 * 1024);

type Result = { ok: true; message: string } | { ok: false; message: string; errors: string[] };

export default function SubirForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"skill" | "mod">("skill");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const fichaFile = data.get("ficha_archivo");
    const pkg = data.get("paquete");
    data.delete("ficha_archivo");
    data.delete("ficha_texto");
    if (fichaFile instanceof File && fichaFile.size > 0) data.set("ficha", fichaFile);
    else if (pasted.trim()) data.set("ficha", pasted);
    else return setResult({ ok: false, message: "Falta la ficha", errors: [] });
    if (pkg instanceof File && pkg.size > MAX_BYTES) {
      return setResult({ ok: false, message: `El archivo pesa ${pkg.size} bytes; el maximo es ${MAX_BYTES} (4.4 MB).`, errors: [] });
    }
    if (pkg instanceof File && pkg.size === 0) data.delete("paquete");
    data.set("kind", kind);

    setBusy(true);
    setResult(null);
    const r = await fetch("/api/admin/skills/subir", { method: "POST", body: data }).catch(() => null);
    setBusy(false);
    const body = (await r?.json().catch(() => null)) as { error?: string; errors?: string[]; slug?: string; created?: boolean } | null;
    if (!r?.ok) {
      setResult({ ok: false, message: body?.error ?? "No se pudo subir", errors: body?.errors ?? [] });
      return;
    }
    setResult({ ok: true, message: `${body?.slug} ${body?.created ? "subido" : "actualizado"} como oculto. Revísalo y publícalo en la tabla.` });
    form.reset();
    setPasted("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 text-sm">
      <fieldset className="flex gap-4">
        <legend className="text-eyebrow mb-2 text-zinc-500">Qué subes</legend>
        {(["skill", "mod"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 text-zinc-800">
            <input type="radio" name="kind_ui" value={k} checked={kind === k} onChange={() => setKind(k)} />
            {k === "skill" ? "Skill" : "Mod"}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-zinc-700">{kind === "skill" ? "ficha.json" : "mod.json"} (archivo)</span>
          <input name="ficha_archivo" type="file" accept=".json,application/json" className="mt-1 block w-full text-xs" />
        </label>
        <label className="block">
          <span className="text-zinc-700">
            {kind === "skill" ? "Paquete .skill (obligatorio)" : "Archivo .zip del mod (opcional)"}, hasta 4.4 MB
          </span>
          <input name="paquete" type="file" accept=".skill,.zip,application/zip" className="mt-1 block w-full text-xs" />
        </label>
      </div>

      <label className="block">
        <span className="text-zinc-700">O pega el JSON de la ficha</span>
        <textarea
          name="ficha_texto"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          spellCheck={false}
          className="mt-1 block w-full rounded-[var(--radius-sm)] border border-zinc-300 p-2 font-mono text-xs"
          placeholder={kind === "skill" ? '{ "slug": "arto-…", "order": 1, "category": "estrategia-y-negocio", … }' : '{ "code": "MOD02", "slug": "…", … }'}
        />
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Validando y subiendo…" : kind === "skill" ? "Subir skill" : "Subir mod"}
        </Button>
        <span className="text-xs text-zinc-500">Entra oculto. Si el slug ya existe en el repo, no se sube: gana el del repo.</span>
      </div>

      {result && (
        <div className={result.ok ? "text-zinc-800" : "text-[var(--bad)]"}>
          <p>{result.message}</p>
          {!result.ok && result.errors.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
