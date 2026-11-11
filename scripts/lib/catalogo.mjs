/* Validador y registro del catalogo de skills y mods (2026-11-05).
 *
 * Lo usan scripts/add-skill.mjs, scripts/add-mod.mjs y scripts/catalogo-assets.mjs, y lo
 * prueban tests/catalogo-validador.test.ts. Solo Node, sin dependencias: lee el .skill (zip)
 * con su directorio central para revisar que trae adentro.
 *
 * El sitio lee lo que esto escribe:
 *   src/lib/catalogo/skills.json   categorias, bundles y skills (ficha de Drive + estado)
 *   src/lib/catalogo/mods.json     mods
 *   src/lib/catalogo/assets.json   que demos y paquetes hay en disco
 *   private/skills/<slug>.skill    paquete (solo sale por /api/skill-downloads)
 *   public/skills/demos/<slug>.mp4 y .jpg */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export const PATHS = {
  skills: "src/lib/catalogo/skills.json",
  mods: "src/lib/catalogo/mods.json",
  assets: "src/lib/catalogo/assets.json",
  packages: "private/skills",
  demos: "public/skills/demos",
};

/* Las reglas (ficha, SKILL.md, paquete, mods, textos y limites) viven en
 * src/lib/catalogo/validacion.mjs, que tambien usa /admin/skills para la subida en
 * produccion. Aqui solo queda lo que toca disco y los manifiestos del repo. */
import {
  ACCESS_POLICIES,
  LIMITS,
  SLUG_RE,
  STATUSES,
  copyProblems,
  isBiStr,
  isStr,
  packageName,
  packageProblems,
  skillMdProblems,
  validateFicha,
} from "../../src/lib/catalogo/validacion.mjs";

export {
  ACCESS_POLICIES,
  EM_DASH,
  FORBIDDEN_WORDS,
  LIMITS,
  STATUSES,
  copyProblems,
  packageName,
  packageProblems,
  parseFrontmatter,
  skillMdProblems,
  validateFicha,
  validateMod,
  validateModUpload,
  validateSkillUpload,
  zipEntries,
  zipReadText,
} from "../../src/lib/catalogo/validacion.mjs";

/* ------------------------------------------------------------ carpeta del skill */

/**
 * Valida la carpeta de un skill de Drive:
 *   SKILL.md con frontmatter name y description (name = slug de la ficha)
 *   ficha.json con es y en, sin em dashes ni palabras prohibidas
 *   <slug> - SKILL - V<version>.skill (opcional si no se publica)
 *   demo/demo.mp4 y demo/poster.jpg (opcionales), dentro de los limites
 */
export function validateSkillFolder(dir) {
  const errors = [];
  const warnings = [];
  const files = { package: null, mp4: null, jpg: null };
  let ficha = null;

  if (!existsSync(dir) || !statSync(dir).isDirectory()) return { errors: [`no existe la carpeta ${dir}`], warnings, ficha, files };

  const fichaPath = path.join(dir, "ficha.json");
  if (!existsSync(fichaPath)) errors.push("falta ficha.json");
  else {
    try {
      ficha = JSON.parse(readFileSync(fichaPath, "utf8"));
      errors.push(...validateFicha(ficha).map((e) => `ficha.json ${e}`));
    } catch (err) {
      errors.push(`ficha.json no es JSON valido: ${err.message}`);
    }
  }

  const skillMd = path.join(dir, "SKILL.md");
  if (!existsSync(skillMd)) errors.push("falta SKILL.md");
  else {
    errors.push(...skillMdProblems(readFileSync(skillMd, "utf8"), ficha?.slug));
  }

  if (ficha && isStr(ficha.slug) && isStr(ficha.version)) {
    const want = packageName(ficha.slug, ficha.version);
    const pkg = path.join(dir, want);
    if (existsSync(pkg)) {
      const size = statSync(pkg).size;
      if (size > LIMITS.pkg) errors.push(`${want} pesa ${size} bytes (maximo ${Math.floor(LIMITS.pkg)})`);
      errors.push(...packageProblems(readFileSync(pkg), ficha.slug));
      files.package = pkg;
    } else {
      const others = readdirSync(dir).filter((n) => n.endsWith(".skill"));
      if (others.length) errors.push(`no encuentro «${want}»; hay ${others.join(", ")} (¿la version no coincide con la ficha?)`);
      else warnings.push(`no hay paquete «${want}»: se puede subir oculto, pero no publicar`);
    }
  }

  for (const [key, file, max] of [["mp4", "demo/demo.mp4", LIMITS.mp4], ["jpg", "demo/poster.jpg", LIMITS.jpg]]) {
    const p = path.join(dir, file);
    if (!existsSync(p)) {
      warnings.push(`sin ${file}: la tarjeta sale con «Demo en camino»`);
      continue;
    }
    const size = statSync(p).size;
    if (size > max) errors.push(`${file} pesa ${size} bytes (maximo ${Math.floor(max)})`);
    files[key] = p;
  }

  return { errors, warnings, ficha, files };
}

