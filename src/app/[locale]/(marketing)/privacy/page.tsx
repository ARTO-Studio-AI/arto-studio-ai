import type { Metadata } from "next";
import Link from "next/link";
import { localeOf, pageMetadata } from "@/lib/seo";
import { CookieSettingsButton } from "@/components/CookieBanner";

/* Aviso de privacidad (reescrito el 9 oct 2026, punto 13 de Victor). Describe lo que
 * el codigo hace hoy, nada mas: si cambia un proveedor, una cookie o una retencion,
 * se cambia aqui en el mismo PR. Fuentes: src/lib/consent.ts (cookies y aviso),
 * src/lib/analytics.ts (PostHog), src/lib/attribution.ts (asai_utm), src/proxy.ts
 * (asai_vid), src/lib/marketing-list.ts (lista y doble opt-in), docs/DECISIONES.md D9. */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("privacy", localeOf(locale));
}

const CONTACT = "contact@artogroup.com";
const UPDATED = { es: "9 de octubre de 2026", en: "October 9, 2026" };

type Cookie = { name: string; purpose: string; duration: string; kind: string };

const COOKIES: Record<"es" | "en", Cookie[]> = {
  es: [
    { name: "sb-…-auth-token(.N)", purpose: "Mantiene tu sesión iniciada (Supabase).", duration: "Hasta 400 días o hasta que cierres sesión", kind: "Esencial" },
    { name: "asai_vid", purpose: "Identificador anónimo para el contador de 3 prompts gratis al día y para evitar abusos.", duration: "1 año", kind: "Esencial" },
    { name: "NEXT_LOCALE", purpose: "Recuerda el idioma que elegiste.", duration: "1 año", kind: "Esencial" },
    { name: "asai_next, asai_signup", purpose: "Te regresan a la página donde estabas y guardan empresa y rol mientras creas tu cuenta.", duration: "15 a 60 minutos", kind: "Esencial" },
    { name: "asai_consent", purpose: "Guarda lo que elegiste en el aviso de cookies.", duration: "6 meses", kind: "Esencial" },
    { name: "asai_utm", purpose: "De qué campaña o sitio llegaste la primera vez (parámetros utm y sitio de origen, sin datos personales).", duration: "30 días", kind: "Analítica, solo con tu permiso" },
    { name: "ph_…_posthog", purpose: "Analítica de producto de PostHog: qué páginas y funciones se usan. PostHog guarda también un registro en el almacenamiento local del navegador.", duration: "1 año", kind: "Analítica, solo con tu permiso" },
  ],
  en: [
    { name: "sb-…-auth-token(.N)", purpose: "Keeps you signed in (Supabase).", duration: "Up to 400 days or until you sign out", kind: "Essential" },
    { name: "asai_vid", purpose: "Anonymous identifier for the 3 free prompts per day counter and to prevent abuse.", duration: "1 year", kind: "Essential" },
    { name: "NEXT_LOCALE", purpose: "Remembers the language you chose.", duration: "1 year", kind: "Essential" },
    { name: "asai_next, asai_signup", purpose: "Bring you back to the page you were on and keep company and role while you create your account.", duration: "15 to 60 minutes", kind: "Essential" },
    { name: "asai_consent", purpose: "Stores your choice in the cookie notice.", duration: "6 months", kind: "Essential" },
    { name: "asai_utm", purpose: "Which campaign or site brought you here the first time (utm parameters and referring site, no personal data).", duration: "30 days", kind: "Analytics, only with your permission" },
    { name: "ph_…_posthog", purpose: "PostHog product analytics: which pages and features get used. PostHog also keeps a record in the browser's local storage.", duration: "1 year", kind: "Analytics, only with your permission" },
  ],
};

type Provider = { name: string; what: string };

