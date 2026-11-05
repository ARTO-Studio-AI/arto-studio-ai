import { ALL_MODS, parseMod, type Mod } from "@/lib/mods";
import {
  ALL_BUNDLES,
  ALL_SKILLS,
  CATEGORIES,
  isCatalogStatus,
  packageInfo,
  parseFicha,
  type AccessPolicy,
  type CatalogBundle,
  type CatalogSkill,
  type CatalogStatus,
  type DownloadItem,
  type SkillCategory,
} from "./skills";

/* Estado efectivo del catalogo (2026-11-05, pedido de Victor: «skills y mods no veo cómo
 * subirlos manualmente o cómo desactivarlos»). Logica pura, sin base ni red.
 *
 * El sitio arma su catalogo con tres capas:
 *   1. El manifiesto del repo (skills.json, mods.json): lo que suben add-skill.mjs y
 *      add-mod.mjs con PR. Sigue igual.
 *   2. catalog_items (migracion 0021): skills y mods subidos desde /admin/skills, con la
 *      ficha en JSONB y el paquete en Storage. Se suman a los del repo.
 *   3. catalog_overrides (0021): el estado que se eligio en /admin/skills para cualquier
 *      skill, bundle o mod. Manda sobre el del manifiesto.
 *
 * Reglas:
 *   - Un subido por admin sin override esta oculto (asi entra siempre).
 *   - Si un slug existe en el repo y en la base, gana el del repo y se avisa en /admin.
 *   - Un subido por admin solo puede ir en una categoria que ya existe: la regla de descarga
 *     sale de la categoria y aqui no se crea ni se cambia ninguna.
 *   - Una fila que no pasa la validacion se ignora (no tumba el sitio) y se avisa en /admin.
 * efectivo.ts lee la base y aplica esto; si la base falla, el estado vacio deja el manifiesto. */

export type CatalogKind = "skill" | "mod" | "bundle";
export type UploadKind = "skill" | "mod";
export type Source = "repo" | "admin";

export interface OverrideRow {
  kind: CatalogKind;
  slug: string;
  status: string;
  updated_by: string;
  updated_at: string;
}

export interface UploadedRow {
  kind: UploadKind;
  slug: string;
  ficha: unknown;
  storage_path: string | null;
  bytes: number | null;
  sha256: string | null;
  uploaded_by: string;
  updated_at: string;
}

export interface CatalogState {
  overrides: OverrideRow[];
  items: UploadedRow[];
  /** false si no se pudo leer la base (o no se intento): el catalogo es el del repo. */
  ok: boolean;
}

export const MANIFEST_ONLY: CatalogState = { overrides: [], items: [], ok: false };

export interface PackageRef {
  bytes: number;
  sha256: string;
  /** Ruta en el bucket privado. null para los del repo (viven en private/skills). */
  storagePath: string | null;
}

interface Layered {
  source: Source;
  /** Estado del manifiesto del repo; null para los subidos por admin. */
  repoStatus: CatalogStatus | null;
  /** El override de la base que fija el estado, si hay. */
  override: OverrideRow | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export type EffectiveSkill = CatalogSkill & Layered & { pkg: PackageRef | null };
export type EffectiveBundle = CatalogBundle & Layered & { pkg: PackageRef | null };
export type EffectiveMod = Mod & Layered & { file: PackageRef | null };

/** Descarga de un skill subido por admin: sale de Storage con URL firmada. */
export type EffectiveDownloadItem = DownloadItem & { storagePath?: string };

export interface CatalogIssue {
  kind: UploadKind;
  slug: string;
  message: string;
}

export interface BaseCatalog {
  categories: readonly SkillCategory[];
  skills: readonly CatalogSkill[];
  bundles: readonly CatalogBundle[];
  mods: readonly Mod[];
  packageInfo: (slug: string) => { bytes: number; sha256: string } | null;
}

export const REPO_CATALOG: BaseCatalog = { categories: CATEGORIES, skills: ALL_SKILLS, bundles: ALL_BUNDLES, mods: ALL_MODS, packageInfo };

function pkgOf(row: UploadedRow): PackageRef | null {
  if (!row.storage_path || !row.sha256 || typeof row.bytes !== "number") return null;
  return { bytes: row.bytes, sha256: row.sha256, storagePath: row.storage_path };
}

export class EffectiveCatalog {
  readonly categories: readonly SkillCategory[];
  readonly skills: readonly EffectiveSkill[];
  readonly bundles: readonly EffectiveBundle[];
  readonly mods: readonly EffectiveMod[];
  readonly issues: readonly CatalogIssue[];
  /** true si el estado de la base se leyo bien. */
  readonly dbOk: boolean;

