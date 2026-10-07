import type { NextRequest } from "next/server";
import { confirmList } from "@/lib/marketing-list";
import { sendWelcome } from "@/lib/mailer";
import { actionPage } from "@/lib/email-templates/page";
import { createAdminClient } from "@/lib/supabase/admin";

/* Doble opt-in de la lista (2026-10-07). GET muestra un boton; el POST confirma, da de
 * alta en la audiencia y manda la bienvenida. El token es el unsubscribe_token de la fila. */

export const runtime = "nodejs";

function langOf(req: NextRequest): "es" | "en" {
  return new URL(req.url).searchParams.get("lang") === "en" ? "en" : "es";
}

export async function GET(request: NextRequest) {
  const lang = langOf(request);
  const token = new URL(request.url).searchParams.get("token");
  const es = lang === "es";
  if (!token) return actionPage({ lang, title: es ? "Enlace incompleto" : "Incomplete link", body: es ? "Al enlace le falta el token." : "The link is missing its token.", status: 400 });
  return actionPage({
    lang,
    title: es ? "Confirma tu inscripción" : "Confirm your subscription",
    body: es ? "Un clic y quedas en la lista de ARTO Studio AI para recibir prompts nuevos, guías y promociones." : "One click and you're on the ARTO Studio AI list for new prompts, guides and promotions.",
    action: { url: `/api/newsletter/confirm?token=${encodeURIComponent(token)}&lang=${lang}`, label: es ? "Sí, inscribirme" : "Yes, subscribe me" },
  });
}

export async function POST(request: NextRequest) {
  const lang = langOf(request);
  const es = lang === "es";
  const token = new URL(request.url).searchParams.get("token");
  const email = token ? await confirmList(token) : null;
  if (!email) {
    // Ya confirmada o token invalido: no se revela cual.
    return actionPage({ lang, title: es ? "Listo" : "All set", body: es ? "Si el enlace era valido, ya estás en la lista." : "If the link was valid, you're on the list." });
  }
  const admin = createAdminClient();
  const { data } = await admin.from("newsletter_subscribers").select("unsubscribe_token").eq("email", email).maybeSingle();
  await sendWelcome(email, lang, (data?.unsubscribe_token as string | undefined) ?? token);
  return actionPage({ lang, title: es ? "Ya estás dentro" : "You're in", body: es ? "Te mandamos la bienvenida a tu correo." : "We just sent the welcome to your inbox." });
}
