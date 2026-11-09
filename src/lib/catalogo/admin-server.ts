import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET, getCatalog, invalidateCatalog } from "./efectivo";
import type { CatalogKind, UploadKind } from "./estado";
import { isCatalogStatus, type CatalogStatus } from "./skills";
import { validateModUpload, validateSkillUpload } from "./validacion.mjs";

/* Escrituras de /admin/skills (2026-11-05). Todo con service role; quien llama ya paso el
 * candado de admin (catalogAdmin en cada ruta). Cada cambio deja fila en catalog_status_log.
 *
 * La validacion de la subida es la de src/lib/catalogo/validacion.mjs, la misma que corre
 * scripts/add-skill.mjs y scripts/add-mod.mjs: aqui no se repite ninguna regla. */

export class AdminCatalogError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly errors: string[] = [],
  ) {
    super(message);
  }
}

export const CATALOG_KINDS: readonly CatalogKind[] = ["skill", "bundle", "mod"];
export const isCatalogKind = (v: unknown): v is CatalogKind => (CATALOG_KINDS as readonly unknown[]).includes(v);

export interface LogRow {
  id: number;
  kind: CatalogKind;
  slug: string;
  action: "status" | "upload";
  from_status: CatalogStatus | null;
  to_status: CatalogStatus;
  detail: Record<string, unknown> | null;
  changed_by: string;
  created_at: string;
}

async function writeLog(row: Omit<LogRow, "id" | "created_at">): Promise<void> {
  const { error } = await createAdminClient().from("catalog_status_log").insert(row);
  if (error) throw new Error(`catalog_status_log: ${error.message}`);
}

async function writeOverride(kind: CatalogKind, slug: string, status: CatalogStatus, actor: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("catalog_overrides")
    .upsert({ kind, slug, status, updated_by: actor, updated_at: new Date().toISOString() }, { onConflict: "kind,slug" });
  if (error) throw new Error(`catalog_overrides: ${error.message}`);
}

/** Ultimos cambios para la pagina. Si la tabla no esta, lista vacia y el error. */
export async function recentLog(limit = 50): Promise<{ rows: LogRow[]; error: string | null }> {
  try {
    const { data, error } = await createAdminClient()
      .from("catalog_status_log")
      .select("id, kind, slug, action, from_status, to_status, detail, changed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as LogRow[], error: null };
  } catch (err) {
    return { rows: [], error: (err as Error).message };
  }
}

/* ------------------------------------------------------------ estado */

export async function setCatalogStatus(input: { kind: unknown; slug: unknown; status: unknown; actor: string }) {
  const { kind, slug, status, actor } = input;
  if (!isCatalogKind(kind)) throw new AdminCatalogError("Tipo invalido (skill, bundle o mod)");
  if (typeof slug !== "string" || !slug) throw new AdminCatalogError("Falta el slug");
  if (!isCatalogStatus(status)) throw new AdminCatalogError("Estado invalido (published, coming_soon o hidden)");

  const catalog = await getCatalog({ fresh: true });
  if (!catalog.dbOk) throw new AdminCatalogError("No pude leer la base; no se cambio nada. Intenta de nuevo en un momento.", 503);
  const item = catalog.find(kind, slug);
  if (!item) throw new AdminCatalogError(`No hay ningun ${kind} con slug «${slug}»`, 404);
  const from = item.status;
  if (from === status) return { changed: false, from, to: status };
  if (status === "published" && kind !== "mod" && !catalog.packageAvailable(slug)) {
    throw new AdminCatalogError("No se puede publicar sin paquete: primero sube el .skill.", 409);
  }

  await writeOverride(kind, slug, status, actor);
  await writeLog({ kind, slug, action: "status", from_status: from, to_status: status, detail: null, changed_by: actor });
  invalidateCatalog();
  return { changed: true, from, to: status };
}

/* ------------------------------------------------------------ subida */

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

async function previousRow(kind: UploadKind, slug: string) {
  const { data, error } = await createAdminClient()
    .from("catalog_items")
    .select("storage_path, bytes, sha256, ficha")
    .eq("kind", kind)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`catalog_items: ${error.message}`);
  return data as { storage_path: string | null; bytes: number | null; sha256: string | null; ficha: Record<string, unknown> } | null;
}

async function putObject(path: string, body: Buffer): Promise<void> {
  const { error } = await createAdminClient().storage.from(BUCKET).upload(path, body, { contentType: "application/zip", upsert: true });
  if (error) throw new Error(`Storage: ${error.message}`);
}

async function removeObject(path: string): Promise<void> {
  const { error } = await createAdminClient().storage.from(BUCKET).remove([path]);
  if (error) console.error("[admin/skills] no pude borrar", path, error.message);
}

/**
 * Guarda la fila, deja el estado en oculto y registra la subida. Si algo falla despues de
 * subir el archivo nuevo, lo quita (si no es el mismo que ya estaba).
 */
