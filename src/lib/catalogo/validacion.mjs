/* Reglas de validacion del catalogo de skills y mods (2026-11-05). Un solo lugar para las dos
 * vias de subida:
 *   - scripts/lib/catalogo.mjs (add-skill.mjs y add-mod.mjs, en una rama con PR)
 *   - /admin/skills (POST /api/admin/skills/subir, en produccion y sin PR)
 * Si una regla cambia aqui, cambia para las dos. Solo Node, sin dependencias y sin tocar
 * disco: recibe objetos y Buffers. */

import { inflateRawSync } from "node:zlib";

export const STATUSES = ["published", "coming_soon", "hidden"];
export const ACCESS_POLICIES = ["edit-bundle-1", "pro", "cuenta"];

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

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** @param {unknown} v @returns {v is string} */
export const isStr = (v) => typeof v === "string" && v.trim().length > 0;
/** @param {any} v */
export const isBiStr = (v) => !!v && isStr(v.es) && isStr(v.en);
/** @param {any} v */
export const isBiList = (v) =>
  !!v && Array.isArray(v.es) && Array.isArray(v.en) && v.es.length > 0 && v.en.length > 0 && [...v.es, ...v.en].every(isStr);

/* ------------------------------------------------------------ textos */

/** Recorre todos los textos y devuelve donde hay em dash o palabra prohibida. */
/** @param {unknown} value @param {string} [where] @returns {string[]} */
export function copyProblems(value, where = "ficha") {
  /** @type {string[]} */
  const out = [];
  /** @param {unknown} v @param {string} at */
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

/** Revisa el SKILL.md: frontmatter con name (= slug de la ficha) y description. */
/** @param {string} text @param {unknown} slug @returns {string[]} */
export function skillMdProblems(text, slug) {
  const fm = parseFrontmatter(text);
  if (!fm) return ["SKILL.md sin frontmatter (--- name / description ---)"];
  const out = [];
  if (!isStr(fm.name)) out.push("SKILL.md: falta name en el frontmatter");
  if (!isStr(fm.description)) out.push("SKILL.md: falta description en el frontmatter");
  if (isStr(fm.name) && isStr(slug) && fm.name !== slug) out.push(`SKILL.md: name «${fm.name}» no coincide con el slug de la ficha «${slug}»`);
  return out;
}

/* ------------------------------------------------------------ ficha */

/** Revisa la ficha.json de un skill: forma, ES y EN completos, y reglas de escritura. */
/** @param {any} raw @returns {string[]} */
export function validateFicha(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ["ficha.json no es un objeto"];
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

/** @param {Buffer} buf */
function findEocd(buf) {
  const EOCD = 0x06054b50;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD) return i;
  }
  throw new Error("no es un zip valido");
}

/**
 * Entradas del directorio central: nombre, metodo, tamanos y donde empieza su cabecera local.
 * @param {Buffer} buf
 * @returns {{ name: string, method: number, compressed: number, size: number, offset: number }[]}
 */