const PROVIDERS: Record<"es" | "en", Provider[]> = {
  es: [
    { name: "Supabase", what: "Base de datos y autenticación (enlace mágico y Google). Guarda tu cuenta, favoritos, colecciones y búsquedas." },
    { name: "Vercel", what: "Aloja el sitio. Vercel Web Analytics y Speed Insights miden visitas y velocidad de forma agregada y sin cookies." },
    { name: "Resend", what: "Envía los correos: enlaces de acceso, reporte del Brand Roast y, solo si lo aceptaste, promociones." },
    { name: "PostHog", what: "Analítica de producto, solo si la aceptas en el aviso de cookies. Te identificamos con un número interno, nunca con tu correo. Sin grabación de sesiones." },
    { name: "Anthropic", what: "Escribe las recomendaciones de la búsqueda y el análisis del Brand Roast. Recibe el texto de tu búsqueda o, en el roast, el nombre, industria, tamaño, sitio y descripción de la marca, más el texto público que leemos de ese sitio." },
    { name: "OpenAI", what: "Convierte el texto de tu búsqueda en un vector para encontrar los prompts más parecidos." },
    { name: "Google", what: "Solo si eliges iniciar sesión con Google: nos comparte tu nombre, correo y foto." },
    { name: "Stripe", what: "Procesa los pagos si contratas un plan. Nosotros solo guardamos tu id de cliente y el estado de la suscripción, nunca tu tarjeta." },
  ],
  en: [
    { name: "Supabase", what: "Database and authentication (magic link and Google). Stores your account, favorites, collections and searches." },
    { name: "Vercel", what: "Hosts the site. Vercel Web Analytics and Speed Insights measure visits and speed in aggregate, without cookies." },
    { name: "Resend", what: "Sends our emails: sign-in links, the Brand Roast report and, only if you opted in, promotions." },
    { name: "PostHog", what: "Product analytics, only if you accept it in the cookie notice. We identify you by an internal number, never by your email. No session recording." },
    { name: "Anthropic", what: "Writes the search recommendations and the Brand Roast analysis. Receives your search text or, in the roast, the brand's name, industry, size, website and description, plus the public text we read from that website." },
    { name: "OpenAI", what: "Turns your search text into a vector to find the closest prompts." },
    { name: "Google", what: "Only if you choose to sign in with Google: shares your name, email and photo with us." },
    { name: "Stripe", what: "Processes payments if you buy a plan. We only keep your customer id and subscription status, never your card." },
  ],
};

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = localeOf(raw) === "es" ? "es" : "en";
  const es = locale === "es";
  const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Legal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{es ? "Aviso de privacidad" : "Privacy policy"}</h1>
      <p className="mt-3 text-sm text-zinc-500">
        {es ? "Última actualización: " : "Last updated: "}
        {UPDATED[locale]}
      </p>

      <div className="prose prose-neutral mt-10 max-w-none text-zinc-800">
        {es ? (
          <p>
            ARTO Studio AI (creative.artostudio.ai, el «Servicio») es un producto de ARTO Group operado por ARTO Inc., sociedad constituida en Delaware, Estados Unidos, con domicilio en 101 Avenue of the Americas, Fl 8, New York, NY 10013, que también cobra los planes («nosotros») y es responsable de tus datos personales. Este aviso
            explica qué datos personales tratamos, para qué, con quién los compartimos y qué derechos tienes. Para
            cualquier duda o solicitud escríbenos a {mail}.
          </p>
        ) : (
          <p>
            ARTO Studio AI (creative.artostudio.ai, the &quot;Service&quot;) is an ARTO Group product operated by ARTO Inc., a Delaware corporation located at 101 Avenue of the Americas, Fl 8, New York, NY 10013, which also bills the plans (&quot;we&quot;) and is the controller of your personal data. This
            policy explains what personal data we process, why, who we share it with and what rights you have. For any
            question or request, email {mail}.
          </p>
        )}

        <h2>{es ? "Qué datos tratamos" : "What data we process"}</h2>
        <ul>
          <li>
            <strong>{es ? "Cuenta:" : "Account:"}</strong>{" "}
            {es
              ? "tu correo y, si los das, tu empresa y tu rol. Si entras con Google, también tu nombre y tu foto. Guardamos de qué campaña llegaste cuando aceptaste la analítica."
              : "your email and, if you provide them, your company and role. If you sign in with Google, also your name and photo. We store which campaign brought you if you accepted analytics."}
          </li>
          <li>
            <strong>{es ? "Uso:" : "Usage:"}</strong>{" "}
            {es
              ? "las búsquedas que haces (texto, idioma y resultado), los prompts que abres, favoritos y colecciones, y cuántos prompts gratis abriste hoy."
              : "the searches you run (text, language and result), the prompts you open, favorites and collections, and how many free prompts you opened today."}
          </li>
          <li>
            <strong>Brand Roast:</strong>{" "}
            {es
              ? "el nombre, sitio web, industria, tamaño de empresa y descripción de la marca que evalúas, y el resultado. Nuestro servidor lee la página pública de ese sitio. Si dejas tu correo para recibir el reporte, lo guardamos con el resultado."
              : "the name, website, industry, company size and description of the brand you roast, and the result. Our server reads the public page of that website. If you leave your email to get the report, we store it with the result."}
          </li>
          <li>
            <strong>{es ? "Pagos:" : "Payments:"}</strong>{" "}
            {es
              ? "si contratas un plan, tu id de cliente de Stripe, tu plan y el estado de la suscripción."
              : "if you buy a plan, your Stripe customer id, plan and subscription status."}
          </li>
          <li>
            <strong>{es ? "Técnicos:" : "Technical:"}</strong>{" "}
            {es
              ? "registros del servidor (rutas y errores) y tu IP para limitar abusos, que se borra a los 7 días."
              : "server logs (paths and errors) and your IP to limit abuse, deleted after 7 days."}
          </li>
        </ul>

        <h2>{es ? "Para qué los usamos" : "Why we use it"}</h2>
        <ul>
          {(es
            ? [
                "Darte acceso a tu cuenta, tus favoritos y colecciones, y aplicar el límite del plan gratis.",
                "Responder tus búsquedas y generar el Brand Roast.",
                "Mandarte los correos que pediste: enlaces de acceso y el reporte del roast.",
                "Mejorar el catálogo con lo que la gente busca y no encuentra.",
                "Cobrar tu plan, si contratas uno.",
                "Medir qué funciona del sitio, solo si aceptas la analítica.",
                "Mandarte promociones, prompts nuevos y lanzamientos, solo si marcaste la casilla para recibirlos.",
              ]
            : [
                "Give you access to your account, favorites and collections, and apply the free plan limit.",
                "Answer your searches and generate the Brand Roast.",
                "Send the emails you asked for: sign-in links and the roast report.",
                "Improve the catalog with what people search for and don't find.",
                "Charge your plan, if you buy one.",
                "Measure what works on the site, only if you accept analytics.",
                "Send you promotions, new prompts and launches, only if you ticked the box to receive them.",
              ]
          ).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <h2>{es ? "Correos de promoción" : "Promotional emails"}</h2>
        <p>
          {es
            ? "Solo te escribimos promociones si lo aceptaste de forma expresa: la casilla viene sin marcar. Si la marcas al crear tu cuenta, el enlace de acceso ya confirma que el correo es tuyo. Si la marcas en el Brand Roast, te mandamos un correo para confirmar y no te escribimos nada más hasta que confirmes. Cada correo trae un botón para darte de baja; la baja no afecta los correos de acceso ni los recibos."
            : "We only send promotions if you expressly opted in: the box comes unticked. If you tick it when you create your account, the sign-in link already proves the address is yours. If you tick it in the Brand Roast, we send a confirmation email and send nothing else until you confirm. Every email has an unsubscribe button; unsubscribing doesn't affect sign-in emails or receipts."}
        </p>

        <h2>{es ? "Con quién los compartimos" : "Who we share it with"}</h2>
        <p>
          {es
            ? "Solo con los proveedores que necesitamos para dar el Servicio, para el fin que se indica. No vendemos ni rentamos tus datos y no los usamos para entrenar modelos de terceros."
            : "Only with the providers we need to run the Service, for the stated purpose. We don't sell or rent your data and we don't use it to train third-party models."}
        </p>
        <ul>
          {PROVIDERS[locale].map((p) => (
            <li key={p.name}>
              <strong>{p.name}:</strong> {p.what}
            </li>
          ))}
        </ul>
        <p>
          {es
            ? "Tus datos se tratan en Estados Unidos, donde están ARTO Inc. y la mayoría de estos proveedores, con las garantías de sus propios contratos de tratamiento de datos."
            : "Your data is processed in the United States, where ARTO Inc. and most of these providers are based, under the safeguards of their own data processing agreements."}
        </p>

        <h2 id="cookies">Cookies</h2>
        <p>
          {es
            ? "Usamos cookies esenciales sin pedirte permiso, porque sin ellas el sitio no funciona. La analítica solo se activa si la aceptas en el aviso de cookies; si eliges «Solo esenciales» o no respondes, no se activa. No usamos cookies de publicidad. Puedes cambiar tu elección cuando quieras:"
            : "We use essential cookies without asking, because the site doesn't work without them. Analytics only turns on if you accept it in the cookie notice; if you choose \"Essential only\" or don't answer, it stays off. We don't use advertising cookies. You can change your choice at any time:"}{" "}
          <CookieSettingsButton label={es ? "abrir preferencias de cookies" : "open cookie preferences"} className="underline" />.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Cookie</th>
                <th className="py-2 pr-4 font-medium">{es ? "Para qué" : "Purpose"}</th>
                <th className="py-2 pr-4 font-medium">{es ? "Duración" : "Duration"}</th>
                <th className="py-2 font-medium">{es ? "Tipo" : "Type"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {COOKIES[locale].map((c) => (
                <tr key={c.name}>
                  <td className="py-2 pr-4 font-mono text-xs">{c.name}</td>
                  <td className="py-2 pr-4">{c.purpose}</td>
                  <td className="py-2 pr-4">{c.duration}</td>
                  <td className="py-2">{c.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          {es
            ? "Si visitaste otros sitios de artostudio.ai, tu navegador puede mostrar cookies de esos sitios (por ejemplo de Google Analytics o Meta). Este Servicio no las crea ni las lee."
            : "If you visited other artostudio.ai sites, your browser may show cookies from them (for example Google Analytics or Meta). This Service doesn't create or read them."}
        </p>

        <h2>{es ? "Cuánto tiempo los guardamos" : "How long we keep it"}</h2>
        <p>
          {es
            ? "Tu cuenta y lo que guardas en ella se conservan mientras la cuenta exista. El texto de tus búsquedas se borra a los 12 meses. Si pides borrarla, eliminamos tus datos personales en un plazo de 30 días, salvo lo que la ley nos obligue a conservar (por ejemplo, registros de pago). Si te das de baja de la lista de correo, guardamos tu correo marcado como baja para no volver a escribirte."
            : "Your account and what you save in it are kept while the account exists. Your search text is deleted after 12 months. If you ask us to delete it, we remove your personal data within 30 days, except what the law requires us to keep (for example, payment records). If you unsubscribe from the mailing list, we keep your email marked as unsubscribed so we don't write to you again."}
        </p>

        <h2>{es ? "Tus derechos" : "Your rights"}</h2>
        <p>
          {es
            ? "Puedes pedir acceso a tus datos, corregirlos, cancelarlos u oponerte a su uso (derechos ARCO), retirar tu consentimiento y limitar el uso de tus datos. Si estás en la Unión Europea, también puedes pedir la portabilidad y presentar una queja ante tu autoridad de protección de datos. Escríbenos a "
            : "You can ask to access, correct or delete your data, object to its use, withdraw your consent and limit how we use it. If you are in the European Union, you can also ask for portability and lodge a complaint with your data protection authority. Email "}
          {mail}
          {es
            ? " desde el correo de tu cuenta. Respondemos en un máximo de 20 días hábiles, o de un mes si estás en la Unión Europea."
            : " from your account email. We reply within 20 business days, or within one month if you are in the European Union."}
        </p>

        <h2>{es ? "Menores de edad" : "Minors"}</h2>
        <p>
          {es
            ? "El Servicio está pensado para profesionales y no está dirigido a menores de 18 años."
            : "The Service is meant for professionals and is not directed at anyone under 18."}
        </p>

        <h2>{es ? "Cambios a este aviso" : "Changes to this policy"}</h2>
        <p>
          {es
            ? "Si cambiamos de forma importante cómo tratamos tus datos, actualizamos esta página y, cuando el cambio lo amerite, avisamos por correo a quien tenga cuenta. La fecha de arriba indica la versión vigente."
            : "If we materially change how we handle your data, we update this page and, when the change warrants it, email account holders. The date at the top shows the current version."}
        </p>

        <hr />
        <p className="text-sm text-zinc-500">
          {es ? "Ver también: " : "See also: "}
          <Link href={`/${locale}/terms`}>{es ? "Términos del servicio" : "Terms of Service"}</Link>
        </p>
      </div>
    </article>
  );
}