  constructor(base: BaseCatalog, state: CatalogState) {
    this.dbOk = state.ok;
    this.categories = base.categories;
    const issues: CatalogIssue[] = [];

    const overrides = new Map<string, OverrideRow>();
    for (const o of state.overrides) if (isCatalogStatus(o.status)) overrides.set(`${o.kind}:${o.slug}`, o);
    const ov = (kind: CatalogKind, slug: string) => overrides.get(`${kind}:${slug}`) ?? null;

    const repoPkg = (slug: string): PackageRef | null => {
      const p = base.packageInfo(slug);
      return p ? { ...p, storagePath: null } : null;
    };
    const fromRepo = (kind: CatalogKind, slug: string, status: CatalogStatus) => {
      const o = ov(kind, slug);
      return { status: (o?.status as CatalogStatus) ?? status, source: "repo" as const, repoStatus: status, override: o, uploadedBy: null, uploadedAt: null };
    };

    /* ---- skills */
    const repoSlugs = new Set([...base.skills.map((s) => s.slug), ...base.bundles.map((b) => b.slug)]);
    const catSlugs = new Set(base.categories.map((c) => c.slug));
    const skills: EffectiveSkill[] = base.skills.map((s) => ({ ...s, ...fromRepo("skill", s.slug, s.status), pkg: repoPkg(s.slug) }));
    const seen = new Set(repoSlugs);
    for (const row of state.items.filter((r) => r.kind === "skill")) {
      if (repoSlugs.has(row.slug)) {
        issues.push({ kind: "skill", slug: row.slug, message: "Ya existe en el repo: se muestra el del repo y se ignora el subido por admin." });
        continue;
      }
      if (seen.has(row.slug)) continue;
      const o = ov("skill", row.slug);
      try {
        const skill = parseFicha(row.slug, row.ficha, (o?.status as CatalogStatus) ?? "hidden");
        if (!catSlugs.has(skill.category)) throw new Error(`categoria ${skill.category} no existe`);
        const pkg = pkgOf(row);
        if (!pkg) throw new Error("sin paquete");
        skills.push({ ...skill, source: "admin", repoStatus: null, override: o, uploadedBy: row.uploaded_by, uploadedAt: row.updated_at, pkg });
        seen.add(row.slug);
      } catch (err) {
        issues.push({ kind: "skill", slug: row.slug, message: `No pasa la validacion y no se muestra: ${(err as Error).message}` });
      }
    }
    const catOrder = new Map(base.categories.map((c, i) => [c.slug, i]));
    skills.sort((a, b) => catOrder.get(a.category)! - catOrder.get(b.category)! || a.order - b.order);
    this.skills = skills;

    /* ---- bundles (solo del repo) */
    this.bundles = base.bundles.map((b) => ({ ...b, ...fromRepo("bundle", b.slug, b.status), pkg: repoPkg(b.slug) }));

    /* ---- mods */
    const mods: EffectiveMod[] = base.mods.map((m) => ({ ...m, ...fromRepo("mod", m.slug, m.status), file: null }));
    const modSlugs = new Set(mods.map((m) => m.slug));
    const modCodes = new Set(mods.map((m) => m.code));
    for (const row of state.items.filter((r) => r.kind === "mod")) {
      const code = (row.ficha as { code?: unknown } | null)?.code;
      const inRepo = base.mods.some((m) => m.slug === row.slug || m.code === code);
      if (inRepo) {
        issues.push({ kind: "mod", slug: row.slug, message: "El slug o el codigo ya existen en el repo: se muestra el del repo y se ignora el subido por admin." });
        continue;
      }
      if (modSlugs.has(row.slug) || modCodes.has(String(code))) continue;
      const o = ov("mod", row.slug);
      try {
        const mod = parseMod({ ...(row.ficha as object), slug: row.slug, status: (o?.status as CatalogStatus) ?? "hidden" });
        mods.push({ ...mod, source: "admin", repoStatus: null, override: o, uploadedBy: row.uploaded_by, uploadedAt: row.updated_at, file: pkgOf(row) });
        modSlugs.add(mod.slug);
        modCodes.add(mod.code);
      } catch (err) {
        issues.push({ kind: "mod", slug: row.slug, message: `No pasa la validacion y no se muestra: ${(err as Error).message}` });
      }
    }
    this.mods = mods;
    this.issues = issues;
  }

