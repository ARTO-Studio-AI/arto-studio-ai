import Link from "next/link";
import { Badge } from "@/components/ui";
import { ALL_BUNDLES, ALL_SKILLS, CATEGORIES, demoOf, packageInfo, type CatalogStatus } from "@/lib/catalogo/skills";
import { ALL_MODS } from "@/lib/mods";
import { guardAdmin, PageHead, Table, TD } from "../_kit";

/* /admin/skills (2026-11-05): skills, bundles y mods del catalogo con su estado, version y
 * paquete. Solo lectura: lo que se ve aqui sale de src/lib/catalogo/*.json, que escriben
 * scripts/add-skill.mjs y scripts/add-mod.mjs (docs/ADDING_A_SKILL.md). Para cambiar algo se
 * corre el comando en una rama y se abre PR; esta pagina no escribe nada.
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

function Paquete({ slug }: { slug: string }) {
  const p = packageInfo(slug);
  if (!p) return <span className="text-[var(--bad)]">sin paquete</span>;
  return (
    <span title={p.sha256}>
      {kb(p.bytes)} <span className="font-mono text-xs text-zinc-400">{p.sha256.slice(0, 8)}</span>
    </span>
  );
}

const categoryName = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name.es ?? slug;

export default async function AdminSkills() {
  await guardAdmin();
  const count = (s: CatalogStatus) => ALL_SKILLS.filter((x) => x.status === s).length;

  return (
    <div>
      <PageHead eyebrow="Catálogo" title="Skills y mods" />
      <p className="mb-6 max-w-3xl text-sm text-zinc-600">
        {ALL_SKILLS.length} skills: {count("published")} publicados, {count("coming_soon")} muy pronto y {count("hidden")} ocultos. Solo
        lectura. Se suben con <code className="font-mono text-xs">node scripts/add-skill.mjs &lt;carpeta&gt;</code> y{" "}
        <code className="font-mono text-xs">node scripts/add-mod.mjs &lt;mod.json&gt;</code> en una rama, con PR. La guía está en{" "}
        <code className="font-mono text-xs">docs/ADDING_A_SKILL.md</code>.
      </p>

      <h2 className="text-eyebrow mb-2 text-zinc-500">Skills</h2>
      <Table head={["Skill", "Categoría", "Estado", "Versión", "Paquete", "Demo"]} empty={ALL_SKILLS.length === 0 && "Todavía no hay skills."}>
        {ALL_SKILLS.map((s) => {
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
                <Status status={s.status} />
              </td>
              <td className={TD}>v{s.version}</td>
              <td className={TD}>
                <Paquete slug={s.slug} />
              </td>
              <td className={TD}>{demo.video ? "video" : "falta"}{demo.poster ? " · póster" : ""}</td>
            </tr>
          );
        })}
      </Table>

      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Bundles</h2>
      <Table head={["Bundle", "Categoría", "Estado", "Versión", "Paquete"]} empty={ALL_BUNDLES.length === 0 && "No hay bundles."}>
        {ALL_BUNDLES.map((b) => (
          <tr key={b.slug}>
            <td className={TD}>
              <Link href={`/es${b.page}`} className="text-zinc-900 underline-offset-2 hover:underline">
                {b.slug}
              </Link>
            </td>
            <td className={TD}>{categoryName(b.category)}</td>
            <td className={TD}>
              <Status status={b.status} />
            </td>
            <td className={TD}>v{b.version}</td>
            <td className={TD}>
              <Paquete slug={b.slug} />
            </td>
          </tr>
        ))}
      </Table>

      <h2 className="text-eyebrow mb-2 mt-8 text-zinc-500">Mods</h2>
      <Table head={["Mod", "Estado", "Sale el", "Versión", "Autor y licencia"]} empty={ALL_MODS.length === 0 && "No hay mods."}>
        {ALL_MODS.map((m) => (
          <tr key={m.slug}>
            <td className={TD}>
              <div className="text-zinc-900">
                <span className="mr-2 font-mono text-xs text-zinc-400">{m.code}</span>
                {m.name}
              </div>
              <div className="font-mono text-xs text-zinc-400">{m.slug}</div>
            </td>
            <td className={TD}>
              <Status status={m.status} />
            </td>
            <td className={TD}>{m.releaseDate}</td>
            <td className={TD}>v{m.version}</td>
            <td className={TD}>
              {m.author} · {m.license}
            </td>
          </tr>
        ))}
      </Table>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        <p className="text-eyebrow text-zinc-500">Descargas</p>
        <p className="mt-2">
          El sitio no guarda las descargas en la base. Cada una queda como <code className="font-mono text-xs">skill_download</code> en los
          logs de Vercel (con usuario, plan y skill) y como <code className="font-mono text-xs">skill_downloaded</code> en PostHog, por skill,
          cuando la persona aceptó analítica. Las llamadas al API de skills (Brand Roast y Positioning) están en{" "}
          <Link href="/admin/traces/skills" className="text-zinc-900 underline-offset-2 hover:underline">
            Llamadas a skills
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
