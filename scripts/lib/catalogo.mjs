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

export const STATUSES = ["published", "coming_soon", "hidden"];
export const ACCESS_POLICIES = ["edit-bundle-1", "pro"];

/* Limites del contrato del bundle: demo 1.5 MB, poster 150 KB, paquete 4.4 MB (la respuesta de
 * una funcion de Vercel no pasa de 4.5 MB). */
export const LIMITS = { mp4: 1.5 * 1024 * 1024, jpg: 150 * 1024, pkg: 4.4 * 1024 * 1024 };

/* Reglas de escritura de ASAI (CLAUDE.md de Drive). Se buscan en minusculas, como en las
 * pruebas del bundle. */
export const FORBIDDEN_WORDS = [
  "leverage", "empower", "revolutionize", "seamless", "robust", "holistic", "cutting-edge",
  "next-generation", "ecosystem", "disruptive", "synergy", "scalable", "optimize", "elevate",
  "delve", "foster", "paradigm shift", "game-changer", "actionable insights",
];
export const EM_DASH = "\u2014";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isBiStr = (v) => !!v && isStr(v.es) && isStr(v.en);
const isBiList = (v) =>
  !!v && Array.isArray(v.es) && Array.isArray(v.en) && v.es.length > 0 && v.en.length > 0 && [...v.es, ...v.en].every(isStr);

/* ------------------------------------------------------------ textos */

/** Recorre todos los textos y devuelve donde hay em dash o palabra prohibida. */
export function copyProblems(value, where = "ficha") {
  const out = [];
  const walk = (v, at) => {
    if (typeof v === "string") {
      if (v.includes(EM_DASH)) out.push(`${at}: lleva em dash (U+2014)`);
      const low = v.toLowerCase();
      for (const w of FORBIDDEN_WORDS) if (low.includes(w)) out.push(`${at}: palabra prohibida «${w}»`);
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${at}[${i}]`));
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`);
    }
  };
  walk(value, where);
  return out;
}

/** Lee el frontmatter de un SKILL.md. Acepta valores en una linea, entre comillas o en bloque (> o |). */
/** @param {string} text @returns {Record<string, string> | null} */
export function parseFrontmatter(text) {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(text);
  if (!m) return null;
  /** @type {Record<string, string>} */
  const data = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value === "" || value === ">" || value === "|" || value === ">-" || value === "|-") {
      const block = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
      value = block.join(value.startsWith("|") ? "\n" : " ");
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[kv[1]] = value;
  }
  return data;
}

/* ------------------------------------------------------------ ficha */

/** Revisa la ficha.json de un skill: forma, ES y EN completos, y reglas de escritura. */
export function validateFicha(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object") return ["ficha.json no es un objeto"];
  const f = raw;
  if (!isStr(f.slug) || !SLUG_RE.test(f.slug)) errors.push("slug: minusculas, numeros y guiones (ej. arto-edit-color)");
  if (!Number.isInteger(f.order)) errors.push("order: numero entero");
  if (!isStr(f.category) || !SLUG_RE.test(f.category)) errors.push("category: slug de la categoria (ej. edicion-de-video)");
  for (const k of ["name", "tagline", "what", "time"]) if (!isBiStr(f[k])) errors.push(`${k}: falta es o en`);
  for (const k of ["you_say", "needs"]) if (!isBiList(f[k])) errors.push(`${k}: lista con al menos un texto en es y en`);
  if (!isStr(f.version)) errors.push("version: texto (ej. 1.0)");
  if (f.placeholder !== undefined && typeof f.placeholder !== "boolean") errors.push("placeholder: true o false");
  if (f.chatgpt_note !== undefined && !isBiStr(f.chatgpt_note)) errors.push("chatgpt_note: falta es o en");
  if (f.category_copy !== undefined) {
    const c = f.category_copy;
    if (!c || !isBiStr(c.name) || !isBiStr(c.body) || !isBiStr(c.kicker)) errors.push("category_copy: name, body y kicker con es y en");
  }
  errors.push(...copyProblems(f));
  return errors;
}