  getCategory(slug: string): SkillCategory | null {
    return this.categories.find((c) => c.slug === slug) ?? null;
  }

  /** Lo que se ve en el sitio: published y coming_soon. */
  publicSkills(): EffectiveSkill[] {
    return this.skills.filter((s) => s.status !== "hidden");
  }

  /** Categorias con al menos un skill visible, en orden, con sus skills. */
  publicCategories(): { category: SkillCategory; skills: EffectiveSkill[] }[] {
    const visible = this.publicSkills();
    return this.categories.map((category) => ({ category, skills: visible.filter((s) => s.category === category.slug) })).filter((c) => c.skills.length > 0);
  }

  /** Skill visible por slug (published o coming_soon). Un oculto o desconocido es null. */
  getSkill(slug: string): EffectiveSkill | null {
    return this.skills.find((s) => s.slug === slug && s.status !== "hidden") ?? null;
  }

  getBundle(slug: string): EffectiveBundle | null {
    return this.bundles.find((b) => b.slug === slug && b.status !== "hidden") ?? null;
  }

  /** Regla de descarga de un skill o bundle: la de su categoria. */
  accessOf(slug: string): AccessPolicy | null {
    const owner = this.skills.find((s) => s.slug === slug) ?? this.bundles.find((b) => b.slug === slug);
    return owner ? (this.getCategory(owner.category)?.access ?? null) : null;
  }

  /** Solo lo publicado se descarga. coming_soon y hidden no tienen archivo para nadie. */
  getDownloadItem(slug: string): EffectiveDownloadItem | null {
    const bundle = this.bundles.find((b) => b.slug === slug && b.status === "published");
    if (bundle) {
      return {
        slug: bundle.slug,
        file: `${bundle.slug}.zip`,
        downloadName: `${bundle.slug} - V${bundle.version}.zip`,
        pagePath: bundle.page,
        access: this.getCategory(bundle.category)!.access,
      };
    }
    const skill = this.skills.find((s) => s.slug === slug && s.status === "published");
    if (!skill) return null;
    const item: EffectiveDownloadItem = {
      slug: skill.slug,
      file: `${skill.slug}.skill`,
      downloadName: `${skill.slug} - SKILL - V${skill.version}.skill`,
      pagePath: `/skills/${skill.slug}`,
      access: this.getCategory(skill.category)!.access,
    };
    if (skill.source === "admin") item.storagePath = skill.pkg!.storagePath!;
    return item;
  }

  /** true si hay paquete para entregar (en private/skills o en Storage). */
  packageAvailable(slug: string): boolean {
    const owner = this.skills.find((s) => s.slug === slug) ?? this.bundles.find((b) => b.slug === slug);
    return Boolean(owner?.pkg);
  }

  /** Los mods que salen en /mods. */
  publicMods(): EffectiveMod[] {
    return this.mods.filter((m) => m.status !== "hidden");
  }

  /** Cualquier skill, bundle o mod por tipo y slug, incluidos los ocultos. Para /admin. */
  find(kind: CatalogKind, slug: string): EffectiveSkill | EffectiveBundle | EffectiveMod | null {
    const list: readonly { slug: string }[] = kind === "skill" ? this.skills : kind === "bundle" ? this.bundles : this.mods;
    return (list.find((x) => x.slug === slug) as EffectiveSkill | EffectiveBundle | EffectiveMod | undefined) ?? null;
  }
}

export function buildCatalog(state: CatalogState = MANIFEST_ONLY, base: BaseCatalog = REPO_CATALOG): EffectiveCatalog {
  return new EffectiveCatalog(base, state);
}
