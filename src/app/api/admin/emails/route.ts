import { NextResponse, type NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getWelcomeContent, sanitizeWelcome, saveWelcomeContent } from "@/lib/email-config";
import { welcomeEmail } from "@/lib/email-templates/welcome";
import { roastReportEmail } from "@/lib/email-templates/roast-report";
import { sendRoastReport, sendWelcome } from "@/lib/mailer";
import type { RoastResult } from "@/lib/roast-types";

/* /api/admin/emails (2026-10-07): editor de los correos de marca en el backend.
 *   GET  ?preview=welcome|roast&lang=es  HTML de vista previa
 *   GET                                  contenido editable de la bienvenida
 *   PUT                                  guarda la bienvenida
 *   POST {kind, lang}                    manda una prueba al correo del admin */

export const runtime = "nodejs";

const SAMPLE_ROAST: RoastResult = {
  overall: 4.6,
  headline: "Una marca con proyectos memorables y un sitio que parece informe de la ONU",
  strategy: { score: 5, roast: "Hay una idea con tension real, pero el sitio nunca explica que la hace la mejor opcion." },
  creativity: { score: 5, roast: "Los nombres de los proyectos son mas creativos que la marca: la identidad se ve timida." },
  narrative: { score: 4, roast: "Cada seccion arranca con un verbo institucional; la organizacion es la protagonista." },
  digital: { score: 4, roast: "El unico CTA es Ver mas, repetido nueve veces; no hay redes enlazadas." },
  verdict: "Hay sustancia de sobra. El problema es que la marca habla como documento de financiamiento y esconde lo mas vivo que tiene.",
  improvements: ["Agrega un CTA principal arriba del pliegue.", "Reescribe el hero con un resultado medible.", "Convierte cada proyecto en una historia con protagonista."],
  evidence: ["El H2 dice: Acompanamos a liderazgos de movimientos sociales.", "El unico CTA visible es Ver mas."],
  lang: "es",
};

const SAMPLE_QUERY = "brand=Marca+de+ejemplo&score=4.6&s=5&c=5&n=4&d=4&lang=es";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const preview = url.searchParams.get("preview");
  const lang = url.searchParams.get("lang") === "en" ? "en" : "es";
  if (preview === "welcome") {
    const m = welcomeEmail(await getWelcomeContent(), lang, "#");
    return new Response(m.html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (preview === "roast") {
    const m = roastReportEmail({ lang, brand: "Marca de ejemplo", result: { ...SAMPLE_ROAST, lang }, shareQuery: SAMPLE_QUERY.replace("lang=es", `lang=${lang}`) });
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
  const sent =
    body.kind === "roast"
      ? await sendRoastReport(auth.email, { lang, brand: "Marca de ejemplo", result: { ...SAMPLE_ROAST, lang }, shareQuery: SAMPLE_QUERY })
      : await sendWelcome(auth.email, lang, null);
  return NextResponse.json({ ok: sent, to: auth.email });
}