/* ------------------------------------------------------------ catalogo de skills */

/** Revisa skills.json completo (lo mismo que el sitio revisa al cargar). */
export function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || !Array.isArray(catalog.categories) || !Array.isArray(catalog.bundles) || !Array.isArray(catalog.skills)) {
    return ["skills.json: faltan categories, bundles o skills"];
  }
  const cats = new Set();
  for (const c of catalog.categories) {
    if (!c || !isStr(c.slug) || !SLUG_RE.test(c.slug)) errors.push("categoria sin slug valido");
    else if (cats.has(c.slug)) errors.push(`categoria repetida: ${c.slug}`);
    else cats.add(c.slug);
    if (!ACCESS_POLICIES.includes(c?.access)) errors.push(`categoria ${c?.slug}: access debe ser ${ACCESS_POLICIES.join(" o ")}`);
    if (!Number.isInteger(c?.order)) errors.push(`categoria ${c?.slug}: order entero`);
    if (!c || !isBiStr(c.name) || !isBiStr(c.body) || !isBiStr(c.kicker)) errors.push(`categoria ${c?.slug}: name, body y kicker con es y en`);
    errors.push(...copyProblems(c, `categoria ${c?.slug}`));
  }
  const slugs = new Set();
  for (const b of catalog.bundles) {
    if (slugs.has(b?.slug)) errors.push(`slug repetido: ${b?.slug}`);
    slugs.add(b?.slug);
    if (!cats.has(b?.category)) errors.push(`bundle ${b?.slug}: categoria ${b?.category} no existe`);
    if (!STATUSES.includes(b?.status)) errors.push(`bundle ${b?.slug}: estado invalido`);
  }
  for (const s of catalog.skills) {
    if (slugs.has(s?.slug)) errors.push(`slug repetido: ${s?.slug}`);
    slugs.add(s?.slug);
    if (!STATUSES.includes(s?.status)) errors.push(`${s?.slug}: estado invalido «${s?.status}»`);
    if (s?.ficha?.slug !== s?.slug) errors.push(`${s?.slug}: el slug de la ficha no coincide`);
    errors.push(...validateFicha(s?.ficha).map((e) => `${s?.slug}: ${e}`));
    if (!cats.has(s?.ficha?.category)) errors.push(`${s?.slug}: categoria ${s?.ficha?.category} no existe`);
  }
  return errors;
}

/**
 * Agrega o actualiza un skill en el catalogo (funcion pura: devuelve un catalogo nuevo).
 * status: el que se pida; si no, el que ya tenia; si es nuevo, hidden.
 * Si la categoria no existe y la ficha trae category_copy, la crea con la regla «pro».
 */