function zipCentral(buf) {
  if (buf.length < 22) throw new Error("no es un zip valido");
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error("directorio central del zip roto");
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    out.push({
      name: buf.subarray(p + 46, p + 46 + nameLen).toString("utf8"),
      method: buf.readUInt16LE(p + 10),
      compressed: buf.readUInt32LE(p + 20),
      size: buf.readUInt32LE(p + 24),
      offset: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Nombres de archivo dentro de un zip, leidos del directorio central. Lanza si no es un zip. */
/** @param {Buffer} buf @returns {string[]} */
export function zipEntries(buf) {
  return zipCentral(buf).map((e) => e.name);
}

/* Un SKILL.md de mas de 1 MB no es un SKILL.md: se corta antes de descomprimir. */
const MAX_TEXT_ENTRY = 1024 * 1024;

/**
 * Lee un archivo de texto del zip (sin comprimir o deflate). null si no esta.
 * Lanza si la entrada esta rota, usa otro metodo o pesa demasiado.
 * @param {Buffer} buf @param {string} name @returns {string | null}
 */
export function zipReadText(buf, name) {
  const e = zipCentral(buf).find((x) => x.name === name);
  if (!e) return null;
  if (e.size > MAX_TEXT_ENTRY || e.compressed > MAX_TEXT_ENTRY) throw new Error(`${name} pesa demasiado`);
  const p = e.offset;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) throw new Error(`cabecera de ${name} rota`);
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(start, start + e.compressed);
  if (data.length !== e.compressed) throw new Error(`${name} esta cortado`);
  if (e.method === 0) return data.toString("utf8");
  if (e.method === 8) return inflateRawSync(data, { maxOutputLength: MAX_TEXT_ENTRY }).toString("utf8");
  throw new Error(`${name} usa una compresion que no se lee (metodo ${e.method})`);
}

/** Revisa el contenido del .skill: carpeta <slug>/ con SKILL.md, sin demo/, ficha.json ni .DS_Store. */
/** @param {Buffer} buf @param {string} slug @returns {string[]} */
export function packageProblems(buf, slug) {
  let names;
  try {
    names = zipEntries(buf);
  } catch (err) {
    return [`el paquete ${/** @type {Error} */ (err).message}`];
  }
  const out = [];
  if (!names.includes(`${slug}/SKILL.md`)) out.push(`el paquete no trae ${slug}/SKILL.md (va la carpeta del skill adentro)`);
  const extra = names.filter((n) => /(^|\/)\.DS_Store$|(^|\/)demo\/|(^|\/)ficha\.json$|^__MACOSX\//.test(n));
  if (extra.length) out.push(`el paquete trae archivos que no van (demo/, ficha.json, .DS_Store o __MACOSX): ${extra.slice(0, 5).join(", ")}`);
  const outside = names.filter((n) => !n.startsWith(`${slug}/`));
  const unsafe = names.filter((n) => n.split("/").includes("..") || n.startsWith("/") || n.includes("\\"));
  if (unsafe.length) out.push(`el paquete trae rutas no permitidas (.., absolutas o con \\): ${unsafe.slice(0, 5).join(", ")}`);
  if (outside.length) out.push(`el paquete trae archivos fuera de ${slug}/: ${outside.slice(0, 5).join(", ")}`);
  return out;
}

/* ------------------------------------------------------------ subida por /admin */

/**
 * Lo que /admin/skills revisa antes de guardar un skill: las mismas reglas que add-skill.mjs
 * aplica a una carpeta de Drive, pero sobre la ficha y el .skill que llegan en el formulario.
 * El SKILL.md se lee de adentro del paquete (<slug>/SKILL.md).
 *   - ficha valida (validateFicha), sin category_copy: las categorias nuevas solo entran por PR
 *   - categoria que ya existe (la regla de descarga es la de su categoria)
 *   - paquete dentro del peso, limpio (packageProblems) y con SKILL.md valido (skillMdProblems)
 * @param {{ ficha: any, pkg: Buffer | null, categories: string[] }} input
 * @returns {string[]}
 */
export function validateSkillUpload({ ficha, pkg, categories }) {
  const errors = validateFicha(ficha).map((e) => `ficha.json ${e}`);
  if (errors.length) return errors;
  if (ficha.category_copy !== undefined) {
    errors.push("ficha.json: category_copy no va aqui. Una categoria nueva se crea con scripts/add-skill.mjs en un PR (su regla de descarga la decide Victor)");
  }
  if (!categories.includes(ficha.category)) {
    errors.push(`ficha.json: la categoria «${ficha.category}» no existe. Usa una de: ${categories.join(", ")}`);
  }
  if (!pkg || pkg.length === 0) {
    errors.push(`falta el paquete «${packageName(ficha.slug, ficha.version)}»`);
    return errors;
  }
  if (pkg.length > LIMITS.pkg) {
    errors.push(`el paquete pesa ${pkg.length} bytes (maximo ${Math.floor(LIMITS.pkg)})`);
    return errors;
  }
  const pp = packageProblems(pkg, ficha.slug);
  errors.push(...pp);
  if (pp.length === 0) {
    let md = null;
    try {
      md = zipReadText(pkg, `${ficha.slug}/SKILL.md`);
    } catch (err) {
      errors.push(`no pude leer ${ficha.slug}/SKILL.md del paquete: ${/** @type {Error} */ (err).message}`);
    }
    if (md !== null) errors.push(...skillMdProblems(md, ficha.slug));
  }
  return errors;
}

/** Nombre del paquete segun el contrato de Drive. */
/** @param {string} slug @param {string} version */
export const packageName = (slug, version) => `${slug} - SKILL - V${version}.skill`;

/* ------------------------------------------------------------ mods */

/** Revisa la ficha de un mod (la misma forma que una entrada de mods.json). */
/** @param {any} raw @returns {string[]} */
export function validateMod(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ["el mod no es un objeto"];
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

/**
 * Lo que /admin/skills revisa antes de guardar un mod: la ficha (validateMod) y, si trae
 * archivo, que sea un zip legible dentro del peso.
 * @param {{ mod: any, file: Buffer | null }} input
 * @returns {string[]}
 */
export function validateModUpload({ mod, file }) {
  const errors = validateMod(mod).map((e) => `mod.json ${e}`);
  if (file && file.length > 0) {
    if (file.length > LIMITS.pkg) errors.push(`el archivo pesa ${file.length} bytes (maximo ${Math.floor(LIMITS.pkg)})`);
    else {
      try {
        if (zipEntries(file).length === 0) errors.push("el archivo es un zip vacio");
      } catch (err) {
        errors.push(`el archivo ${/** @type {Error} */ (err).message}`);
      }
    }
  }
  return errors;
}
