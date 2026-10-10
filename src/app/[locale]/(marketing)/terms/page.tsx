import type { Metadata } from "next";
import Link from "next/link";
import { localeOf, pageMetadata } from "@/lib/seo";

/* Términos del servicio (reescritos el 9 oct 2026, pregunta 14 de Victor). Mismo operador
 * que el aviso de privacidad: ARTO Inc., la empresa de EE.UU. que cobra los planes
 * (respuesta 13). Si cambia el operador, la ley aplicable o los planes, se cambia aquí y
 * en /privacy en el mismo PR. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("terms", localeOf(locale));
}

const CONTACT = "contact@artogroup.com";

type Section = { h: string; p: string[]; list?: string[] };

const COPY: Record<"es" | "en", { title: string; updated: string; intro: string; sections: Section[]; see: string; privacy: string }> = {
  es: {
    title: "Términos del servicio",
    updated: "Última actualización: 9 de octubre de 2026",
    intro:
      "Estos son los Términos del servicio («Términos») de ARTO Studio AI (creative.artostudio.ai, el «Servicio»), un producto de ARTO Group operado por ARTO Inc., sociedad constituida en Delaware, Estados Unidos, con domicilio en 101 Avenue of the Americas, Fl 8, New York, NY 10013 («nosotros»). Al usar el Servicio aceptas estos Términos. Si no estás de acuerdo, no uses el Servicio.",
    sections: [
      {
        h: "Qué es el Servicio",
        p: [
          "Una biblioteca de prompts de estrategia y creatividad en español e inglés, el Brand Roast (un análisis de marca hecho con IA) y, cuando estén disponibles, skills y agentes. Para recomendar prompts y escribir el roast usamos proveedores de IA (OpenAI y Anthropic), como explica el aviso de privacidad.",
        ],
      },
      {
        h: "Cuentas",
        p: [
          "Para abrir los prompts completos necesitas una cuenta gratis. La cuenta gratis permite abrir 3 prompts al día. Eres responsable de lo que pase con tu cuenta: no compartas tu enlace de acceso ni tu sesión y avísanos si crees que alguien más entró.",
        ],
      },
      {
        h: "Uso permitido",
        p: ["Te comprometes a no:"],
        list: [
          "Revender, redistribuir o publicar los prompts como tu propio catálogo. Tienes licencia para usarlos en tu trabajo, no para revenderlos.",
          "Usar el Servicio para generar contenido ilegal, difamatorio o que viole la propiedad intelectual de otros.",
          "Extraer el catálogo de forma sistemática.",
          "Saltarte los límites de uso, los planes u otros controles de acceso.",
          "Interferir con el funcionamiento del Servicio o con el acceso de otras personas.",
        ],
      },
      {
        h: "Propiedad intelectual",
        p: [
          "Los prompts, la estructura del catálogo, el diseño y el código son de ARTO. Te damos una licencia no exclusiva e intransferible para usar los prompts a los que tengas acceso según tu plan en tu propio trabajo creativo y comercial, incluido el trabajo para clientes.",
          "Lo que generes al usar nuestros prompts con proveedores de IA es tuyo, sujeto a los términos de esos proveedores. No reclamamos la propiedad de lo que produzcas.",
        ],
      },
      {
        h: "Planes de pago",
        p: [
          "Los planes de pago se cobran por adelantado a través de Stripe. Las suscripciones se renuevan solas y las puedes cancelar cuando quieras desde tu cuenta («Administrar facturación»); el acceso sigue hasta el final del periodo pagado. No hacemos reembolsos por periodos parciales, salvo lo que exija la ley. Si algún producto se vende en un solo pago, su página dirá qué incluye y por cuánto tiempo.",
        ],
      },
      {
        h: "Proveedores de IA",
        p: [
          "No controlamos cómo se comportan los modelos de terceros ni lo que generan. No escribas información confidencial ni datos personales en las búsquedas ni en las descripciones del roast.",
        ],
      },
      {
        h: "Sin garantías",
        p: [
          "El Servicio se ofrece «tal cual». Trabajamos para que sea útil y confiable, pero no garantizamos que funcione sin interrupciones ni errores, ni que sirva para un fin específico. Los prompts y el roast son herramientas de trabajo; no prometemos resultados de negocio concretos.",
        ],
      },
      {
        h: "Límite de responsabilidad",
        p: [
          "En la medida en que la ley lo permita, ARTO Inc. no responde por daños indirectos, incidentales, especiales o consecuentes derivados del uso del Servicio. Nuestra responsabilidad total se limita a lo que nos hayas pagado en los 12 meses anteriores al hecho que origine el reclamo, o a 100 dólares, lo que sea mayor.",
        ],
      },
      {
        h: "Terminación",
        p: [
          `Puedes cerrar tu cuenta cuando quieras escribiendo a ${CONTACT}. Podemos suspender o cerrar cuentas que incumplan estos Términos, con aviso previo cuando sea razonable.`,
        ],
      },
      {
        h: "Ley aplicable",
        p: [
          "Estos Términos se rigen por las leyes del estado de Delaware, Estados Unidos, y las controversias se resolverán ante sus tribunales competentes. Esto no te quita los derechos que te dé la ley de protección al consumidor de tu país.",
        ],
      },
      {
        h: "Cambios",
        p: [
          "Podemos actualizar estos Términos. Si el cambio es importante, lo avisamos por correo a quien tenga cuenta y lo publicamos aquí. Seguir usando el Servicio después del cambio significa que aceptas la nueva versión.",
        ],
      },
      {
        h: "Contacto",
        p: [`Dudas, quejas o avisos: ${CONTACT}.`],
      },
    ],
    see: "Ver también: ",
    privacy: "Aviso de privacidad",
  },
  en: {
    title: "Terms of Service",
    updated: "Last updated: October 9, 2026",
    intro:
      "These are the Terms of Service (\"Terms\") for ARTO Studio AI (creative.artostudio.ai, the \"Service\"), an ARTO Group product operated by ARTO Inc., a Delaware corporation located at 101 Avenue of the Americas, Fl 8, New York, NY 10013 (\"we\"). By using the Service you agree to these Terms. If you don't agree, please don't use the Service.",
    sections: [
      {
        h: "What the Service is",
        p: [
          "A library of strategy and creative prompts in English and Spanish, the Brand Roast (an AI brand analysis) and, when available, skills and agents. To recommend prompts and write the roast we use AI providers (OpenAI and Anthropic), as the privacy policy explains.",
        ],
      },
      {
        h: "Accounts",
        p: [
          "You need a free account to open full prompts. The free account lets you open 3 prompts a day. You are responsible for activity on your account: don't share your sign-in link or session, and tell us if you think someone else got in.",
        ],
      },
      {
        h: "Acceptable use",
        p: ["You agree not to:"],
        list: [
          "Resell, redistribute or republish the prompts as your own catalog. They are licensed for your own work, not for resale.",
          "Use the Service to generate content that is illegal, defamatory or that infringes someone else's intellectual property.",
          "Scrape the catalog systematically.",
          "Bypass usage limits, plans or other access controls.",
          "Interfere with the Service or with other people's access.",
        ],
      },
      {
        h: "Intellectual property",
        p: [
          "The prompts, the catalog structure, the design and the code belong to ARTO. We grant you a non-exclusive, non-transferable license to use the prompts your plan gives you access to in your own creative and commercial work, including work for clients.",
          "What you generate by running our prompts through AI providers is yours, subject to those providers' terms. We don't claim ownership of what you produce.",
        ],
      },
      {
        h: "Paid plans",
        p: [
          "Paid plans are billed in advance through Stripe. Subscriptions renew automatically and you can cancel at any time from your account (\"Manage billing\"); access continues until the end of the paid period. We don't refund partial periods, except as required by law. If a product is sold as a one-time purchase, its page will say what it includes and for how long.",
        ],
      },
      {
        h: "AI providers",
        p: [
          "We don't control how third-party models behave or what they generate. Don't put confidential information or personal data in searches or roast descriptions.",
        ],
      },
      {
        h: "No warranties",
        p: [
          "The Service is provided \"as is\". We work to make it useful and reliable, but we don't guarantee it will be uninterrupted or error-free, or fit a particular purpose. The prompts and the roast are working tools; we don't promise specific business results.",
        ],
      },
      {
        h: "Limitation of liability",
        p: [
          "To the extent permitted by law, ARTO Inc. is not liable for indirect, incidental, special or consequential damages arising from your use of the Service. Our total liability is capped at what you paid us in the 12 months before the event giving rise to the claim, or USD 100, whichever is greater.",
        ],
      },
      {
        h: "Termination",
        p: [
          `You can close your account at any time by emailing ${CONTACT}. We can suspend or close accounts that break these Terms, with prior notice when reasonable.`,
        ],
      },
      {
        h: "Governing law",
        p: [
          "These Terms are governed by the laws of the State of Delaware, United States, and disputes will be resolved in its competent courts. This doesn't take away any rights your country's consumer protection law gives you.",
        ],
      },
      {
        h: "Changes",
        p: [
          "We may update these Terms. Material changes will be emailed to account holders and posted here. Continued use after a change means you accept the new version.",
        ],
      },
      {
        h: "Contact",
        p: [`Questions, complaints or notices: ${CONTACT}.`],
      },
    ],
    see: "See also: ",
    privacy: "Privacy policy",
  },
};

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = localeOf(raw) === "es" ? "es" : "en";
  const t = COPY[locale];

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Legal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{t.title}</h1>
      <p className="mt-3 text-sm text-zinc-500">{t.updated}</p>

      <div className="prose prose-neutral mt-10 max-w-none text-zinc-800">
        <p>{t.intro}</p>
        {t.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <hr />
        <p className="text-sm text-zinc-500">
          {t.see}
          <Link href={`/${locale}/privacy`}>{t.privacy}</Link>
        </p>
      </div>
    </article>
  );
}
