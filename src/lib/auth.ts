import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
 * set as a Vercel env var. These are the "bootstrap" admins — they
 * always have access even if the DB is unreachable, and they cannot be
 * removed from the /admin/admins UI. Use this when you're in a
 * sync-only context (e.g. inside a tight render path that can't await).
 *
 * For most checks, prefer isAdminEmailAsync() which also consults the
 * admin_users table.
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

/**
 * Composite async admin check: ADMIN_EMAILS env var OR admin_users table.
 *
 * The env var is the bootstrap path — immutable from the UI, used so
 * the platform owner can always log in even if the DB row gets deleted
 * by accident. The admin_users table is the dynamic path — managed
 * from /admin/admins.
 *
 * A user is admin if their email matches EITHER source.
 */
export async function isAdminEmailAsync(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  // DB lookup. createAdminClient uses the service role key so we bypass
  // RLS on admin_users.
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("admin_users")
      .select("id")
      // eq y no ilike: el _ y el % del correo actuaban como comodines (2026-10-12).
      .eq("email", email.trim().toLowerCase())
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
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
 *   1. Supabase session present and user.email is on ADMIN_EMAILS env
 *      OR in admin_users table → ok via "session"
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
      // Check env var first (cheap, no DB hit). If it matches, short-circuit.
      // If not, fall through to the DB lookup.
      if (isAdminEmail(user.email)) {
        return { ok: true, email: user.email, userId: user.id, via: "session" };
      }
      if (await isAdminEmailAsync(user.email)) {
        return { ok: true, email: user.email, userId: user.id, via: "session" };
      }
      // Signed in but not admin. The "no_allowlist" reason is reserved for
      // a config error (env var blank AND DB empty). Once you've used the
      // UI to add a single admin, the table is populated and we'd reach
      // not_admin instead.
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
