#!/usr/bin/env node
/* Revision de contraste del sitio (marca ASAI v2.0, 11 nov 2026). Obligatoria antes de cada PR
 * de la marca.
 *
 * Abre cada pagina en ES y EN con Playwright, recorre todo elemento que tenga texto propio,
 * calcula su color contra el fondo real (componiendo las capas con transparencia) y falla si:
 *   - algun texto queda abajo de 4.5:1 (3:1 si mide 24 px o mas);
 *   - hay letra blanca o rosa sobre lima;
 *   - hay letra lima o negra sobre azul;
 *   - hay letra azul o negra sobre negro.
 *
 * Uso:
 *   npm run build && npm start &         (o la URL de un preview de Vercel)
 *   node scripts/contraste.mjs [URL_BASE] [--rutas=/prompts,/pricing] [--ancho=1440]
 *
 * URL_BASE por omision: http://localhost:3000. Sale con codigo 1 si hay fallas.
 * Un fondo con imagen (foto o ilustracion) no se puede medir: esos textos se reportan aparte
 * como "sin medir" y no cuentan como falla. */

import { createRequire } from "node:module";

/* Playwright no es dependencia del repo (no hace falta para el build). Se toma el que haya:
 * en el repo (npm i -D playwright && npx playwright install chromium) o el global. */
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;

/* Paginas de (marketing). La fase 1 cambia lo comun (nav, pie, botones, tarjetas, insignias) y
 * por eso se revisan todas. */
const RUTAS_DEFAULT = [
  "/",
  "/pricing",
  "/prompts",
  "/skills",
  "/agents",
  "/mods",
  "/learn",
  "/work",
  "/tools",
  "/collections",
  "/roast",
  "/login",
  "/terms",
  "/privacy",
];
const rutas = opt("rutas", "") ? opt("rutas", "").split(",") : RUTAS_DEFAULT;
const ancho = Number(opt("ancho", "1440"));
const locales = opt("locales", "es,en").split(",");

function medir() {
  /* Corre dentro de la pagina. */
  const parse = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, bot) => {
    const a = top.a + bot.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const ch = (k) => (top[k] * top.a + bot[k] * bot.a * (1 - top.a)) / a;
    return { r: ch("r"), g: ch("g"), b: ch("b"), a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const near = (c, hex, tol = 18) => {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return Math.abs(c.r - r) <= tol && Math.abs(c.g - g) <= tol && Math.abs(c.b - b) <= tol;
  };
  const LIMA = ["#daf700", "#c6e000"], AZUL = ["#1e00ff", "#1800cc"], ROSA = "#ff3fa4";
  const esLima = (c) => LIMA.some((h) => near(c, h));
  const esAzul = (c) => AZUL.some((h) => near(c, h));
  const esNegro = (c) => c.r < 30 && c.g < 30 && c.b < 30;
  const esBlanco = (c) => c.r > 235 && c.g > 235 && c.b > 235;

  /* Color de fondo de un elemento: background-color, o el primer color opaco de un degradado
   * (el marcatexto rosa es un degradado). "img" si es una imagen. */
  const capa = (el) => {
    const cs = getComputedStyle(el);
    const bi = cs.backgroundImage;
    if (bi && bi !== "none") {
      if (bi.includes("url(")) return "img";
      const colores = [...bi.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter((c) => c && c.a > 0.5);
      if (colores.length) return colores[0];
    }
    return parse(cs.backgroundColor);
  };

  const fondo = (el) => {
    const capas = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.tagName === "IMG" || n.tagName === "VIDEO") return "img";
      const c = capa(n);
      if (c === "img") return "img";
      if (c && c.a > 0) {
        capas.push(c);
        if (c.a >= 1) break;
      }
    }
    let res = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = capas.length - 1; i >= 0; i--) res = over(capas[i], res);
    return res;
  };

  const out = [];
  const els = document.body.querySelectorAll("*");
  for (const el of els) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "TITLE", "OPTION"].includes(el.tagName.toUpperCase())) continue;
    const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!propio) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    let op = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
    if (op < 0.1) continue;
    const bg = fondo(el);
    const texto = el.textContent.trim().replace(/\s+/g, " ").slice(0, 60);
    const ruta = (() => {
      const p = [];
      for (let n = el; n && n !== document.body && p.length < 4; n = n.parentElement) {
        const cls = (n.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 3).join(".");
        p.unshift(n.tagName.toLowerCase() + (cls ? "." + cls : ""));
      }
      return p.join(" > ");
    })();
    if (bg === "img") {
      out.push({ tipo: "sin-medir", texto, ruta });
      continue;
    }
    let fg = parse(cs.color);
    if (!fg) continue;
    fg = over({ ...fg, a: fg.a * Math.min(1, op) }, bg);
    const size = parseFloat(cs.fontSize);
    const peso = Number(cs.fontWeight) || 400;
    const grande = size >= 24 || (size >= 18.66 && peso >= 700);
    const min = grande ? 3 : 4.5;
    const cr = ratio(fg, bg);
    const fallas = [];
    if (cr < min) fallas.push(`contraste ${cr.toFixed(2)} < ${min}`);
    if (esLima(bg) && (esBlanco(fg) || near(fg, ROSA))) fallas.push("letra blanca o rosa sobre lima");
    if (esAzul(bg) && (esLima(fg) || esNegro(fg))) fallas.push("letra lima o negra sobre azul");
    if (esNegro(bg) && (esAzul(fg) || esNegro(fg))) fallas.push("letra azul o negra sobre negro");
    const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    if (fallas.length) out.push({ tipo: "falla", texto, ruta, fg: hex(fg), bg: hex(bg), ratio: cr.toFixed(2), fallas });
    else out.push({ tipo: "ok" });
  }
  return out;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } });
