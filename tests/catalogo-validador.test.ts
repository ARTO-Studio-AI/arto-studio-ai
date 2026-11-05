import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PATHS,
  addSkill,
  copyProblems,
  packageProblems,
  parseFrontmatter,
  upsertMod,
  upsertSkill,
  validateCatalog,
  validateFicha,
  validateMod,
  validateSkillFolder,
  zipEntries,
} from "../scripts/lib/catalogo.mjs";
import realCatalog from "../src/lib/catalogo/skills.json";
import realMods from "../src/lib/catalogo/mods.json";
import * as shared from "../src/lib/catalogo/validacion.mjs";
import * as lib from "../scripts/lib/catalogo.mjs";
import { makeZip, skillPackage } from "./helpers/zip";

/* Validador de scripts/add-skill.mjs y scripts/add-mod.mjs (2026-11-05). Arma carpetas de
 * skill falsas en un directorio temporal; no toca el repo ni la red. */

const bi = <T,>(es: T, en: T) => ({ es, en });

function ficha(over: Record<string, unknown> = {}) {
  return {
    slug: "arto-prueba",
    order: 1,
    category: "edicion-de-video",
    name: bi("Prueba", "Test"),
    tagline: bi("Una linea clara.", "One clear line."),
    what: bi("Hace una cosa.", "It does one thing."),
    you_say: bi(["Hazlo"], ["Do it"]),
    needs: bi(["Claude Code"], ["Claude Code"]),
    time: bi("un minuto", "one minute"),
    version: "1.0",
    ...over,
  };
}

let work: string;

/** Carpeta de skill como la de Drive. */
function skillFolder(opts: { ficha?: Record<string, unknown>; name?: string; pkg?: Record<string, string> | null; pkgName?: string; demo?: boolean } = {}) {
  const f = opts.ficha ?? ficha();
  const slug = f.slug as string;
  const dir = path.join(work, "drive", slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "ficha.json"), JSON.stringify(f, null, 2));
  writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${opts.name ?? slug}\ndescription: "Hace una cosa. Usalo cuando pidan algo."\n---\n\n# Prueba\n`);
  if (opts.pkg !== null) {
    const files = opts.pkg ?? { [`${slug}/SKILL.md`]: "---\nname: x\n---\n", [`${slug}/scripts/run.py`]: "print(1)" };
    writeFileSync(path.join(dir, opts.pkgName ?? `${slug} - SKILL - V${f.version}.skill`), makeZip(files));
  }
  if (opts.demo) {
    mkdirSync(path.join(dir, "demo"));
    writeFileSync(path.join(dir, "demo", "demo.mp4"), Buffer.alloc(1000));
    writeFileSync(path.join(dir, "demo", "poster.jpg"), Buffer.alloc(100));
  }
  return dir;
}

/** Repo minimo: catalogo con la categoria del bundle y sin skills. */
function fakeRepo() {
  const root = path.join(work, "repo");
  mkdirSync(path.join(root, "src/lib/catalogo"), { recursive: true });
  const catalog = { categories: realCatalog.categories, bundles: [], skills: [] };
  writeFileSync(path.join(root, PATHS.skills), JSON.stringify(catalog, null, 2));
  return root;
}
const readCatalog = (root: string) => JSON.parse(readFileSync(path.join(root, PATHS.skills), "utf8"));

beforeEach(() => {
  work = mkdtempSync(path.join(tmpdir(), "asai-catalogo-"));
});
afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("reglas de escritura", () => {
  it("encuentra em dashes y palabras prohibidas con el campo", () => {
    const p = copyProblems({ what: { es: "Rapido \u2014 y bien", en: "A seamless tool" } });
    expect(p).toContain("ficha.what.es: lleva em dash (U+2014)");
    expect(p).toContain("ficha.what.en: palabra prohibida «seamless»");
    expect(copyProblems({ a: ["todo bien"] })).toEqual([]);
  });
});

describe("frontmatter de SKILL.md", () => {
  it("lee name y description en linea, entre comillas y en bloque", () => {
    expect(parseFrontmatter('---\nname: arto-x\ndescription: "Hace algo: bien."\n---\n# X')).toEqual({ name: "arto-x", description: "Hace algo: bien." });
    expect(parseFrontmatter("---\nname: arto-x\ndescription: >\n  Linea uno\n  linea dos\n---\n")?.description).toBe("Linea uno linea dos");
    expect(parseFrontmatter("# sin frontmatter")).toBeNull();
  });
});

