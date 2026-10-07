"use client";

import { useEffect, useState } from "react";
import type { WelcomeContent, WelcomeItem } from "@/lib/email-templates/welcome";

/* /admin/emails (2026-10-07): correos de marca. Edita la bienvenida a la lista, ve la
 * vista previa en vivo (ES/EN) y mandate una prueba. El reporte del roast no se edita:
 * lo arma el resultado de cada roast. */

type Lang = "es" | "en";

const FIELD = "mt-1 w-full rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none";

export default function EmailsAdminPage() {
  const [content, setContent] = useState<WelcomeContent | null>(null);
  const [lang, setLang] = useState<Lang>("es");
  const [kind, setKind] = useState<"welcome" | "roast">("welcome");
  const [status, setStatus] = useState("");
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    fetch("/api/admin/emails")
      .then((r) => r.json())
      .then((d) => setContent(d.welcome))
      .catch(() => setStatus("No se pudo cargar el contenido."));
  }, []);

  function set<K extends keyof WelcomeContent>(k: K, v: WelcomeContent[K]) {
    setContent((c) => (c ? { ...c, [k]: v } : c));
  }
  function setItem(i: number, k: keyof WelcomeItem, v: string) {
    setContent((c) => (c ? { ...c, items: c.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) } : c));
  }

  async function save() {
    if (!content) return;
    setStatus("Guardando…");
    const r = await fetch("/api/admin/emails", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
    setStatus(r.ok ? "Guardado. Los próximos correos salen con este contenido." : "No se pudo guardar.");
    setPreviewKey((k) => k + 1);
  }

  async function test() {
    setStatus("Enviando prueba…");
    const r = await fetch("/api/admin/emails", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, lang }) });
    const d = await r.json().catch(() => ({}));
    setStatus(d.ok ? `Prueba enviada a ${d.to}.` : "No se pudo enviar. Revisa que el dominio de envío esté verificado en Resend.");
  }

  const L = lang === "es" ? "_es" : "_en";
  const field = (key: string, label: string, textarea = false) => {
    const k = `${key}${L}` as keyof WelcomeContent;
    const value = (content?.[k] as string) ?? "";
    return (
      <label className="block text-sm font-medium text-zinc-700">
        {label}
        {textarea ? (
          <textarea className={FIELD} rows={3} value={value} onChange={(e) => set(k, e.target.value as never)} />
        ) : (
          <input className={FIELD} value={value} onChange={(e) => set(k, e.target.value as never)} />
        )}
      </label>
    );
  };

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-eyebrow text-[var(--accent)]">Marketing</p>
        <h1 className="text-h1 mt-1">Correos</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Bienvenida a la lista: sale a quien marca la casilla de promociones (registro o Brand Roast). Reporte del roast: sale a quien deja su correo para ver el análisis completo.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["welcome", "roast"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm ${kind === k ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}>
            {k === "welcome" ? "Bienvenida a la lista" : "Reporte del roast"}
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-zinc-300" />
        {(["es", "en"] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm ${lang === l ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}>
            {l.toUpperCase()}
          </button>
        ))}
        <button type="button" onClick={test} className="ml-auto rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-1.5 text-sm">
          Mandarme una prueba
        </button>
      </div>
      {status && <p className="font-mono text-xs text-zinc-500">{status}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {kind === "welcome" ? (
          <div className="grid content-start gap-4 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5">
            {!content ? (
              <p className="text-sm text-zinc-500">Cargando…</p>
            ) : (
              <>
                {field("subject", "Asunto")}
                <div className="grid grid-cols-2 gap-3">
                  {field("headline", "Titular")}
                  {field("accent", "Palabra en serif")}
                </div>
                {field("intro", "Introducción", true)}
                <p className="text-eyebrow mt-2 text-zinc-500">Lo que vas a encontrar</p>
                {content.items.map((it, i) => (
                  <div key={i} className="grid gap-2 rounded-[var(--radius-md)] border border-zinc-200 p-3">
                    <input className={FIELD} value={lang === "es" ? it.title_es : it.title_en} onChange={(e) => setItem(i, lang === "es" ? "title_es" : "title_en", e.target.value)} placeholder="Título" />
                    <textarea className={FIELD} rows={2} value={lang === "es" ? it.body_es : it.body_en} onChange={(e) => setItem(i, lang === "es" ? "body_es" : "body_en", e.target.value)} placeholder="Texto" />
                    <input className={FIELD} value={it.url} onChange={(e) => setItem(i, "url", e.target.value)} placeholder="/prompts" />
                  </div>
                ))}
                <label className="mt-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <input type="checkbox" checked={content.promo_enabled} onChange={(e) => set("promo_enabled", e.target.checked)} />
                  Mostrar bloque de promoción
                </label>
                {content.promo_enabled && (
                  <>
                    {field("promo_title", "Título de la promoción")}
                    {field("promo_body", "Texto de la promoción", true)}
                    <div className="grid grid-cols-2 gap-3">
                      {field("promo_cta", "Texto del botón")}
                      <label className="block text-sm font-medium text-zinc-700">
                        Enlace del botón
                        <input className={FIELD} value={content.promo_url} onChange={(e) => set("promo_url", e.target.value)} />
                      </label>
                    </div>
                  </>
                )}
                <button type="button" onClick={save} className="mt-2 justify-self-start rounded-[var(--radius-sm)] bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white">
                  Guardar
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
            El reporte se arma con el resultado de cada roast: score, frase, pilares, veredicto, evidencia, por dónde empezar, imágenes para descargar y enlace para compartir. La vista previa usa un roast de ejemplo.
          </div>
        )}
        <iframe
          key={`${kind}-${lang}-${previewKey}`}
          title="Vista previa"
          src={`/api/admin/emails?preview=${kind}&lang=${lang}`}
          className="h-[900px] w-full rounded-[var(--radius-lg)] border border-zinc-200 bg-[var(--paper)]"
        />
      </div>
    </div>
  );
}
