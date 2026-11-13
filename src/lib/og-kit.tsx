import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* Kit de imagenes para redes (2026-10-07). Todas las imagenes que el sitio manda al
 * compartir (home, prompts, blog y Brand Roast) salen de aqui con la marca nueva:
 * marca ASAI v2.0 (11 nov 2026): fondo lima, letra negra, azul ultramar como letra de color
 * sobre lima o blanco, lima sobre negro y rosa solo como marcatexto. Personajes de ARTO y las cuatro voces
 * tipograficas. Satori necesita TTF/OTF, por eso las fuentes van como TTF estaticos
 * (Fontsource, OFL) en src/app/_og, leidas del repo para no depender de la red.
 * next.config incluye src/app/_og en el trazado de las funciones. */

export const OG = {
  paper: "#daf700", // lima: fondo
  sand: "#eef6b8", // lima palido: rieles de barras
  ink: "#000000",
  ink2: "#3d4500", // oliva
  ink3: "#5a6600", // oliva 2
  line: "rgba(0,0,0,0.14)",
  accent: "#1e00ff", // azul ultramar: letra de color sobre lima o blanco, nunca sobre negro
  lime: "#daf700", // acento sobre negro
  pink: "#ff3fa4", // solo marcatexto, con letra negra
  white: "#ffffff",
  ok: "#16a34a",
  warn: "#d97706",
  bad: "#dc2626",
} as const;

const DIR = join(process.cwd(), "src", "app", "_og");

async function buf(file: string): Promise<Buffer> {
  return readFile(join(DIR, file));
}

function ab(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

export type OgFont = { name: string; data: ArrayBuffer; weight: 500 | 600 | 800; style: "normal" | "italic" };

let fontsPromise: Promise<OgFont[]> | null = null;

/** Las cuatro voces: Manrope (display), Geist (meta), Cormorant (serif), Inter Tight (texto). */
export function ogFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      buf("Manrope-800.ttf"),
      buf("Geist-500.ttf"),
      buf("Cormorant-600i.ttf"),
      buf("InterTight-500.ttf"),
    ]).then(([manrope, geist, cormorant, inter]) => [
      { name: "Manrope", data: ab(manrope), weight: 800, style: "normal" },
      { name: "Geist", data: ab(geist), weight: 500, style: "normal" },
      { name: "Cormorant", data: ab(cormorant), weight: 600, style: "italic" },
      { name: "Inter Tight", data: ab(inter), weight: 500, style: "normal" },
    ]);
  }
  return fontsPromise;
}

const imgCache = new Map<string, string>();

/** PNG del repo como data URL (logo o personaje). */
export async function ogImage(file: string): Promise<string> {
  const hit = imgCache.get(file);
  if (hit) return hit;
  const url = `data:image/png;base64,${(await buf(file)).toString("base64")}`;
  imgCache.set(file, url);
  return url;
}

export const CHAR_SIZES: Record<string, [number, number]> = {
  "character-01.png": [290, 273],
  "character-02.png": [439, 273],
  "character-03.png": [280, 183],
  "character-04.png": [267, 273],
  "character-05.png": [267, 273],
};

/** Marca v2.0 (D21): 7 o mas en azul, 5 a 6.9 en negro, abajo de 5 en rojo. */
export function scoreColor(score: number): string {
  return score >= 7 ? OG.accent : score >= 5 ? OG.ink : OG.bad;
}

/** Recorta texto para que no reviente el layout de Satori. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
