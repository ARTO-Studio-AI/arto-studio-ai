import type { Locale } from "@/i18n/config";
import assets from "./assets.json";
import manifest from "./skills.json";

/* Catalogo de skills del sitio (2026-11-05). Generaliza el del ARTO Edit Bundle #1.
 *
 * skills.json es el manifiesto: categorias, bundles y skills, cada skill con su estado y su
 * ficha.json de Drive tal cual. No se edita a mano: lo escribe scripts/add-skill.mjs, que
 * valida la carpeta del skill antes de registrarlo (ver docs/ADDING_A_SKILL.md).
 *
 * Estados:
 *   published    sale en /skills, tiene pagina y se descarga segun la regla de su categoria.
 *   coming_soon  sale en /skills con «Muy pronto» y tiene pagina, pero no se descarga.
 *   hidden       subido y validado, pero no sale en ningun lado publico (404).
 *
 * Reglas de descarga (access de la categoria):
 *   edit-bundle-1  la del bundle (src/lib/edit-bundle/access.ts): gratis con cuenta hasta el
 *                  7 nov 2026, despues solo Pro. Es la que ya existia, sin cambios.
 *   pro            solo Pro y Enterprise. Es la que recibe una categoria nueva por defecto;
 *                  cualquier otra regla es decision de Victor.
 *
 * assets.json lo genera scripts/catalogo-assets.mjs: que demos (public/skills/demos) y que
 * paquetes (private/skills) hay en disco. Los paquetes solo salen por /api/skill-downloads. */

type Bi<T> = Record<Locale, T>;

export const CATALOG_STATUSES = ["published", "coming_soon", "hidden"] as const;
export type CatalogStatus = (typeof CATALOG_STATUSES)[number];

export const ACCESS_POLICIES = ["edit-bundle-1", "pro"] as const;
export type AccessPolicy = (typeof ACCESS_POLICIES)[number];

export interface SkillCategory {
  slug: string;
  order: number;
  access: AccessPolicy;
  /** Bundle que se pinta arriba de la categoria, si tiene. */
  bundle: string | null;
  kicker: Bi<string>;
  name: Bi<string>;
  body: Bi<string>;
}

export interface CatalogSkill {
  slug: string;
  order: number;
  category: string;
  name: Bi<string>;
  tagline: Bi<string>;
  what: Bi<string>;
  youSay: Bi<string[]>;
  needs: Bi<string[]>;
  time: Bi<string>;
  version: string;
  placeholder: boolean;
  /** Aviso de que hace en ChatGPT; opcional en la ficha. */
  chatgptNote: Bi<string> | null;
  status: CatalogStatus;
}

export interface CatalogBundle {
  slug: string;
  category: string;
  version: string;
  /** Landing sin locale. */
  page: string;
  status: CatalogStatus;
}

