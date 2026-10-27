#!/usr/bin/env node
/* Genera src/lib/edit-bundle/assets.json a partir de lo que hay en disco (Victor, 27 oct 2026).
 *
 *   public/skills/demos/<slug>.mp4 y .jpg  -> demos (publicas)
 *   private/skills/<slug>.skill y arto-edit-bundle-1.zip -> paquetes (privados)
 *
 * Las paginas leen el manifiesto para no pintar un video roto ni un boton sin archivo.
 * Revisa los limites del contrato: demo <= 1.5 MB, poster <= 150 KB, y cada paquete
 * <= 4.4 MB (la respuesta de una funcion de Vercel no pasa de 4.5 MB). Si algo se pasa,
 * sale con codigo 1 y no escribe nada.
 *
 * Uso, desde la raiz del repo:  node scripts/edit-bundle-manifest.mjs */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SLUGS = [
  "arto-edit-cortes",
  "arto-edit-subtitulos",
  "arto-edit-letras-detras",
  "arto-edit-recuadros",
  "arto-edit-titulares",
  "arto-edit-color",
  "arto-edit-zooms",
  "arto-edit-sonido",
  "arto-edit-director",
];
const BUNDLE = "arto-edit-bundle-1";
const LIMITS = { mp4: 1.5 * 1024 * 1024, jpg: 150 * 1024, pkg: 4.4 * 1024 * 1024 };

const errors = [];
const demos = {};
const packages = {};

function size(p) {
  return existsSync(p) ? statSync(p).size : null;
}

for (const slug of SLUGS) {
  const mp4 = path.join(ROOT, "public/skills/demos", `${slug}.mp4`);
  const jpg = path.join(ROOT, "public/skills/demos", `${slug}.jpg`);
  const m = size(mp4);
  const j = size(jpg);
  if (m !== null && m > LIMITS.mp4) errors.push(`${slug}.mp4 pesa ${m} bytes (maximo ${LIMITS.mp4})`);
  if (j !== null && j > LIMITS.jpg) errors.push(`${slug}.jpg pesa ${j} bytes (maximo ${LIMITS.jpg})`);
  if (m !== null || j !== null) demos[slug] = { mp4: m !== null, jpg: j !== null };
}

for (const [slug, file] of [...SLUGS.map((s) => [s, `${s}.skill`]), [BUNDLE, `${BUNDLE}.zip`]]) {
  const p = path.join(ROOT, "private/skills", file);
  const s = size(p);
  if (s === null) continue;
  if (s > LIMITS.pkg) errors.push(`${file} pesa ${s} bytes (maximo ${Math.floor(LIMITS.pkg)})`);
  const sha256 = createHash("sha256").update(readFileSync(p)).digest("hex");
  packages[slug] = { bytes: s, sha256 };
}

if (errors.length) {
  console.error("edit-bundle-manifest: no se escribio el manifiesto\n  - " + errors.join("\n  - "));
  process.exit(1);
}

const out = { generatedAt: new Date().toISOString(), demos, packages };
writeFileSync(path.join(ROOT, "src/lib/edit-bundle/assets.json"), JSON.stringify(out, null, 2) + "\n");
console.log(
  `edit-bundle-manifest: ${Object.keys(demos).length} demos, ${Object.keys(packages).length} paquetes (de ${SLUGS.length + 1})`,
);
