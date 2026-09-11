#!/usr/bin/env node
/* Convierte public/work/* a WebP de 200 KB o menos con sharp.
 *
 * Por que: /work pesaba 34.9 MB en 38 imagenes (jpg/png de 1 a 2.6 MB cada una).
 * Se reescala a 1600 px de ancho maximo y se baja la calidad hasta caber en el
 * tope; los GIF se intentan como WebP animado y, si no caben, se queda el primer
 * cuadro. Los originales se borran (quedan en el historial de git).
 *
 * Uso: node scripts/optimize-work-images.mjs [--keep] (--keep no borra originales) */
import sharp from "sharp";
import { readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "work");
const MAX_BYTES = 200 * 1024;
const MAX_WIDTH = 1600;
const keep = process.argv.includes("--keep");

async function encode(input, { animated, quality }) {
  return sharp(input, { animated }).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality, effort: 6 }).toBuffer();
}

async function convert(file) {
  const src = path.join(DIR, file);
  const ext = path.extname(file).toLowerCase();
  const out = path.join(DIR, path.basename(file, ext) + ".webp");
  const before = statSync(src).size;
  const isGif = ext === ".gif";
  let buf = null;
  let mode = isGif ? "animated" : "static";
  for (const animated of isGif ? [true, false] : [false]) {
    for (const quality of [82, 75, 68, 60, 52, 45, 38, 30]) {
      const b = await encode(src, { animated, quality });
      buf = b;
      if (b.length <= MAX_BYTES) break;
    }
    if (buf.length <= MAX_BYTES) break;
    mode = "first-frame";
  }
  if (buf.length > MAX_BYTES) {
    // Ultimo recurso: 1200 px.
    buf = await sharp(src).resize({ width: 1200 }).webp({ quality: 40, effort: 6 }).toBuffer();
    mode += "+1200px";
  }
  writeFileSync(out, buf);
  const after = statSync(out).size;
  if (!keep && src !== out) unlinkSync(src);
  return { file, before, after, mode };
}

const files = readdirSync(DIR).filter((f) => /\.(jpe?g|png|gif|webp)$/i.test(f));
let totalBefore = 0;
let totalAfter = 0;
for (const f of files) {
  if (f.endsWith(".webp") && statSync(path.join(DIR, f)).size <= MAX_BYTES) {
    const s = statSync(path.join(DIR, f)).size;
    totalBefore += s; totalAfter += s;
    console.log(`${f.padEnd(32)} ok  ${(s / 1024).toFixed(0)} KB`);
    continue;
  }
  const r = await convert(f);
  totalBefore += r.before; totalAfter += r.after;
  console.log(`${r.file.padEnd(32)} ${(r.before / 1024).toFixed(0).padStart(5)} KB -> ${(r.after / 1024).toFixed(0).padStart(4)} KB  ${r.mode}`);
}
console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(1)} MB -> ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
