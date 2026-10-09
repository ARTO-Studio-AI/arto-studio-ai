import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* Kit de imagenes para redes (2026-10-07). Todas las imagenes que el sitio manda al
 * compartir (home, prompts, blog y Brand Roast) salen de aqui con la marca nueva:
 * papel calido, tinta, acento naranja, personajes de ARTO y las cuatro voces
 * tipograficas. Satori necesita TTF/OTF, por eso las fuentes van como TTF estaticos
 * (Fontsource, OFL) en src/app/_og, leidas del repo para no depender de la red.
 * next.config incluye src/app/_og en el trazado de las funciones. */

export const OG = {
  paper: "#f4f2ee",
  sand: "#e9e3d8",
  ink: "#18181b",
  ink2: "#52525b",
  ink3: "#a1a1aa",
  line: "#e4e4e7",
  accent: "#ff4d00",
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

export function scoreColor(score: number): string {
  return score >= 7 ? OG.ok : score >= 5 ? OG.warn : OG.bad;
}

/** Recorta texto para que no reviente el layout de Satori. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
