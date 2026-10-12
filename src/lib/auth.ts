import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Verify admin access via Bearer token.
 *
 * Kept for back-compat with external scripts, cron jobs, and any
 * integration that hits /api/admin/* without a browser session. The
 * token is set as ADMIN_API_KEY in environment variables.
 */
export function isAdminAuthorized(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  return token === adminKey;
}

/**
 * Synchronous env-only admin check.
 *
 * ADMIN_EMAILS is a comma-separated list of lowercase email addresses
 * set as a Vercel env var. Es la unica lista de administradores (D14, 2026-10-12):
 * para dar o quitar acceso al panel se edita esa variable en Vercel y se redespliega.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const allowlist = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}

/** Version async de isAdminEmail (misma regla: solo ADMIN_EMAILS). */
export async function isAdminEmailAsync(email?: string | null): Promise<boolean> {
  // Desde el 2026-10-12 (D14) el unico origen es ADMIN_EMAILS. La tabla admin_users nunca
  // existio en produccion y su pantalla se retiro. Se conserva la firma async para no tocar
  // a quienes la llaman.
  return isAdminEmail(email);
}

export type AdminAuthResult =
  | { ok: true; email: string; userId: string; via: "session" | "bearer" }
  | { ok: false; reason: "unauthenticated" | "not_admin" | "no_allowlist" };

/**
 * Compose Supabase session + admin allowlist into a single gate.
 *
 * This is the canonical admin check for the app's server surface.
 *
 * Resolution order:
 *   1. Supabase session present and user.email is on ADMIN_EMAILS → ok via "session"
 *   2. Authorization: Bearer ADMIN_API_KEY match → ok via "bearer"
 *   3. otherwise → not_admin / unauthenticated / no_allowlist
 *
 * Always pass NextRequest from API routes so the Bearer fallback works.
 * Server Components can omit it.
 */
export async function requireAdminSession(
  request?: NextRequest,
): Promise<AdminAuthResult> {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user?.email) {
      if (isAdminEmail(user.email)) {
        return { ok: true, email: user.email, userId: user.id, via: "session" };
      }
      // Con sesion pero sin ser admin. "no_allowlist" = ADMIN_EMAILS sin configurar.
      if (!process.env.ADMIN_EMAILS) {
        return { ok: false, reason: "no_allowlist" };
      }
      return { ok: false, reason: "not_admin" };
    }
  } catch {
    // Supabase env missing or cookie unreadable — fall through to Bearer.
  }

  if (request && isAdminAuthorized(request)) {
    return { ok: true, email: "bearer", userId: "bearer", via: "bearer" };
  }

  return { ok: false, reason: "unauthenticated" };
}