describe("ficha.json", () => {
  it("las 9 fichas del bundle pasan", () => {
    for (const s of realCatalog.skills) expect(validateFicha(s.ficha), s.slug).toEqual([]);
  });

  it("pide es y en en cada texto", () => {
    const errs = validateFicha(ficha({ tagline: { es: "Solo espanol" } }));
    expect(errs).toContain("tagline: falta es o en");
    expect(validateFicha(ficha({ you_say: bi<string[]>([], ["x"]) }))).toContain("you_say: lista con al menos un texto en es y en");
  });

  it("rechaza slug con mayusculas o rutas", () => {
    expect(validateFicha(ficha({ slug: "../x" }))[0]).toMatch(/^slug/);
    expect(validateFicha(ficha({ slug: "Arto-X" }))[0]).toMatch(/^slug/);
  });

  it("rechaza em dashes y palabras prohibidas", () => {
    const errs = validateFicha(ficha({ what: bi("Hace todo \u2014 rapido", "We optimize it") }));
    expect(errs.some((e: string) => e.includes("em dash"))).toBe(true);
    expect(errs.some((e: string) => e.includes("«optimize»"))).toBe(true);
  });
});

describe("paquete .skill", () => {
  it("lee los nombres del zip", () => {
    expect(zipEntries(makeZip({ "a/SKILL.md": "x", "a/b.txt": "y" }))).toEqual(["a/SKILL.md", "a/b.txt"]);
    expect(() => zipEntries(Buffer.from("no soy zip"))).toThrow(/zip/);
  });

  it("pide la carpeta del skill con SKILL.md y nada de demo, ficha ni .DS_Store", () => {
    expect(packageProblems(makeZip({ "arto-x/SKILL.md": "x" }), "arto-x")).toEqual([]);
    expect(packageProblems(makeZip({ "SKILL.md": "x" }), "arto-x").join()).toMatch(/no trae arto-x\/SKILL.md/);
    expect(packageProblems(makeZip({ "arto-x/SKILL.md": "x", "arto-x/demo/demo.mp4": "v" }), "arto-x").join()).toMatch(/no van/);
    expect(packageProblems(makeZip({ "arto-x/SKILL.md": "x", "arto-x/.DS_Store": "" }), "arto-x").join()).toMatch(/no van/);
    expect(packageProblems(makeZip({ "arto-x/SKILL.md": "x", "arto-x/../x.sh": "y" }), "arto-x").join()).toMatch(/rutas no permitidas/);
    expect(packageProblems(makeZip({ "arto-x/SKILL.md": "x", "arto-x/a\\b.txt": "y" }), "arto-x").join()).toMatch(/rutas no permitidas/);
  });
});

describe("carpeta del skill", () => {
  it("una carpeta completa pasa sin errores", () => {
    const v = validateSkillFolder(skillFolder({ demo: true }));
    expect(v.errors).toEqual([]);
    expect(v.files.package).toMatch(/arto-prueba - SKILL - V1\.0\.skill$/);
    expect(v.files.mp4).toBeTruthy();
  });

  it("name del SKILL.md tiene que ser el slug de la ficha", () => {
    expect(validateSkillFolder(skillFolder({ name: "otro-nombre" })).errors.join()).toMatch(/no coincide/);
  });

  it("un paquete de otra version es error, no se sube viejo", () => {
    const v = validateSkillFolder(skillFolder({ pkgName: "arto-prueba - SKILL - V0.9.skill" }));
    expect(v.errors.join()).toMatch(/no encuentro «arto-prueba - SKILL - V1\.0\.skill»/);
  });

  it("sin paquete solo avisa (se puede subir oculto)", () => {
    const v = validateSkillFolder(skillFolder({ pkg: null }));
    expect(v.errors).toEqual([]);
    expect(v.warnings.join()).toMatch(/no hay paquete/);
  });

  it("sin ficha.json o sin SKILL.md no pasa", () => {
    const dir = skillFolder();
    rmSync(path.join(dir, "ficha.json"));
    expect(validateSkillFolder(dir).errors).toContain("falta ficha.json");
  });
});

