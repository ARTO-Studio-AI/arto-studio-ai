#!/usr/bin/env node
/* Sube un mod a /mods en un comando (2026-11-05). Guia completa: docs/ADDING_A_SKILL.md.
 *
 *   node scripts/add-mod.mjs <mod.json>                 valida y lo registra oculto
 *   node scripts/add-mod.mjs <mod.json> --coming-soon   sale en /mods con su fecha
 *   node scripts/add-mod.mjs <mod.json> --publish       sale como disponible
 *   node scripts/add-mod.mjs <mod.json> --dry-run       solo valida
 *   node scripts/add-mod.mjs --estado <slug> <published|coming_soon|hidden>
 *
 * mod.json tiene la forma de una entrada de src/lib/catalogo/mods.json (code, slug, name,
 * releaseDate, version, author, license y copy.es / copy.en con tagline, what y checked).
 * Solo entra un mod con su FICHA DE VERIFICACION en mods/ de Drive (skill asai-auditoria-de-mods).
 * Se corre desde la raiz del repo, en una rama. No hace commit ni push. */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PATHS, STATUSES, readJson, setStatus, upsertMod, validateMod, writeJson } from "./lib/catalogo.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);

function fail(msg) {
  console.error(`add-mod: ${msg}`);
  process.exit(1);
}

function onBranch() {
  try {
    const b = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
    if (b === "main") fail("estas en main; cambia a una rama (ej. git switch -c feat/mod-<slug>)");
  } catch {
    /* sin git: se sigue */
  }
}

if (!args.length || flag("--help") || flag("-h")) {
  console.log(
    [
      "Uso:",
      "  node scripts/add-mod.mjs <mod.json> [--publish | --coming-soon | --hidden] [--dry-run]",
      "  node scripts/add-mod.mjs --estado <slug> <published|coming_soon|hidden>",
    ].join("\n"),
  );
  process.exit(args.length ? 0 : 1);
}

const manifest = readJson(ROOT, PATHS.mods);

if (args[0] === "--estado") {
  const [, slug, status] = args;
  if (!slug || !STATUSES.includes(status)) fail(`uso: --estado <slug> <${STATUSES.join("|")}>`);
  onBranch();
  let previous;
  try {
    previous = setStatus(manifest.mods, slug, status, "mod");
  } catch (err) {
    fail(err.message);
  }
  writeJson(ROOT, PATHS.mods, manifest);
  console.log(`add-mod: ${slug} ${previous} -> ${status}`);
  process.exit(0);
}

let raw;
try {
  raw = JSON.parse(readFileSync(path.resolve(args[0]), "utf8"));
} catch (err) {
  fail(`no pude leer ${args[0]}: ${err.message}`);
}
const errors = validateMod(raw);
if (errors.length) fail("no se subio nada:\n  - " + errors.join("\n  - "));

const wanted = ["--publish", "--coming-soon", "--hidden"].filter(flag);
if (wanted.length > 1) fail("usa solo uno de --publish, --coming-soon o --hidden");
const status = { "--publish": "published", "--coming-soon": "coming_soon", "--hidden": "hidden" }[wanted[0]];

let r;
try {
  r = upsertMod(manifest, raw, { status });
} catch (err) {
  fail(err.message);
}
if (flag("--dry-run")) {
  console.log(`add-mod: subiria ${raw.code} ${raw.slug} (${r.created ? "nuevo" : `antes ${r.previousStatus}`}) con estado ${r.status}`);
  process.exit(0);
}
onBranch();
writeJson(ROOT, PATHS.mods, r.manifest);
console.log(`add-mod: se subio ${raw.code} ${raw.slug} (${r.created ? "nuevo" : `antes ${r.previousStatus}`}) con estado ${r.status}`);
console.log("Sigue: npx vitest run && npm run build, commit en la rama y PR.");
