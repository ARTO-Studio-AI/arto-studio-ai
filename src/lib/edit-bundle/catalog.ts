import { ALL_BUNDLES, PUBLIC_SKILLS, getSkill, type CatalogSkill } from "@/lib/catalogo/skills";

/* Catalogo del ARTO Edit Bundle #1 (Victor, 27 oct 2026).
 *
 * Desde el 2026-11-05 los textos viven en el catalogo general (src/lib/catalogo/skills.json,
 * categoria «edicion-de-video») y este archivo solo da los nombres que ya usaban la landing,
 * la tarjeta del bundle y las pruebas. Las fichas siguen siendo el ficha.json de Drive
 * (contrato: «261027 ASAI especificacion ARTO Edit Bundle 1 v1.0.md»); las sube
 * scripts/add-skill.mjs o scripts/sync-edit-bundle.sh. */

export {
  demoOf,
  getDownloadItem,
  packageAvailable,
  parseFicha,
  type DownloadItem,
} from "@/lib/catalogo/skills";

export const EDIT_BUNDLE_SLUG = "arto-edit-bundle-1";
export const EDIT_BUNDLE_CATEGORY = "edicion-de-video";
export const EDIT_BUNDLE_VERSION = ALL_BUNDLES.find((b) => b.slug === EDIT_BUNDLE_SLUG)?.version ?? "1.0";
/** Landing de la promocion (el enlace del DM «Comenta EDITA»), sin locale. */
export const EDIT_BUNDLE_PAGE = "/edit-bundle-1";

export type EditSkill = CatalogSkill;
export type EditSkillSlug = string;
export type DownloadSlug = string;

/** Los skills visibles del bundle, en el orden de Victor. */
export const EDIT_SKILLS: readonly EditSkill[] = PUBLIC_SKILLS.filter((s) => s.category === EDIT_BUNDLE_CATEGORY);
export const EDIT_SKILL_SLUGS: readonly string[] = EDIT_SKILLS.map((s) => s.slug);

export function isEditSkillSlug(slug: string): boolean {
  return EDIT_SKILL_SLUGS.includes(slug);
}

export function getEditSkill(slug: string): EditSkill | null {
  const s = getSkill(slug);
  return s && s.category === EDIT_BUNDLE_CATEGORY ? s : null;
}