describe("addSkill", () => {
  it("un skill nuevo entra oculto, con paquete, demo y assets", () => {
    const root = fakeRepo();
    const r = addSkill({ root, dir: skillFolder({ demo: true }) });
    expect(r.ok).toBe(true);
    expect(r.status).toBe("hidden");
    expect(r.created).toBe(true);
    const cat = readCatalog(root);
    expect(cat.skills).toHaveLength(1);
    expect(cat.skills[0]).toMatchObject({ slug: "arto-prueba", status: "hidden" });
    expect(existsSync(path.join(root, "private/skills/arto-prueba.skill"))).toBe(true);
    expect(existsSync(path.join(root, "public/skills/demos/arto-prueba.mp4"))).toBe(true);
    const assets = JSON.parse(readFileSync(path.join(root, PATHS.assets), "utf8"));
    expect(assets.packages["arto-prueba"].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(assets.demos["arto-prueba"]).toEqual({ mp4: true, jpg: true });
  });

  it("--publish lo publica y una actualizacion sin bandera conserva el estado", () => {
    const root = fakeRepo();
    const dir = skillFolder();
    expect(addSkill({ root, dir, status: "published" }).status).toBe("published");
    const again = addSkill({ root, dir });
    expect(again).toMatchObject({ ok: true, created: false, previousStatus: "published", status: "published" });
    expect(readCatalog(root).skills).toHaveLength(1);
  });

  it("no publica sin paquete", () => {
    const root = fakeRepo();
    const r = addSkill({ root, dir: skillFolder({ pkg: null }), status: "published" });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/sin paquete/);
    expect(readCatalog(root).skills).toHaveLength(0);
  });

  it("dry-run no escribe nada", () => {
    const root = fakeRepo();
    const r = addSkill({ root, dir: skillFolder(), dryRun: true });
    expect(r.ok).toBe(true);
    expect(readCatalog(root).skills).toHaveLength(0);
    expect(existsSync(path.join(root, "private/skills/arto-prueba.skill"))).toBe(false);
  });

  it("una carpeta con errores no toca el repo", () => {
    const root = fakeRepo();
    const r = addSkill({ root, dir: skillFolder({ ficha: ficha({ what: bi("Uno \u2014 dos", "One two") }) }) });
    expect(r.ok).toBe(false);
    expect(readCatalog(root).skills).toHaveLength(0);
  });

  it("categoria nueva: sin category_copy es error; con category_copy se crea con la regla pro", () => {
    const root = fakeRepo();
    const nextOrder = Math.max(...readCatalog(root).categories.map((c: { order: number }) => c.order)) + 1;
    const sinCopy = addSkill({ root, dir: skillFolder({ ficha: ficha({ category: "estrategia" }) }) });
    expect(sinCopy.ok).toBe(false);
    expect(sinCopy.errors.join()).toMatch(/categoria «estrategia» no existe/);

    const copy = { name: bi("Estrategia", "Strategy"), body: bi("Skills de marca.", "Brand skills."), kicker: bi("Marca", "Brand") };
    const conCopy = addSkill({ root, dir: skillFolder({ ficha: ficha({ category: "estrategia", category_copy: copy }) }) });
    expect(conCopy.ok).toBe(true);
    expect(conCopy.createdCategory).toBe(true);
    const cat = readCatalog(root);
    expect(cat.categories.find((c: { slug: string }) => c.slug === "estrategia")).toMatchObject({ access: "pro", bundle: null, order: nextOrder });
    expect(cat.skills[0].ficha.category_copy).toBeUndefined();
  });
});

describe("catalogo real", () => {
  it("skills.json del repo pasa la validacion del script", () => {
    expect(validateCatalog(realCatalog)).toEqual([]);
  });

  it("upsertSkill no muta el original y rechaza estados inventados", () => {
    const before = JSON.stringify(realCatalog);
    upsertSkill(realCatalog, ficha());
    expect(JSON.stringify(realCatalog)).toBe(before);
    expect(() => upsertSkill(realCatalog, ficha(), { status: "publicado" })).toThrow(/estado invalido/);
  });
});

describe("mods", () => {
  const mod01 = realMods.mods[0];

  it("MOD01 del repo pasa", () => {
    expect(validateMod(mod01)).toEqual([]);
  });

  it("revisa codigo, fecha, textos y reglas de escritura", () => {
    expect(validateMod({ ...mod01, code: "M1" }).join()).toMatch(/code/);
    expect(validateMod({ ...mod01, releaseDate: "9 nov" }).join()).toMatch(/releaseDate/);
    const copy = { ...mod01.copy, en: { ...mod01.copy.en, what: "A robust plugin" } };
    expect(validateMod({ ...mod01, copy }).join()).toMatch(/«robust»/);
  });

  it("un mod nuevo entra oculto y no puede robar un codigo", () => {
    const nuevo = { ...mod01, code: "MOD02", slug: "otro-mod" };
    const r = upsertMod(realMods, nuevo);
    expect(r.status).toBe("hidden");
    expect(r.manifest.mods).toHaveLength(2);
    expect(() => upsertMod(realMods, { ...nuevo, code: "MOD01" })).toThrow(/ya es de «auto-handoff»/);
  });
});

