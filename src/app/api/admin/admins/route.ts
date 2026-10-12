import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/* GET  /api/admin/admins         — list current dynamic admins
 * POST /api/admin/admins         — add { email, notes? }
 * DELETE /api/admin/admins?email=… — remove a dynamic admin
 *
 * Bootstrap admins (ADMIN_EMAILS env var) are NOT in this table and
 * cannot be added/removed from here. They're surfaced read-only in the
 * GET response so the UI can list them with a "permanent" badge.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bootstrapAdmins(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("admin_users")
    .select("id, email, added_by, added_at, notes")
    .order("added_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    bootstrap: bootstrapAdmins(),
    dynamic: data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const email = (body?.email ?? "").toString().trim().toLowerCase();
  const notes = (body?.notes ?? "").toString().trim() || null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (isAdminEmail(email)) {
    return NextResponse.json(
      { error: "Already a bootstrap admin (env var). No need to add to the table." },
      { status: 409 },
    );
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("admin_users")
    .insert({ email, notes, added_by: auth.email })
    .select("id, email, added_by, added_at, notes")
    .single();
  if (error) {
    // unique violation → already in table
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already an admin." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ admin: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email query param required" }, { status: 400 });
  }
  if (isAdminEmail(email)) {
    return NextResponse.json(
      { error: "This is a bootstrap admin (ADMIN_EMAILS env var). Remove from Vercel env to revoke." },
      { status: 409 },
    );
  }
  // Disallow self-removal so you can't lock yourself out with one click.
  if (auth.via === "session" && email === auth.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "You cannot remove yourself. Ask another admin." },
      { status: 409 },
    );
  }

  const sb = createAdminClient();
  // eq y no ilike: con ilike, ?email=%25 borraba a todos los admins (diagnostico 2026-10-12).
  // El POST ya guarda el correo en minusculas.
  const { error } = await sb.from("admin_users").delete().eq("email", email.trim().toLowerCase());
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
