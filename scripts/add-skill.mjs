#!/usr/bin/env node
/* Sube un skill al sitio en un comando (2026-11-05). Guia completa: docs/ADDING_A_SKILL.md.
 *
 *   node scripts/add-skill.mjs <carpeta-del-skill>               valida, copia y lo registra oculto
 *   node scripts/add-skill.mjs <carpeta-del-skill> --publish     igual, y lo publica
 *   node scripts/add-skill.mjs <carpeta-del-skill> --coming-soon sale en /skills con «Muy pronto»
 *   node scripts/add-skill.mjs <carpeta-del-skill> --dry-run     solo valida y dice que haria
 *   node scripts/add-skill.mjs --estado <slug> <published|coming_soon|hidden>
 *
 * La carpeta es la de Drive: SKILL.md, ficha.json, «<slug> - SKILL - V<version>.skill» y
 * demo/ (opcional). Si el skill ya estaba, se actualiza y conserva su estado salvo que pidas
 * otro. Se corre desde la raiz del repo, en una rama (nunca en main). No hace commit ni push. */

import { execSync } from "node:child_process";
import path from "node:path";
import { PATHS, STATUSES, addSkill, readJson, setStatus, validateCatalog, writeJson } from "./lib/catalogo.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);

function fail(msg) {
  console.error(`add-skill: ${msg}`);
  process.exit(1);
}

function onBranch() {
  try {
    const b = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
    if (b === "main") fail("estas en main; cambia a una rama (ej. git switch -c feat/skill-<slug>)");
  } catch {
    /* sin git (pruebas en una carpeta suelta): se sigue */
  }
}

if (!args.length || flag("--help") || flag("-h")) {
  console.log(
    [
      "Uso:",
      "  node scripts/add-skill.mjs <carpeta-del-skill> [--publish | --coming-soon | --hidden] [--dry-run]",
      "  node scripts/add-skill.mjs --estado <slug> <published|coming_soon|hidden>",
    ].join("\n"),
  );
  process.exit(args.length ? 0 : 1);
}

if (args[0] === "--estado") {
  const [, slug, status] = args;
  if (!slug || !STATUSES.includes(status)) fail(`uso: --estado <slug> <${STATUSES.join("|")}>`);
  onBranch();
  const catalog = readJson(ROOT, PATHS.skills);
  let previous;
  try {
    previous = setStatus([...catalog.skills, ...catalog.bundles], slug, status);
  } catch (err) {
    fail(err.message);
  }
  const errors = validateCatalog(catalog);
  if (errors.length) fail("el catalogo no pasa la validacion:\n  - " + errors.join("\n  - "));
  writeJson(ROOT, PATHS.skills, catalog);
  console.log(`add-skill: ${slug} ${previous} -> ${status}`);
  process.exit(0);
}

const dir = path.resolve(args[0]);
const wanted = ["--publish", "--coming-soon", "--hidden"].filter(flag);
if (wanted.length > 1) fail("usa solo uno de --publish, --coming-soon o --hidden");
const status = { "--publish": "published", "--coming-soon": "coming_soon", "--hidden": "hidden" }[wanted[0]];
const dryRun = flag("--dry-run");
if (!dryRun) onBranch();

const r = addSkill({ root: ROOT, dir, status, dryRun });
for (const w of r.warnings) console.warn(`aviso: ${w}`);
if (!r.ok) fail("no se subio nada:\n  - " + r.errors.join("\n  - "));

const verb = dryRun ? "subiria" : "subio";
console.log(`add-skill: se ${verb} ${r.slug} (${r.created ? "nuevo" : `antes ${r.previousStatus}`}) con estado ${r.status}`);
if (r.createdCategory) console.log("  categoria nueva creada con la regla de descarga «pro» (solo Pro)");
for (const c of r.copies) console.log(`  ${dryRun ? "copiaria" : "copiado"} ${c}`);
if (!dryRun) {
  console.log(`  registrado en ${PATHS.skills} y ${PATHS.assets}`);
  console.log("Sigue: npx vitest run && npm run build, commit en la rama y PR. Fable revisa la ficha antes de publicar.");
}