/* Subida desde /admin/skills (2026-11-05): misma validacion que el script, desde el modulo
 * compartido src/lib/catalogo/validacion.mjs. */
describe("validacion compartida con /admin", () => {
  const CATS = realCatalog.categories.map((c) => c.slug);

  it("el script y el admin usan las mismas funciones (no hay reglas duplicadas)", () => {
    for (const fn of ["validateFicha", "validateMod", "packageProblems", "copyProblems", "parseFrontmatter", "zipEntries", "skillMdProblems"] as const) {
      expect(lib[fn], fn).toBe(shared[fn]);
    }
    expect(lib.LIMITS).toBe(shared.LIMITS);
  });

  it("un skill bien armado pasa, sin comprimir y con deflate", () => {
    expect(shared.validateSkillUpload({ ficha: ficha(), pkg: skillPackage("arto-prueba"), categories: CATS })).toEqual([]);
    expect(shared.validateSkillUpload({ ficha: ficha(), pkg: skillPackage("arto-prueba", { deflate: true }), categories: CATS })).toEqual([]);
  });

  it("aplica las mismas reglas de la ficha que add-skill.mjs", () => {
    const bad = ficha({ what: bi("Rapido \u2014 y bien", "A seamless tool") });
    const errors = shared.validateSkillUpload({ ficha: bad, pkg: skillPackage("arto-prueba"), categories: CATS });
    expect(errors).toEqual(validateFicha(bad).map((e) => `ficha.json ${e}`));
    expect(errors.length).toBeGreaterThan(0);
  });

  it("lee el SKILL.md de adentro del paquete: name tiene que ser el slug", () => {
    const errors = shared.validateSkillUpload({ ficha: ficha(), pkg: skillPackage("arto-prueba", { name: "otro" }), categories: CATS });
    expect(errors).toContain("SKILL.md: name «otro» no coincide con el slug de la ficha «arto-prueba»");
    const noFm = makeZip({ "arto-prueba/SKILL.md": "# sin frontmatter" });
    expect(shared.validateSkillUpload({ ficha: ficha(), pkg: noFm, categories: CATS })).toContain("SKILL.md sin frontmatter (--- name / description ---)");
  });

  it("paquete sucio, ajeno, roto, ausente o pesado: no pasa", () => {
    const dirty = makeZip({ "arto-prueba/SKILL.md": "x", "arto-prueba/.DS_Store": "", "otro/SKILL.md": "x" });
    const e1 = shared.validateSkillUpload({ ficha: ficha(), pkg: dirty, categories: CATS });
    expect(e1.join(" ")).toMatch(/no van/);
    expect(e1.join(" ")).toMatch(/fuera de arto-prueba/);
    expect(shared.validateSkillUpload({ ficha: ficha(), pkg: Buffer.from("no es zip"), categories: CATS })[0]).toMatch(/no es un zip/);
    expect(shared.validateSkillUpload({ ficha: ficha(), pkg: null, categories: CATS })[0]).toMatch(/falta el paquete/);
    const big = Buffer.alloc(Math.floor(shared.LIMITS.pkg) + 1);
    expect(shared.validateSkillUpload({ ficha: ficha(), pkg: big, categories: CATS })[0]).toMatch(/maximo 4613734/);
  });

  it("no crea categorias ni acepta una que no existe (la regla de descarga es de Victor)", () => {
    const withCopy = ficha({ category: "nueva", category_copy: { name: bi("N", "N"), body: bi("B", "B"), kicker: bi("K", "K") } });
    const errors = shared.validateSkillUpload({ ficha: withCopy, pkg: skillPackage("arto-prueba"), categories: CATS });
    expect(errors.join(" ")).toMatch(/category_copy no va aqui/);
    expect(errors.join(" ")).toMatch(/la categoria «nueva» no existe/);
  });

  it("mods: la ficha con validateMod y el archivo opcional tiene que ser zip", () => {
    const mod = structuredClone(realMods.mods[0]);
    expect(shared.validateModUpload({ mod, file: null })).toEqual([]);
    expect(shared.validateModUpload({ mod, file: makeZip({ "a/b.txt": "x" }) })).toEqual([]);
    expect(shared.validateModUpload({ mod, file: Buffer.from("hola") })[0]).toMatch(/no es un zip/);
    expect(shared.validateModUpload({ mod: { ...mod, code: "X" }, file: null })).toEqual(validateMod({ ...mod, code: "X" }).map((e) => `mod.json ${e}`));
  });
});
