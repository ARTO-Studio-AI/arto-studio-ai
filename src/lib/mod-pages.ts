import { readFileSync } from "fs";
import path from "path";
import type { Locale } from "@/i18n/config";
import { parseBlocks, plain, type Block } from "@/lib/mini-markdown";

/* Texto de las paginas de detalle de /mods (18 nov 2026). Un .md por idioma en
 * src/content/mods/<slug>.<locale>.md, copiado de la pagina publica aprobada (Fable y Vo.Bo. de
 * Victor). Se incluye en la funcion con outputFileTracingIncludes en next.config.ts. */

const DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "src", "content", "mods");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ModPage {
  title: string;
  /** Primer parrafo despues de «Qué es» / «What it is», para la descripcion de la pagina. */
  summary: string;
  blocks: Block[];
}

export function getModPage(slug: string, locale: Locale): ModPage | null {
  if (!SLUG_RE.test(slug)) return null;
  let md: string;
  try {
    md = readFileSync(path.join(DIR, `${slug}.${locale}.md`), "utf8");
  } catch {
    return null;
  }
  const all = parseBlocks(md);
  const first = all[0];
  const title = first?.type === "h" && first.level === 1 ? plain(first.text) : slug;
  const blocks = first?.type === "h" && first.level === 1 ? all.slice(1) : all;
  const idx = blocks.findIndex((b) => b.type === "h" && b.level === 2);
  const para = blocks.slice(idx + 1).find((b) => b.type === "p");
  const summary = para && para.type === "p" ? plain(para.text) : "";
  return { title, summary, blocks };
}
