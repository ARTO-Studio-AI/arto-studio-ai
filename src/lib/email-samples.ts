import { SITE_URL } from "@/lib/site-url";
import { getWelcomeContent } from "@/lib/email-config";
import type { EmailKind } from "@/lib/email-kinds";
import type { RoastResult } from "@/lib/roast-types";
import { welcomeEmail } from "@/lib/email-templates/welcome";
import { roastReportEmail } from "@/lib/email-templates/roast-report";
import { digestEmail, type DigestPrompt } from "@/lib/email-templates/digest";
import { listConfirmationEmail } from "@/lib/email-templates/confirm";
import { supabaseAuthTemplate } from "@/lib/email-templates/supabase-auth";

/* Muestras de cada correo para la vista previa y la prueba de /admin/emails (2026-10-20).
 * Usan las plantillas reales; solo los datos son de ejemplo. */

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

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

export const SAMPLE_ROAST_QUERY = "brand=Marca+de+ejemplo&score=4.6&s=5&c=5&n=4&d=4&lang=es";

const SAMPLE_PROMPTS: DigestPrompt[] = [
  { id: "CP-0212", title_es: "Lista de verificación para validar ideas de proyectos laterales creativos", title_en: "Checklist to validate creative side project ideas", category: "creative_productivity", tier: "free" },
  { id: "FA-0214", title_es: "Mapeando el mercado global de moda de segunda mano y sus motores de crecimiento", title_en: "Mapping the global secondhand fashion market and its growth drivers", category: "fashion", tier: "pro" },
  { id: "FT-0133", title_es: "Fotografía de cascada con exposición larga y filtros ND", title_en: "Long exposure waterfall photography with ND filters", category: "photography", tier: "pro" },
  { id: "IL-0115", title_es: "Patrón de azulejo geométrico marroquí para marca de hospitalidad", title_en: "Moroccan geometric tile pattern for a hospitality brand", category: "illustration", tier: "pro" },
  { id: "BR-0003", title_es: "Esquema simple para una sesión de lluvia de ideas de naming", title_en: "Simple brand name brainstorm session outline", category: "branding", tier: "free" },
];

/** La rama ES o EN de una plantilla de Supabase, con sus variables llenas de ejemplo. */
function authBranch(kind: "magic_link" | "confirmation", lang: "es" | "en", email: string): EmailMessage {
  const t = supabaseAuthTemplate(kind);
  const open = t.html.indexOf("}}") + 2;
  const mid = t.html.indexOf("{{ else }}");
  const end = t.html.lastIndexOf("{{ end }}");
  const branch = lang === "es" ? t.html.slice(open, mid) : t.html.slice(mid + "{{ else }}".length, end);
  const html = branch.replaceAll("{{ .ConfirmationURL }}", `${SITE_URL}/${lang}`).replaceAll("{{ .Email }}", email);
  return { subject: t.subject, html, text: `${t.subject}\n\n${SITE_URL}/${lang}` };
}

export async function sampleEmail(kind: EmailKind, lang: "es" | "en", to: string): Promise<EmailMessage> {
  const sampleUnsub = `${SITE_URL}/${lang}`;
  switch (kind) {
    case "welcome":
      return welcomeEmail(await getWelcomeContent(), lang, sampleUnsub);
    case "roast":
      return roastReportEmail({ lang, brand: "Marca de ejemplo", result: { ...SAMPLE_ROAST, lang }, shareQuery: SAMPLE_ROAST_QUERY.replace("lang=es", `lang=${lang}`) });
    case "digest":
      return digestEmail({ lang, prompts: SAMPLE_PROMPTS, unsubscribeUrl: sampleUnsub });
    case "confirm":
      return listConfirmationEmail(lang, `${SITE_URL}/${lang}`, "pack_waitlist");
    case "auth_magic":
      return authBranch("magic_link", lang, to);
    case "auth_signup":
      return authBranch("confirmation", lang, to);
  }
}
