import { NextResponse } from "next/server";
import { PromoAdminError } from "@/lib/promos/admin-server";
import { fail } from "../catalogo/_guard";

/* Respuesta de error comun de /api/admin/promociones/*: los errores esperados (validacion,
 * cupon que no coincide, base caida) salen con su estado y detalle; lo demas, 500. */
export function promoError(e: unknown): NextResponse {
  if (e instanceof PromoAdminError) {
    return NextResponse.json({ error: e.message, errors: e.errors, verification: e.verification }, { status: e.status });
  }
  return fail(e);
}
