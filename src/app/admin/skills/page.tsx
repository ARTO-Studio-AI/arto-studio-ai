import Link from "next/link";
import { Badge } from "@/components/ui";
import { recentLog, type LogRow } from "@/lib/catalogo/admin-server";
import { getCatalog } from "@/lib/catalogo/efectivo";
import type { PackageRef } from "@/lib/catalogo/estado";
import { demoOf, type CatalogStatus } from "@/lib/catalogo/skills";
import { fecha, guardAdmin, PageHead, Table, TD } from "../_kit";
import EstadoControl from "./EstadoControl";
import SubirForm from "./SubirForm";

/* /admin/skills (2026-11-05): skills, bundles y mods del catalogo con su estado, version y
 * paquete. Desde el pedido de Victor del 5 nov («skills y mods no veo cómo subirlos
 * manualmente o cómo desactivarlos») aqui se gestiona todo sin tocar codigo:
 *   - Estado: cada fila tiene su selector (publicado, muy pronto, oculto). Se guarda en
 *     catalog_overrides y manda sobre el manifiesto del repo, sin redeploy.
 *   - Subida: un skill (ficha + .skill) o un mod (ficha + zip opcional) entra oculto, con la
 *     misma validacion que scripts/add-skill.mjs. El paquete va al bucket privado.
 *   - Registro: cada cambio, con quien, cuando y de que estado a cual.
 * La via por repo (add-skill.mjs / add-mod.mjs con PR) sigue igual; si un slug esta en los
 * dos, gana el del repo y aqui se avisa.
 *
 * Descargas: no hay tabla que las guarde (sumarla es DDL). Cada descarga deja una linea
 * skill_download en los logs de Vercel y el evento skill_downloaded en PostHog, por skill. */

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<CatalogStatus, string> = {
  published: "Publicado",
  coming_soon: "Muy pronto",
  hidden: "Oculto",
};
const STATUS_TONE: Record<CatalogStatus, "live" | "soon" | "neutral"> = {
  published: "live",
  coming_soon: "soon",
  hidden: "neutral",
};

