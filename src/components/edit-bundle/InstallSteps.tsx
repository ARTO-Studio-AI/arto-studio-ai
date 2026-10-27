import type { Dictionary } from "@/i18n/dictionaries";

/* Como instalar un skill: Claude Code (copiar la carpeta a ~/.claude/skills/) y claude.ai
 * (Configuracion -> Capacidades -> Skills -> subir el .skill). Cierra con el aviso de ChatGPT. */

interface Props {
  t: Dictionary["edit_bundle"];
  /** Nombre del archivo descargado, para el comando de ejemplo. */
  fileName: string;
  /** El bundle es un zip con los 9 .skill adentro: el comando los descomprime uno por uno. */
  bundle?: boolean;
}

export default function InstallSteps({ t, fileName, bundle = false }: Props) {
  const cmd = bundle
    ? `mkdir -p ~/.claude/skills\nunzip "${fileName}" -d arto-edit-bundle-1\nfind arto-edit-bundle-1 -name "*.skill" -exec unzip -o {} -d ~/.claude/skills/ \\;`
    : `mkdir -p ~/.claude/skills\nunzip "${fileName}" -d ~/.claude/skills/`;
  return (
    <section>
      <h2 className="text-2xl font-bold">{t.install_h2}</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-zinc-200 bg-white p-5">
          <h3 className="font-bold">{t.install_code_h3}</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-600">
            {t.install_code_steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <pre className="mt-4 overflow-x-auto rounded-[var(--radius-sm)] bg-zinc-900 p-3 font-mono text-xs text-zinc-100">
            <code>{cmd}</code>
          </pre>
        </div>
        <div className="rounded-[var(--radius-md)] border border-zinc-200 bg-white p-5">
          <h3 className="font-bold">{t.install_web_h3}</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-600">
            {t.install_web_steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
      {bundle && <p className="mt-4 text-sm text-zinc-600">{t.install_bundle_note}</p>}
      <p className="mt-4 rounded-[var(--radius-sm)] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        {t.chatgpt_note}
      </p>
    </section>
  );
}
