import type { Locale } from "@/i18n/config";
import assets from "./assets.json";
import cortes from "./fichas/arto-edit-cortes.json";
import subtitulos from "./fichas/arto-edit-subtitulos.json";
import letrasDetras from "./fichas/arto-edit-letras-detras.json";
import recuadros from "./fichas/arto-edit-recuadros.json";
import titulares from "./fichas/arto-edit-titulares.json";
import color from "./fichas/arto-edit-color.json";
import zooms from "./fichas/arto-edit-zooms.json";
import sonido from "./fichas/arto-edit-sonido.json";
import director from "./fichas/arto-edit-director.json";

/* Catalogo del ARTO Edit Bundle #1 (Victor, 27 oct 2026).
 *
 * Los textos de cada skill viven en fichas/<slug>.json, el mismo ficha.json que se escribe
 * junto al skill en Drive (contrato: «261027 ASAI especificacion ARTO Edit Bundle 1 v1.0.md»).
 * scripts/sync-edit-bundle.sh los copia aqui. Mientras llegan, cada ficha trae
 * "placeholder": true y la pagina lo marca como texto provisional.
 *
 * assets.json lo genera scripts/edit-bundle-manifest.mjs: dice que demos (public/skills/demos)
 * y que paquetes (private/skills) existen. Las paginas lo leen para no pintar un <video> roto
 * ni un boton de descarga sin archivo; el build no depende de que existan.
 *
 * Los paquetes NO van en public/: viven en private/skills y solo salen por
 * GET /api/skill-downloads/[slug], que revisa sesion y la regla de access.ts. */

export const EDIT_BUNDLE_SLUG = "arto-edit-bundle-1";
export const EDIT_BUNDLE_CATEGORY = "edicion-de-video";
export const EDIT_BUNDLE_VERSION = "1.0";
/** Landing de la promocion (el enlace del DM «Comenta EDITA»), sin locale. */
export const EDIT_BUNDLE_PAGE = "/edit-bundle-1";

export const EDIT_SKILL_SLUGS = [
  "arto-edit-cortes",
  "arto-edit-subtitulos",
  "arto-edit-letras-detras",
  "arto-edit-recuadros",
  "arto-edit-titulares",
  "arto-edit-color",
  "arto-edit-zooms",
  "arto-edit-sonido",
  "arto-edit-director",
] as const;

export type EditSkillSlug = (typeof EDIT_SKILL_SLUGS)[number];
export type DownloadSlug = EditSkillSlug | typeof EDIT_BUNDLE_SLUG;

type Bi<T> = Record<Locale, T>;

export interface EditSkill {
  slug: EditSkillSlug;
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
}

/** Forma del ficha.json de Drive. Se valida al cargar: una ficha rota truena en las pruebas. */
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
}

const RAW: Record<EditSkillSlug, unknown> = {
  "arto-edit-cortes": cortes,
  "arto-edit-subtitulos": subtitulos,
  "arto-edit-letras-detras": letrasDetras,
  "arto-edit-recuadros": recuadros,
  "arto-edit-titulares": titulares,
  "arto-edit-color": color,
  "arto-edit-zooms": zooms,
  "arto-edit-sonido": sonido,
  "arto-edit-director": director,
};

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

export function parseFicha(slug: EditSkillSlug, raw: unknown): EditSkill {
  const f = raw as FichaJson;
  const bad = (field: string) => new Error(`ficha ${slug}: campo ${field} invalido`);
  if (!f || f.slug !== slug) throw bad("slug");
  if (!Number.isInteger(f.order)) throw bad("order");
  if (!isStr(f.category)) throw bad("category");
  if (!isBiStr(f.name)) throw bad("name");
  if (!isBiStr(f.tagline)) throw bad("tagline");
  if (!isBiStr(f.what)) throw bad("what");
  if (!isBiList(f.you_say)) throw bad("you_say");
  if (!isBiList(f.needs)) throw bad("needs");
  if (!isBiStr(f.time)) throw bad("time");
  if (!isStr(f.version)) throw bad("version");
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
  };
}

export const EDIT_SKILLS: readonly EditSkill[] = EDIT_SKILL_SLUGS.map((slug) => parseFicha(slug, RAW[slug])).sort(
  (a, b) => a.order - b.order,
);

export function isEditSkillSlug(slug: string): slug is EditSkillSlug {
  return (EDIT_SKILL_SLUGS as readonly string[]).includes(slug);
}

export function getEditSkill(slug: string): EditSkill | null {
  return isEditSkillSlug(slug) ? (EDIT_SKILLS.find((s) => s.slug === slug) ?? null) : null;
}

/* ------------------------------------------------------------ archivos */

export interface DownloadItem {
  slug: DownloadSlug;
  /** Archivo dentro de private/skills. Sale del catalogo, nunca de la peticion. */
  file: string;
  /** Nombre con el que lo baja la persona (el del contrato de Drive). */
  downloadName: string;
  /** Pagina a la que se regresa despues de entrar (sin locale). */
  pagePath: string;
}

export function getDownloadItem(slug: string): DownloadItem | null {
  if (slug === EDIT_BUNDLE_SLUG) {
    return {
      slug,
      file: `${EDIT_BUNDLE_SLUG}.zip`,
      downloadName: `${EDIT_BUNDLE_SLUG} - V${EDIT_BUNDLE_VERSION}.zip`,
      pagePath: EDIT_BUNDLE_PAGE,
    };
  }
  const skill = getEditSkill(slug);
  if (!skill) return null;
  return {
    slug: skill.slug,
    file: `${skill.slug}.skill`,
    downloadName: `${skill.slug} - SKILL - V${skill.version}.skill`,
    pagePath: `/skills/${skill.slug}`,
  };
}

interface AssetManifest {
  generatedAt: string | null;
  demos: Record<string, { mp4: boolean; jpg: boolean }>;
  packages: Record<string, { bytes: number; sha256: string }>;
}

const MANIFEST = assets as AssetManifest;

export function demoOf(slug: EditSkillSlug): { video: string | null; poster: string | null } {
  const d = MANIFEST.demos?.[slug];
  return {
    video: d?.mp4 ? `/skills/demos/${slug}.mp4` : null,
    poster: d?.jpg ? `/skills/demos/${slug}.jpg` : null,
  };
}

/** true si el paquete ya se sincronizo al repo (si no, el boton dice «muy pronto»). */
export function packageAvailable(slug: DownloadSlug): boolean {
  return Boolean(MANIFEST.packages?.[slug]);
}
