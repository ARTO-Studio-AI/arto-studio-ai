import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getWelcomeContent, sanitizeWelcome, saveWelcomeContent } from "@/lib/email-config";
import { isEmailKind } from "@/lib/email-kinds";
import { sampleEmail } from "@/lib/email-samples";
import { sendTestEmail } from "@/lib/mailer";

/* /api/admin/emails (2026-10-07): editor de los correos de marca en el backend.
 *   GET  ?preview=<kind>&lang=es         HTML de vista previa (kinds en src/lib/email-kinds.ts)
 *   GET                                  contenido editable de la bienvenida
 *   PUT                                  guarda la bienvenida
 *   POST {kind, lang}                    manda una prueba al correo del admin, por Resend como el real */

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const preview = url.searchParams.get("preview");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "es";
  if (isEmailKind(preview)) {
    const m = await sampleEmail(preview, lang, auth.via === "session" && auth.email ? auth.email : "tu@correo.com");
    return new Response(m.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return NextResponse.json({ welcome: await getWelcomeContent() });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const content = sanitizeWelcome(await request.json().catch(() => null));
  if (!content) return NextResponse.json({ error: "Contenido invalido" }, { status: 400 });
  const ok = await saveWelcomeContent(content, auth.email);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok || auth.via !== "session") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { kind?: string; lang?: string };
  const lang = body.lang === "en" ? "en" : "es";
  if (body.kind !== undefined && !isEmailKind(body.kind)) return NextResponse.json({ error: "kind invalido" }, { status: 400 });
  const kind = isEmailKind(body.kind) ? body.kind : "welcome";
  const sent = await sendTestEmail(auth.email, await sampleEmail(kind, lang, auth.email), kind);
  return NextResponse.json({ ok: sent, to: auth.email, kind });
}