async function saveUpload(opts: {
  kind: UploadKind;
  slug: string;
  ficha: Record<string, unknown>;
  file: { path: string; bytes: number; sha256: string } | null;
  keep: { storage_path: string | null; bytes: number | null; sha256: string | null } | null;
  actor: string;
  fromStatus: CatalogStatus | null;
  detail: Record<string, unknown>;
}) {
  const { kind, slug, ficha, file, keep, actor } = opts;
  const pkg = file ? { storage_path: file.path, bytes: file.bytes, sha256: file.sha256 } : (keep ?? { storage_path: null, bytes: null, sha256: null });
  const now = new Date().toISOString();
  try {
    const { error } = await createAdminClient()
      .from("catalog_items")
      .upsert({ kind, slug, ficha, ...pkg, uploaded_by: actor, updated_at: now }, { onConflict: "kind,slug" });
    if (error) throw new Error(`catalog_items: ${error.message}`);
    await writeOverride(kind, slug, "hidden", actor);
  } catch (err) {
    if (file && file.path !== keep?.storage_path) await removeObject(file.path);
    throw err;
  }
  await writeLog({ kind, slug, action: "upload", from_status: opts.fromStatus, to_status: "hidden", detail: opts.detail, changed_by: actor });
  if (file && keep?.storage_path && keep.storage_path !== file.path) await removeObject(keep.storage_path);
  invalidateCatalog();
}

/** Sube un skill: misma validacion que add-skill.mjs, paquete a Storage, ficha a la base, oculto. */
export async function uploadSkill(input: { ficha: unknown; pkg: Buffer | null; actor: string }) {
  const catalog = await getCatalog({ fresh: true });
  if (!catalog.dbOk) throw new AdminCatalogError("No pude leer la base; no se subio nada. Intenta de nuevo en un momento.", 503);
  const errors = validateSkillUpload({
    ficha: input.ficha,
    pkg: input.pkg,
    categories: catalog.categories.map((c) => c.slug),
    freeCategories: catalog.categories.filter((c) => c.access === "cuenta").map((c) => c.slug),
  });
  if (errors.length) throw new AdminCatalogError("No se subio nada", 400, errors);

  const ficha = input.ficha as Record<string, unknown> & { slug: string; version: string };
  const existing = catalog.find("skill", ficha.slug) ?? catalog.find("bundle", ficha.slug);
  if (existing && existing.source === "repo") {
    throw new AdminCatalogError(`«${ficha.slug}» ya existe en el repo y el del repo gana. Para cambiarlo usa scripts/add-skill.mjs con PR, o sube el skill con otro slug.`, 409);
  }

  const pkg = input.pkg!;
  const hash = sha256(pkg);
  const path = `skills/${ficha.slug}/${hash}.skill`;
  const keep = await previousRow("skill", ficha.slug);
  await putObject(path, pkg);
  await saveUpload({
    kind: "skill",
    slug: ficha.slug,
    ficha,
    file: { path, bytes: pkg.length, sha256: hash },
    keep,
    actor: input.actor,
    fromStatus: existing?.status ?? null,
    detail: { version: ficha.version, bytes: pkg.length, sha256: hash, previous_sha256: keep?.sha256 ?? null },
  });
  return { slug: ficha.slug, created: !keep, sha256: hash, bytes: pkg.length };
}

/** Sube un mod: validateMod de add-mod.mjs y, si trae, su archivo (zip) a Storage. Oculto. */
export async function uploadMod(input: { mod: unknown; file: Buffer | null; actor: string }) {
  const catalog = await getCatalog({ fresh: true });
  if (!catalog.dbOk) throw new AdminCatalogError("No pude leer la base; no se subio nada. Intenta de nuevo en un momento.", 503);
  const errors = validateModUpload({ mod: input.mod, file: input.file });
  if (errors.length) throw new AdminCatalogError("No se subio nada", 400, errors);

  /* El estado no va en la ficha: vive en catalog_overrides. */
  const { status: _ignored, ...mod } = input.mod as Record<string, unknown> & { slug: string; code: string; version: string; status?: unknown };
  void _ignored;
  const repo = catalog.mods.find((m) => m.source === "repo" && (m.slug === mod.slug || m.code === mod.code));
  if (repo) {
    throw new AdminCatalogError(`El slug o el codigo ya son de «${repo.slug}» (${repo.code}) en el repo, y el del repo gana. Usa otro codigo y slug, o scripts/add-mod.mjs con PR.`, 409);
  }
  const clash = catalog.mods.find((m) => m.code === mod.code && m.slug !== mod.slug);
  if (clash) throw new AdminCatalogError(`El codigo ${mod.code} ya es de «${clash.slug}»`, 409);
  const existing = catalog.find("mod", mod.slug);

  const keep = await previousRow("mod", mod.slug);
  let file: { path: string; bytes: number; sha256: string } | null = null;
  if (input.file && input.file.length > 0) {
    const hash = sha256(input.file);
    file = { path: `mods/${mod.slug}/${hash}.zip`, bytes: input.file.length, sha256: hash };
    await putObject(file.path, input.file);
  }
  await saveUpload({
    kind: "mod",
    slug: mod.slug,
    ficha: mod,
    file,
    keep,
    actor: input.actor,
    fromStatus: existing?.status ?? null,
    detail: { code: mod.code, version: mod.version, ...(file ? { bytes: file.bytes, sha256: file.sha256 } : {}) },
  });
  return { slug: mod.slug, created: !keep, sha256: file?.sha256 ?? keep?.sha256 ?? null };
}