export function upsertSkill(catalog, rawFicha, { status } = {}) {
  const { category_copy: categoryCopy, ...ficha } = rawFicha;
  const next = structuredClone(catalog);
  const existing = next.skills.find((s) => s.slug === ficha.slug);
  const finalStatus = status ?? existing?.status ?? "hidden";
  if (!STATUSES.includes(finalStatus)) throw new Error(`estado invalido: ${finalStatus}`);

  let createdCategory = false;
  if (!next.categories.some((c) => c.slug === ficha.category)) {
    if (!categoryCopy) {
      throw new Error(
        `la categoria «${ficha.category}» no existe. Usa una de: ${next.categories.map((c) => c.slug).join(", ")}, ` +
          "o agrega category_copy (name, body y kicker con es y en) en la ficha para crearla",
      );
    }
    const order = Math.max(0, ...next.categories.map((c) => c.order)) + 1;
    next.categories.push({ slug: ficha.category, order, access: "pro", bundle: null, kicker: categoryCopy.kicker, name: categoryCopy.name, body: categoryCopy.body });
    createdCategory = true;
  }

  const entry = { slug: ficha.slug, status: finalStatus, ficha };
  if (existing) next.skills[next.skills.indexOf(existing)] = entry;
  else next.skills.push(entry);
  return { catalog: next, created: !existing, previousStatus: existing?.status ?? null, status: finalStatus, createdCategory };
}

export function setStatus(list, slug, status, kind = "skill") {
  if (!STATUSES.includes(status)) throw new Error(`estado invalido: ${status} (usa ${STATUSES.join(", ")})`);
  const item = list.find((x) => x.slug === slug);
  if (!item) throw new Error(`no hay ningun ${kind} con slug «${slug}»`);
  const previous = item.status;
  item.status = status;
  return previous;
}

/* ------------------------------------------------------------ assets */

/** Lo que hay en disco para cada skill y bundle del catalogo, con pesos revisados. */
export function buildAssets(root, catalog) {
  const errors = [];
  const demos = {};
  const packages = {};
  const size = (p) => (existsSync(p) ? statSync(p).size : null);

  for (const { slug } of catalog.skills) {
    const m = size(path.join(root, PATHS.demos, `${slug}.mp4`));
    const j = size(path.join(root, PATHS.demos, `${slug}.jpg`));
    if (m !== null && m > LIMITS.mp4) errors.push(`${slug}.mp4 pesa ${m} bytes (maximo ${LIMITS.mp4})`);
    if (j !== null && j > LIMITS.jpg) errors.push(`${slug}.jpg pesa ${j} bytes (maximo ${LIMITS.jpg})`);
    /* Regla 16 (Victor, 6 nov 2026): cada skill lleva video y 2 imagenes de ejemplo. El poster es
     * la primera; las demas van en <slug>-ejemplo-1.jpg ... -4.jpg, con el mismo limite de peso. */
    let ejemplos = 0;
    for (let n = 1; n <= 4; n++) {
      const e = size(path.join(root, PATHS.demos, `${slug}-ejemplo-${n}.jpg`));
      if (e === null) break;
      if (e > LIMITS.jpg) errors.push(`${slug}-ejemplo-${n}.jpg pesa ${e} bytes (maximo ${LIMITS.jpg})`);
      ejemplos = n;
    }
    if (m !== null || j !== null || ejemplos) demos[slug] = { mp4: m !== null, jpg: j !== null, ...(ejemplos ? { ejemplos } : {}) };
  }
  const pkgs = [...catalog.skills.map((s) => [s.slug, `${s.slug}.skill`]), ...catalog.bundles.map((b) => [b.slug, `${b.slug}.zip`])];
  for (const [slug, file] of pkgs) {
    const p = path.join(root, PATHS.packages, file);
    const s = size(p);
    if (s === null) continue;
    if (s > LIMITS.pkg) errors.push(`${file} pesa ${s} bytes (maximo ${Math.floor(LIMITS.pkg)})`);
    packages[slug] = { bytes: s, sha256: createHash("sha256").update(readFileSync(p)).digest("hex") };
  }
  return { assets: { generatedAt: new Date().toISOString(), demos, packages }, errors };
}

