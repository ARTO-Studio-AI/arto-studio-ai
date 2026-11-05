import type { Locale } from "@/i18n/config";
import manifest from "./catalogo/mods.json";

/* Sección de Mods (Victor, 30 oct 2026): página pública con los mods de Claude Code que ASAI
 * auditó; la descarga será solo para planes de pago. Solo entra aquí un mod con su ficha de
 * auditoría aprobada en mods/ de Drive (skill asai-auditoria-de-mods). MOD01 sale el 9 nov.
 *
 * Desde el 2026-11-05 los mods viven en src/lib/catalogo/mods.json, que escribe
 * scripts/add-mod.mjs (ver docs/ADDING_A_SKILL.md). Mismos estados que los skills:
 * published, coming_soon (con su fecha) y hidden (no sale). */

export const MOD_STATUSES = ["published", "coming_soon", "hidden"] as const;
export type ModStatus = (typeof MOD_STATUSES)[number];

export interface Mod {
  code: string;
  slug: string;
  name: string;
  status: ModStatus;
  releaseDate: string; // AAAA-MM-DD
  version: string;
  author: string;
  license: string;
  copy: Record<Locale, { tagline: string; what: string; checked: string[] }>;
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function isCopy(v: unknown): v is Mod["copy"]["es"] {
  const o = v as Mod["copy"]["es"] | null;
  return !!o && isStr(o.tagline) && isStr(o.what) && Array.isArray(o.checked) && o.checked.length > 0 && o.checked.every(isStr);
}

/** Valida un mod del manifiesto. Lanza con el campo que falla. */
export function parseMod(raw: unknown): Mod {
  const m = raw as Mod;
  const bad = (field: string) => new Error(`mods.json: ${m?.code ?? "?"} campo ${field} invalido`);
  if (!m || !isStr(m.code) || !/^MOD\d{2,}$/.test(m.code)) throw bad("code");
  if (!isStr(m.slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.slug)) throw bad("slug");
  if (!isStr(m.name)) throw bad("name");
  if (!(MOD_STATUSES as readonly unknown[]).includes(m.status)) throw bad("status");
  if (!isStr(m.releaseDate) || !/^\d{4}-\d{2}-\d{2}$/.test(m.releaseDate)) throw bad("releaseDate");
  if (!isStr(m.version)) throw bad("version");
  if (!isStr(m.author)) throw bad("author");
  if (!isStr(m.license)) throw bad("license");
  if (!m.copy || !isCopy(m.copy.es) || !isCopy(m.copy.en)) throw bad("copy");
  return m;
}

/** Valida la lista completa: cada mod y que no se repitan codigo ni slug. */
export function parseMods(raw: unknown): Mod[] {
  const list = (raw as { mods?: unknown[] } | null)?.mods;
  if (!Array.isArray(list)) throw new Error("mods.json: falta la lista mods");
  const mods = list.map(parseMod);
  if (new Set(mods.map((m) => m.code)).size !== mods.length) throw new Error("mods.json: codigos repetidos");
  if (new Set(mods.map((m) => m.slug)).size !== mods.length) throw new Error("mods.json: slugs repetidos");
  return mods;
}

/** Todos, incluidos los ocultos. Solo para /admin. */
export const ALL_MODS: readonly Mod[] = parseMods(manifest);

/** Los que salen en /mods. */
export const MODS: readonly Mod[] = ALL_MODS.filter((m) => m.status !== "hidden");

export function formatModDate(iso: string, locale: Locale): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", { day: "numeric", month: "long", timeZone: "UTC" });
}