/* ------------------------------------------------------------ zip */

/** Nombres de archivo dentro de un zip, leidos del directorio central. Lanza si no es un zip. */
export function zipEntries(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("no es un zip valido");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error("directorio central del zip roto");
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    names.push(buf.subarray(p + 46, p + 46 + nameLen).toString("utf8"));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

/** Revisa el contenido del .skill: carpeta <slug>/ con SKILL.md, sin demo/, ficha.json ni .DS_Store. */
export function packageProblems(buf, slug) {
  let names;
  try {
    names = zipEntries(buf);
  } catch (err) {
    return [`el paquete ${err.message}`];
  }
  const out = [];
  if (!names.includes(`${slug}/SKILL.md`)) out.push(`el paquete no trae ${slug}/SKILL.md (va la carpeta del skill adentro)`);
  const extra = names.filter((n) => /(^|\/)\.DS_Store$|(^|\/)demo\/|(^|\/)ficha\.json$|^__MACOSX\//.test(n));
  if (extra.length) out.push(`el paquete trae archivos que no van (demo/, ficha.json, .DS_Store o __MACOSX): ${extra.slice(0, 5).join(", ")}`);
  const outside = names.filter((n) => !n.startsWith(`${slug}/`));
  if (outside.length) out.push(`el paquete trae archivos fuera de ${slug}/: ${outside.slice(0, 5).join(", ")}`);
  return out;
}

/* ------------------------------------------------------------ carpeta del skill */

/** Nombre del paquete segun el contrato de Drive. */
export const packageName = (slug, version) => `${slug} - SKILL - V${version}.skill`;

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
    const fm = parseFrontmatter(readFileSync(skillMd, "utf8"));
    if (!fm) errors.push("SKILL.md sin frontmatter (--- name / description ---)");
    else {
      if (!isStr(fm.name)) errors.push("SKILL.md: falta name en el frontmatter");
      if (!isStr(fm.description)) errors.push("SKILL.md: falta description en el frontmatter");
      if (isStr(fm.name) && ficha && isStr(ficha.slug) && fm.name !== ficha.slug) {
        errors.push(`SKILL.md: name «${fm.name}» no coincide con el slug de la ficha «${ficha.slug}»`);
      }
    }
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
    if (m !== null || j !== null) demos[slug] = { mp4: m !== null, jpg: j !== null };
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

/** Revisa la ficha de un mod (la misma forma que una entrada de mods.json). */
export function validateMod(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object") return ["el mod no es un objeto"];
  const m = raw;
  if (!isStr(m.code) || !/^MOD\d{2,}$/.test(m.code)) errors.push("code: MOD y dos digitos (ej. MOD02)");
  if (!isStr(m.slug) || !SLUG_RE.test(m.slug)) errors.push("slug: minusculas, numeros y guiones");
  for (const k of ["name", "version", "author", "license"]) if (!isStr(m[k])) errors.push(`${k}: texto`);
  if (!isStr(m.releaseDate) || !/^\d{4}-\d{2}-\d{2}$/.test(m.releaseDate)) errors.push("releaseDate: AAAA-MM-DD");
  if (m.status !== undefined && !STATUSES.includes(m.status)) errors.push(`status: ${STATUSES.join(", ")}`);
  for (const loc of ["es", "en"]) {
    const c = m.copy?.[loc];
    if (!c || !isStr(c.tagline) || !isStr(c.what)) errors.push(`copy.${loc}: tagline y what`);
    if (!c || !Array.isArray(c.checked) || c.checked.length === 0 || !c.checked.every(isStr)) errors.push(`copy.${loc}.checked: lista de lo revisado`);
  }
  errors.push(...copyProblems(m.copy ?? {}, "copy"));
  return errors;
}

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