// Sin aviso de cookies encima de la pagina: el visitante ya eligio "solo esenciales"
// (formato de src/lib/consent.ts; si sube CONSENT_VERSION, se cambia aqui).
await ctx.addCookies([{ name: "asai_consent", value: "essential.v3-2026-10-22", url: base }]);
const page = await ctx.newPage();

let totalOk = 0;
let totalFallas = 0;
let totalSinMedir = 0;
const porPagina = [];
for (const loc of locales) {
  for (const r of rutas) {
    const url = `${base}/${loc}${r === "/" ? "" : r}`;
    let res;
    try {
      res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    } catch (e) {
      porPagina.push({ url, error: String(e).slice(0, 120) });
      continue;
    }
    if (!res || res.status() >= 400) {
      porPagina.push({ url, error: `HTTP ${res?.status()}` });
      continue;
    }
    await page.waitForTimeout(300);
    const items = await page.evaluate(medir);
    const fallas = items.filter((i) => i.tipo === "falla");
    const ok = items.filter((i) => i.tipo === "ok").length;
    const sin = items.filter((i) => i.tipo === "sin-medir").length;
    totalOk += ok;
    totalFallas += fallas.length;
    totalSinMedir += sin;
    porPagina.push({ url, ok, sin, fallas });
  }
}
await browser.close();

console.log(`Revision de contraste · ${base} · ${ancho}px · ${new Date().toISOString()}`);
console.log("");
for (const p of porPagina) {
  if (p.error) {
    console.log(`?? ${p.url}  no se pudo abrir (${p.error})`);
    continue;
  }
  const mark = p.fallas.length ? "XX" : "OK";
  console.log(`${mark} ${p.url}  textos ok: ${p.ok} · fallas: ${p.fallas.length} · sin medir (sobre imagen): ${p.sin}`);
  for (const f of p.fallas.slice(0, 40)) {
    console.log(`     - "${f.texto}"  ${f.fg} sobre ${f.bg} (${f.ratio}:1)  ${f.fallas.join("; ")}`);
    console.log(`       ${f.ruta}`);
  }
  if (p.fallas.length > 40) console.log(`     ... y ${p.fallas.length - 40} mas`);
}
console.log("");
console.log(`Total: ${totalOk} textos pasan · ${totalFallas} fallas · ${totalSinMedir} sin medir`);
const errores = porPagina.filter((p) => p.error).length;
if (errores) console.log(`${errores} paginas no se pudieron abrir`);
process.exit(totalFallas > 0 || errores > 0 ? 1 : 0);
