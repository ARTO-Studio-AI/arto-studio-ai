import { NextRequest, NextResponse } from "next/server";
import { AdminCatalogError, uploadMod, uploadSkill } from "@/lib/catalogo/admin-server";
import { LIMITS } from "@/lib/catalogo/validacion.mjs";
import { catalogAdmin, fail } from "../../catalogo/_guard";

/* POST /api/admin/skills/subir (multipart) · sube un skill o un mod desde /admin/skills
 * (2026-11-05). Mismo candado que el Catalogo de prompts: sesion de admin, nunca el Bearer.
 *   kind     "skill" o "mod"
 *   ficha    ficha.json del skill o mod.json del mod (archivo o texto pegado)
 *   paquete  el .skill (obligatorio en un skill) o el zip del mod (opcional)
 * Corre la misma validacion que scripts/add-skill.mjs y add-mod.mjs, guarda el paquete en el
 * bucket privado catalogo-paquetes y la ficha en catalog_items. Siempre entra oculto. */
export const runtime = "nodejs";
export const maxDuration = 60;

/* El paquete (4.4 MB) mas la ficha y el sobre del multipart. Vercel corta en 4.5 MB. */
const MAX_BODY = Math.floor(LIMITS.pkg) + 256 * 1024;
const MAX_FICHA = 256 * 1024;

async function readText(v: FormDataEntryValue | null): Promise<string | null> {
  if (v === null) return null;
  if (typeof v === "string") return v;
  if (v.size > MAX_FICHA) throw new AdminCatalogError("La ficha pesa demasiado (maximo 256 KB)");
  return v.text();
}

async function readFileField(v: FormDataEntryValue | null): Promise<Buffer | null> {
  if (v === null || typeof v === "string" || v.size === 0) return null;
  if (v.size > LIMITS.pkg) throw new AdminCatalogError(`El archivo pesa ${v.size} bytes (maximo ${Math.floor(LIMITS.pkg)})`, 413);
  return Buffer.from(await v.arrayBuffer());
}

export async function POST(request: NextRequest) {
  const who = await catalogAdmin(request);
  if (who instanceof NextResponse) return who;

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return NextResponse.json({ error: "El archivo pesa mas de 4.4 MB" }, { status: 413 });

  try {
    const form = await request.formData().catch(() => null);
    if (!form) throw new AdminCatalogError("Formulario no valido");
    const kind = form.get("kind");
    const text = await readText(form.get("ficha"));
    if (!text?.trim()) throw new AdminCatalogError("Falta la ficha");
    let ficha: unknown;
    try {
      ficha = JSON.parse(text);
    } catch (err) {
      throw new AdminCatalogError(`La ficha no es JSON valido: ${(err as Error).message}`);
    }
    const file = await readFileField(form.get("paquete"));

    if (kind === "skill") return NextResponse.json(await uploadSkill({ ficha, pkg: file, actor: who.email }));
    if (kind === "mod") return NextResponse.json(await uploadMod({ mod: ficha, file, actor: who.email }));
    throw new AdminCatalogError("Tipo invalido (skill o mod)");
  } catch (e) {
    if (e instanceof AdminCatalogError) return NextResponse.json({ error: e.message, errors: e.errors }, { status: e.status });
    return fail(e);
  }
}
