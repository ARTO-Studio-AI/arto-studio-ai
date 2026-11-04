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

/* Validador de scripts/add-skill.mjs y scripts/add-mod.mjs (2026-11-05). Arma carpetas de
 * skill falsas en un directorio temporal; no toca el repo ni la red. */

/** Zip minimo (sin comprimir) para probar lo que trae un .skill. El lector no revisa CRC. */
function makeZip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const n = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    locals.push(local, n, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

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
    const sinCopy = addSkill({ root, dir: skillFolder({ ficha: ficha({ category: "estrategia" }) }) });
    expect(sinCopy.ok).toBe(false);
    expect(sinCopy.errors.join()).toMatch(/categoria «estrategia» no existe/);

    const copy = { name: bi("Estrategia", "Strategy"), body: bi("Skills de marca.", "Brand skills."), kicker: bi("Marca", "Brand") };
    const conCopy = addSkill({ root, dir: skillFolder({ ficha: ficha({ category: "estrategia", category_copy: copy }) }) });
    expect(conCopy.ok).toBe(true);
    expect(conCopy.createdCategory).toBe(true);
    const cat = readCatalog(root);
    expect(cat.categories.find((c: { slug: string }) => c.slug === "estrategia")).toMatchObject({ access: "pro", bundle: null, order: 2 });
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