function Status({ status }: { status: CatalogStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

function kb(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function Paquete({ pkg, none = "sin paquete" }: { pkg: PackageRef | null; none?: string }) {
  if (!pkg) return <span className={none === "sin paquete" ? "text-[var(--bad)]" : "text-zinc-400"}>{none}</span>;
  return (
    <span title={pkg.sha256}>
      {kb(pkg.bytes)} <span className="font-mono text-xs text-zinc-400">{pkg.sha256.slice(0, 8)}</span>
    </span>
  );
}

/** Origen y, si el estado viene de /admin, cual era el del repo. */
function Origen({ item }: { item: { source: "repo" | "admin"; repoStatus: CatalogStatus | null; override: { updated_by: string; updated_at: string } | null; uploadedBy: string | null } }) {
  if (item.source === "admin") {
    return (
      <span className="text-xs text-zinc-500">
        Admin
        <span className="block text-zinc-400">{item.uploadedBy}</span>
      </span>
    );
  }
  return (
    <span className="text-xs text-zinc-500">
      Repo
      {item.override && item.repoStatus && (
        <span className="block text-zinc-400" title={`${item.override.updated_by} · ${fecha(item.override.updated_at)}`}>
          en el repo: {STATUS_LABEL[item.repoStatus]}
        </span>
      )}
    </span>
  );
}

function Estado({ kind, slug, status }: { kind: "skill" | "bundle" | "mod"; slug: string; status: CatalogStatus }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Status status={status} />
      <EstadoControl key={status} kind={kind} slug={slug} status={status} />
    </div>
  );
}

const KIND_LABEL = { skill: "Skill", bundle: "Bundle", mod: "Mod" } as const;

function Cambio({ row }: { row: LogRow }) {
  const to = STATUS_LABEL[row.to_status];
  if (row.action === "upload") {
    const v = row.detail?.version ? ` v${String(row.detail.version)}` : "";
    return <span>Subida{v}{row.from_status ? ` (estaba ${STATUS_LABEL[row.from_status]})` : ""}, queda {to}</span>;
  }
  return (
    <span>
      {row.from_status ? STATUS_LABEL[row.from_status] : "Nuevo"} → {to}
    </span>
  );
}

export default async function AdminSkills() {
  await guardAdmin();
  const [catalog, log] = await Promise.all([getCatalog({ fresh: true }), recentLog(50)]);
  const { skills, bundles, mods, issues } = catalog;
  const count = (s: CatalogStatus) => skills.filter((x) => x.status === s).length;
  const categoryName = (slug: string) => catalog.getCategory(slug)?.name.es ?? slug;

  return (
    <div>
      <PageHead eyebrow="Catálogo" title="Skills y mods" />
      <p className="mb-4 max-w-3xl text-sm text-zinc-600">
        {skills.length} skills: {count("published")} publicados, {count("coming_soon")} muy pronto y {count("hidden")} ocultos. El estado
        se cambia aquí y se ve en el sitio en menos de un minuto, sin redeploy. Lo que se sube aquí entra oculto. La vía por repo sigue
        igual: <code className="font-mono text-xs">node scripts/add-skill.mjs &lt;carpeta&gt;</code> y{" "}
        <code className="font-mono text-xs">node scripts/add-mod.mjs &lt;mod.json&gt;</code> en una rama, con PR. La guía está en{" "}
        <code className="font-mono text-xs">docs/ADDING_A_SKILL.md</code>.
      </p>

      {!catalog.dbOk && (
        <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--bad)] bg-white p-3 text-sm text-[var(--bad)]">
          No pude leer el estado de la base: se muestra el del repo y no se puede activar, desactivar ni subir. Si es la primera vez,
          falta aplicar la migración 0021.
        </p>
      )}
      {issues.length > 0 && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--warn)] bg-white p-3 text-sm text-zinc-700">
          <p className="text-eyebrow text-[var(--warn)]">Avisos</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {issues.map((i) => (
              <li key={`${i.kind}:${i.slug}`}>
                <span className="font-mono text-xs">{i.slug}</span> ({i.kind === "skill" ? "skill" : "mod"} subido por admin): {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="text-eyebrow mb-2 text-zinc-500">Skills</h2>
      <Table head={["Skill", "Categoría", "Origen", "Estado", "Versión", "Paquete", "Demo"]} empty={skills.length === 0 && "Todavía no hay skills."}>
        {skills.map((s) => {
          const demo = demoOf(s.slug);
          return (
            <tr key={s.slug}>
              <td className={TD}>
                <div className="text-zinc-900">
                  {s.status === "hidden" ? (
                    s.name.es
                  ) : (
                    <Link href={`/es/skills/${s.slug}`} className="underline-offset-2 hover:underline">
                      {s.name.es}
                    </Link>
                  )}
                  {s.placeholder && <span className="ml-2 text-xs text-[var(--warn)]">texto provisional</span>}
                </div>
                <div className="font-mono text-xs text-zinc-400">{s.slug}</div>
              </td>
              <td className={TD}>{categoryName(s.category)}</td>
              <td className={TD}>
                <Origen item={s} />
              </td>
              <td className={TD}>
                <Estado kind="skill" slug={s.slug} status={s.status} />
              </td>
              <td className={TD}>v{s.version}</td>
              <td className={TD}>
                <Paquete pkg={s.pkg} />
              </td>
              <td className={TD}>
                {demo.video ? "video" : "falta"}
                {demo.poster ? " · póster" : ""}
              </td>
            </tr>
          );
        })}
      </Table>

      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Bundles</h2>
      <Table head={["Bundle", "Categoría", "Origen", "Estado", "Versión", "Paquete"]} empty={bundles.length === 0 && "No hay bundles."}>
        {bundles.map((b) => (
          <tr key={b.slug}>
            <td className={TD}>
              <Link href={`/es${b.page}`} className="text-zinc-900 underline-offset-2 hover:underline">
                {b.slug}
              </Link>
            </td>
            <td className={TD}>{categoryName(b.category)}</td>
            <td className={TD}>
              <Origen item={b} />
            </td>
            <td className={TD}>
              <Estado kind="bundle" slug={b.slug} status={b.status} />
            </td>
            <td className={TD}>v{b.version}</td>
            <td className={TD}>
              <Paquete pkg={b.pkg} />
            </td>
          </tr>
        ))}
      </Table>

      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Mods</h2>
      <Table head={["Mod", "Origen", "Estado", "Sale el", "Versión", "Autor y licencia", "Archivo"]} empty={mods.length === 0 && "No hay mods."}>
        {mods.map((m) => (
          <tr key={m.slug}>
            <td className={TD}>
              <div className="text-zinc-900">
                <span className="mr-2 font-mono text-xs text-zinc-400">{m.code}</span>
                {m.name}
              </div>
              <div className="font-mono text-xs text-zinc-400">{m.slug}</div>
            </td>
            <td className={TD}>
              <Origen item={m} />
            </td>
            <td className={TD}>
              <Estado kind="mod" slug={m.slug} status={m.status} />
            </td>
            <td className={TD}>{m.releaseDate}</td>
            <td className={TD}>v{m.version}</td>
            <td className={TD}>
              {m.author} · {m.license}
            </td>
            <td className={TD}>
              <Paquete pkg={m.file} none="sin archivo" />
            </td>
          </tr>
        ))}
      </Table>

      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Subir un skill o un mod</h2>
      <p className="mb-3 max-w-3xl text-sm text-zinc-600">
        Skill: la <code className="font-mono text-xs">ficha.json</code> de su carpeta de Drive y el paquete{" "}
        <code className="font-mono text-xs">&lt;slug&gt; - SKILL - V&lt;versión&gt;.skill</code>. Pasa las mismas revisiones que el script:
        textos en es y en sin em dashes ni palabras prohibidas, categoría que ya existe, paquete limpio con{" "}
        <code className="font-mono text-xs">&lt;slug&gt;/SKILL.md</code> y hasta 4.4 MB. Mod: su{" "}
        <code className="font-mono text-xs">mod.json</code> (solo con su ficha de verificación en Drive) y, si tiene, el zip. Volver a subir el
        mismo slug lo actualiza y lo deja oculto otra vez.
      </p>
      <SubirForm />

      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Registro de cambios</h2>
      {log.error && <p className="mb-2 text-sm text-[var(--bad)]">No pude leer el registro: {log.error}</p>}
      <Table head={["Cuándo", "Qué", "Cambio", "Quién"]} empty={!log.error && log.rows.length === 0 && "Todavía no hay cambios desde el admin."}>
        {log.rows.map((r) => (
          <tr key={r.id}>
            <td className={`${TD} whitespace-nowrap`}>{fecha(r.created_at)}</td>
            <td className={TD}>
              <span className="text-xs text-zinc-500">{KIND_LABEL[r.kind]}</span> <span className="font-mono text-xs">{r.slug}</span>
            </td>
            <td className={TD}>
              <Cambio row={r} />
            </td>
            <td className={TD}>{r.changed_by}</td>
          </tr>
        ))}
      </Table>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        <p className="text-eyebrow text-zinc-500">Descargas</p>
        <p className="mt-2">
          El sitio no guarda las descargas en la base. Cada una queda como <code className="font-mono text-xs">skill_download</code> en los
          logs de Vercel (con usuario, plan y skill) y como <code className="font-mono text-xs">skill_downloaded</code> en PostHog, por skill,
          cuando la persona aceptó analítica. Los skills subidos aquí se descargan del bucket privado con un enlace firmado de un minuto,
          después de pasar la regla de su categoría. Las llamadas al API de skills (Brand Roast y Positioning) están en{" "}
          <Link href="/admin/traces/skills" className="text-zinc-900 underline-offset-2 hover:underline">
            Llamadas a skills
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