/** Forma del ficha.json de Drive. Se valida al cargar: una ficha rota truena en las pruebas y el build. */
interface FichaJson {
  slug: string;
  order: number;
  category: string;
  name: Bi<string>;
  tagline: Bi<string>;
  what: Bi<string>;
  you_say: Bi<string[]>;
  needs: Bi<string[]>;
  time: Bi<string>;
  version: string;
  placeholder?: boolean;
  chatgpt_note?: Bi<string>;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function isBiStr(v: unknown): v is Bi<string> {
  const o = v as Bi<string> | null;
  return !!o && isStr(o.es) && isStr(o.en);
}
function isBiList(v: unknown): v is Bi<string[]> {
  const o = v as Bi<string[]> | null;
  return !!o && Array.isArray(o.es) && Array.isArray(o.en) && o.es.length > 0 && o.en.length > 0 && [...o.es, ...o.en].every(isStr);
}

export function isCatalogStatus(v: unknown): v is CatalogStatus {
  return (CATALOG_STATUSES as readonly unknown[]).includes(v);
}

/** Valida una ficha y la pasa a la forma que usan las paginas. Lanza con el campo que falla. */
export function parseFicha(slug: string, raw: unknown, status: CatalogStatus = "published"): CatalogSkill {
  const f = raw as FichaJson;
  const bad = (field: string) => new Error(`ficha ${slug}: campo ${field} invalido`);
  if (!f || f.slug !== slug || !SLUG_RE.test(slug)) throw bad("slug");
  if (!Number.isInteger(f.order)) throw bad("order");
  if (!isStr(f.category)) throw bad("category");
  if (!isBiStr(f.name)) throw bad("name");
  if (!isBiStr(f.tagline)) throw bad("tagline");
  if (!isBiStr(f.what)) throw bad("what");
  if (!isBiList(f.you_say)) throw bad("you_say");
  if (!isBiList(f.needs)) throw bad("needs");
  if (!isBiStr(f.time)) throw bad("time");
  if (!isStr(f.version)) throw bad("version");
  if (f.chatgpt_note !== undefined && !isBiStr(f.chatgpt_note)) throw bad("chatgpt_note");
  if (!isCatalogStatus(status)) throw bad("status");
  return {
    slug,
    order: f.order,
    category: f.category,
    name: f.name,
    tagline: f.tagline,
    what: f.what,
    youSay: f.you_say,
    needs: f.needs,
    time: f.time,
    version: f.version,
    placeholder: f.placeholder === true,
    chatgptNote: f.chatgpt_note ?? null,
    status,
  };
}

interface ManifestJson {
  categories: unknown[];
  bundles: unknown[];
  skills: { slug: string; status: string; ficha: unknown }[];
}

/** Valida el manifiesto completo. Exportada para las pruebas; el modulo la corre al cargar. */
export function parseCatalog(raw: unknown): { categories: SkillCategory[]; bundles: CatalogBundle[]; skills: CatalogSkill[] } {
  const m = raw as ManifestJson;
  if (!m || !Array.isArray(m.categories) || !Array.isArray(m.bundles) || !Array.isArray(m.skills)) {
    throw new Error("skills.json: faltan categories, bundles o skills");
  }

  const categories = m.categories.map((c, i) => {
    const o = c as SkillCategory;
    const bad = (field: string) => new Error(`skills.json: categoria ${i} campo ${field} invalido`);
    if (!o || !isStr(o.slug) || !SLUG_RE.test(o.slug)) throw bad("slug");
    if (!Number.isInteger(o.order)) throw bad("order");
    if (!(ACCESS_POLICIES as readonly unknown[]).includes(o.access)) throw bad("access");
    if (o.bundle !== null && !isStr(o.bundle)) throw bad("bundle");
    if (!isBiStr(o.kicker) || !isBiStr(o.name) || !isBiStr(o.body)) throw bad("textos");
    return { slug: o.slug, order: o.order, access: o.access, bundle: o.bundle, kicker: o.kicker, name: o.name, body: o.body };
  });
  const catSlugs = new Set(categories.map((c) => c.slug));
  if (catSlugs.size !== categories.length) throw new Error("skills.json: categorias repetidas");

  const bundles = m.bundles.map((b, i) => {
    const o = b as CatalogBundle;
    const bad = (field: string) => new Error(`skills.json: bundle ${i} campo ${field} invalido`);
    if (!o || !isStr(o.slug) || !SLUG_RE.test(o.slug)) throw bad("slug");
    if (!catSlugs.has(o.category)) throw bad("category");
    if (!isStr(o.version)) throw bad("version");
    if (!isStr(o.page) || !o.page.startsWith("/")) throw bad("page");
    if (!isCatalogStatus(o.status)) throw bad("status");
    return { slug: o.slug, category: o.category, version: o.version, page: o.page, status: o.status };
  });

  const skills = m.skills.map((s) => {
    if (!s || !isStr(s.slug)) throw new Error("skills.json: skill sin slug");
    if (!isCatalogStatus(s.status)) throw new Error(`skills.json: ${s.slug} con estado invalido`);
    const skill = parseFicha(s.slug, s.ficha, s.status);
    if (!catSlugs.has(skill.category)) throw new Error(`skills.json: ${s.slug} en una categoria que no existe (${skill.category})`);
    return skill;
  });

  const all = [...skills.map((s) => s.slug), ...bundles.map((b) => b.slug)];
  if (new Set(all).size !== all.length) throw new Error("skills.json: slugs repetidos entre skills y bundles");

  categories.sort((a, b) => a.order - b.order);
  const catOrder = new Map(categories.map((c, i) => [c.slug, i]));
  skills.sort((a, b) => catOrder.get(a.category)! - catOrder.get(b.category)! || a.order - b.order);
  return { categories, bundles, skills };
}

const CATALOG = parseCatalog(manifest);

/** Todo, incluidos los ocultos. Solo para /admin. */
export const ALL_SKILLS: readonly CatalogSkill[] = CATALOG.skills;
export const ALL_BUNDLES: readonly CatalogBundle[] = CATALOG.bundles;
export const CATEGORIES: readonly SkillCategory[] = CATALOG.categories;

/** Lo que se ve en el sitio: published y coming_soon. */
export const PUBLIC_SKILLS: readonly CatalogSkill[] = ALL_SKILLS.filter((s) => s.status !== "hidden");

export function getCategory(slug: string): SkillCategory | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/** Categorias con al menos un skill visible, en orden, con sus skills. */
export function publicCategories(): { category: SkillCategory; skills: CatalogSkill[] }[] {
  return CATEGORIES.map((category) => ({ category, skills: PUBLIC_SKILLS.filter((s) => s.category === category.slug) })).filter(
    (c) => c.skills.length > 0,
  );
}

/** Skill visible por slug (published o coming_soon). Un oculto o desconocido es null. */
export function getSkill(slug: string): CatalogSkill | null {
  return PUBLIC_SKILLS.find((s) => s.slug === slug) ?? null;
}

export function getBundle(slug: string): CatalogBundle | null {
  return ALL_BUNDLES.find((b) => b.slug === slug && b.status !== "hidden") ?? null;
}

/** Regla de descarga de un skill o bundle: la de su categoria. */
export function accessOf(slug: string): AccessPolicy | null {
  const owner = ALL_SKILLS.find((s) => s.slug === slug) ?? ALL_BUNDLES.find((b) => b.slug === slug);
  return owner ? (getCategory(owner.category)?.access ?? null) : null;
}

/* ------------------------------------------------------------ archivos */

export interface DownloadItem {
  slug: string;
  /** Archivo dentro de private/skills. Sale del catalogo, nunca de la peticion. */
  file: string;
  /** Nombre con el que lo baja la persona (el del contrato de Drive). */
  downloadName: string;
  /** Pagina a la que se regresa despues de entrar (sin locale). */
  pagePath: string;
  /** Regla de descarga de su categoria. */
  access: AccessPolicy;
}

/** Solo lo publicado se descarga. coming_soon y hidden no tienen archivo para nadie. */
export function getDownloadItem(slug: string): DownloadItem | null {
  const bundle = ALL_BUNDLES.find((b) => b.slug === slug && b.status === "published");
  if (bundle) {
    const access = getCategory(bundle.category)!.access;
    return {
      slug: bundle.slug,
      file: `${bundle.slug}.zip`,
      downloadName: `${bundle.slug} - V${bundle.version}.zip`,
      pagePath: bundle.page,
      access,
    };
  }
  const skill = ALL_SKILLS.find((s) => s.slug === slug && s.status === "published");
  if (!skill) return null;
  return {
    slug: skill.slug,
    file: `${skill.slug}.skill`,
    downloadName: `${skill.slug} - SKILL - V${skill.version}.skill`,
    pagePath: `/skills/${skill.slug}`,
    access: getCategory(skill.category)!.access,
  };
}

interface AssetManifest {
  generatedAt: string | null;
  demos: Record<string, { mp4: boolean; jpg: boolean }>;
  packages: Record<string, { bytes: number; sha256: string }>;
}

const ASSETS = assets as AssetManifest;

export function demoOf(slug: string): { video: string | null; poster: string | null } {
  const d = ASSETS.demos?.[slug];
  return {
    video: d?.mp4 ? `/skills/demos/${slug}.mp4` : null,
    poster: d?.jpg ? `/skills/demos/${slug}.jpg` : null,
  };
}

/** true si el paquete ya se sincronizo al repo (si no, el boton dice «muy pronto»). */
export function packageAvailable(slug: string): boolean {
  return Boolean(ASSETS.packages?.[slug]);
}

/** Peso y huella del paquete, para /admin/skills. */
export function packageInfo(slug: string): { bytes: number; sha256: string } | null {
  return ASSETS.packages?.[slug] ?? null;
}