export function readJson(root, rel) {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8"));
}

export function writeJson(root, rel, data) {
  writeFileSync(path.join(root, rel), JSON.stringify(data, null, 2) + "\n");
}

/** Regenera assets.json. Lanza sin escribir si algo se pasa de peso. */
export function writeAssets(root, catalog = readJson(root, PATHS.skills)) {
  const { assets, errors } = buildAssets(root, catalog);
  if (errors.length) throw new Error("no se escribio assets.json\n  - " + errors.join("\n  - "));
  writeJson(root, PATHS.assets, assets);
  return assets;
}

/**
 * Sube un skill de una carpeta de Drive al repo en `root`: valida, copia paquete y demos,
 * lo registra en skills.json y regenera assets.json. Con dryRun solo valida y dice que haria.
 */
/** @param {{ root: string, dir: string, status?: string, dryRun?: boolean }} opts */
export function addSkill({ root, dir, status, dryRun = false }) {
  const v = validateSkillFolder(dir);
  if (v.errors.length) return { ok: false, errors: v.errors, warnings: v.warnings };

  const catalog = readJson(root, PATHS.skills);
  let result;
  try {
    result = upsertSkill(catalog, v.ficha, { status });
  } catch (err) {
    return { ok: false, errors: [err.message], warnings: v.warnings };
  }
  if (result.status === "published" && !v.files.package) {
    return { ok: false, errors: [`no se puede publicar sin paquete «${packageName(v.ficha.slug, v.ficha.version)}»`], warnings: v.warnings };
  }
  const catErrors = validateCatalog(result.catalog);
  if (catErrors.length) return { ok: false, errors: catErrors, warnings: v.warnings };

  const slug = v.ficha.slug;
  const copies = [];
  if (v.files.package) copies.push([v.files.package, path.join(PATHS.packages, `${slug}.skill`)]);
  if (v.files.mp4) copies.push([v.files.mp4, path.join(PATHS.demos, `${slug}.mp4`)]);
  if (v.files.jpg) copies.push([v.files.jpg, path.join(PATHS.demos, `${slug}.jpg`)]);

  if (!dryRun) {
    for (const [from, to] of copies) {
      mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
      copyFileSync(from, path.join(root, to));
    }
    writeJson(root, PATHS.skills, result.catalog);
    writeAssets(root, result.catalog);
  }
  return {
    ok: true,
    errors: [],
    warnings: v.warnings,
    slug,
    created: result.created,
    previousStatus: result.previousStatus,
    status: result.status,
    createdCategory: result.createdCategory,
    copies: copies.map(([, to]) => to),
  };
}

/* ------------------------------------------------------------ mods */

/** Agrega o actualiza un mod (funcion pura). Nuevo sin estado pedido: hidden. */
export function upsertMod(manifest, raw, { status } = {}) {
  const next = structuredClone(manifest);
  const existing = next.mods.find((m) => m.slug === raw.slug);
  const clash = next.mods.find((m) => m.code === raw.code && m.slug !== raw.slug);
  if (clash) throw new Error(`el codigo ${raw.code} ya es de «${clash.slug}»`);
  const finalStatus = status ?? existing?.status ?? "hidden";
  if (!STATUSES.includes(finalStatus)) throw new Error(`estado invalido: ${finalStatus}`);
  const entry = {
    code: raw.code,
    slug: raw.slug,
    name: raw.name,
    status: finalStatus,
    releaseDate: raw.releaseDate,
    version: raw.version,
    author: raw.author,
    license: raw.license,
    copy: raw.copy,
  };
  if (existing) next.mods[next.mods.indexOf(existing)] = entry;
  else next.mods.push(entry);
  return { manifest: next, created: !existing, previousStatus: existing?.status ?? null, status: finalStatus };
}
