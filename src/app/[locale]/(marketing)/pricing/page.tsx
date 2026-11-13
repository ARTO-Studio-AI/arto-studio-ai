import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localeOf, pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card } from "@/components/ui";
import TrackOnMount from "@/components/analytics/TrackOnMount";
import { promoSigningReady } from "@/lib/promo-server";
import { anyLivePromo } from "@/lib/promos/estado";
import ProCheckoutButton from "./ProCheckoutButton";
import PromoPrice from "./PromoPrice";

/* Precios segun la decision D7 de Victor (11 sep 2026): Free $0 con 3 prompts al
 * dia, Pro $9 USD, Studio $29 USD marcado como proximamente (no existe checkout:
 * solo hay STRIPE_PRICE_ID_PRO y _STARTER), Agentes sin precio. Son precios de
 * lanzamiento; se pueden subir despues. USD explicito en toda cifra y, en /es,
 * una linea "≈ $X MXN" solo informativa.
 *
 * Pro $9 checkout is internal. The route is auth-gated: if the user isn't
 * signed in, /api/stripe/checkout/pro bounces them to /login with a `next`
 * param and returns here after sign-in. After payment, Stripe redirects
 * to /account?upgraded=pro and the existing webhook updates profiles.tier. */
const PRO_CHECKOUT_HREF = "/api/stripe/checkout/pro";
const USD_MXN = 16.89; // aproximado, solo referencia

interface Props {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("pricing", localeOf(locale));
}

function mxn(usd: number): string {
  return Math.round(usd * USD_MXN).toLocaleString("en-US");
}

export default async function PricingPage({ params, searchParams }: Props) {
  const { locale: localeParam } = await params;
  const sp = (await searchParams) ?? {};
  const promoUnavailable = sp.error === "promo_unavailable";
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = getDictionary(locale).pricing;
  // FAQ copy is shared with the homepage (lives in the `home` dict block).
  const faqDict = getDictionary(locale).home;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  const showMxn = locale === "es" && t.mxn_note.length > 0;
  // Promos (5 nov 2026): sin ninguna promo viva (de /admin/promociones o la de
  // STRIPE_PROMO_COUPON_24H) la tarjeta de Pro no cambia y ni se pregunta a /api/promo.
  // Esta pagina es dinamica, asi que el dato es de este momento (cache de 60 s).
  const promoCopy = promoSigningReady() && (await anyLivePromo()) ? getDictionary(locale).promo : null;

  /* Solo para las propiedades de pricing_viewed y checkout_started; la pagina
   * se ve igual con o sin sesion. Sin env de Supabase (build) cuenta como anonimo. */
  let signedIn = false;
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    signedIn = !!user;
  } catch {
    signedIn = false;
  }

  type TierCard = {
    key: string;
    name: string;
    tagline: string;
    price: string;
    usd: number | null;
    period: string;
    cta: string;
    ctaHref: string;
    ctaVariant: "primary" | "secondary" | "ghost";
    soon: boolean;
    highlight: boolean;
    features: readonly string[];
  };

  const TIERS: TierCard[] = [
    {
      key: "free",
      name: t.tier_free_name,
      tagline: t.tier_free_tagline,
      price: t.tier_free_price,
      usd: 0,
      period: t.tier_free_period,
      cta: t.tier_free_cta,
      ctaHref: lp("/prompts"),
      ctaVariant: "secondary",
      soon: false,
      highlight: false,
      features: t.tier_free_features,
    },
    {
      key: "pro",
      name: t.tier_pro_name,
      tagline: t.tier_pro_tagline,
      price: t.tier_pro_price,
      usd: 9,
      period: t.tier_pro_period,
      cta: t.tier_pro_cta,
      ctaHref: PRO_CHECKOUT_HREF,
      ctaVariant: "primary",
      soon: false,
      highlight: true,
      features: t.tier_pro_features,
    },
    {
      key: "studio",
      name: t.tier_skills_name,
      tagline: t.tier_skills_tagline,
      price: t.tier_skills_price,
      usd: 29,
      period: t.tier_skills_period,
      cta: t.tier_skills_cta,
      ctaHref: lp("/skills"),
      ctaVariant: "ghost",
      soon: true,
      highlight: false,
      features: t.tier_skills_features,
    },
    {
      key: "agents",
      name: t.tier_agents_name,
      tagline: t.tier_agents_tagline,
      price: "",
      usd: null,
      period: "",
      cta: t.tier_agents_cta,
      ctaHref: lp("/agents"),
      ctaVariant: "ghost",
      soon: true,
      highlight: false,
      features: t.tier_agents_features,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <TrackOnMount event="pricing_viewed" props={{ locale, signed_in: signedIn }} />
      <div className="mb-12 text-center">
        <h1 className="text-h1 tracking-tight">{t.h1}</h1>
        <span className="accent-rule mx-auto mt-4" />
        <p className="mx-auto mt-4 max-w-lg text-[var(--ink-2)]">{t.sub}</p>
        <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--ink-2)]">{t.value_note}</p>
        <p className="mx-auto mt-2 max-w-xl font-mono text-[11px] text-[var(--ink-2)]">{t.launch_note}</p>
      </div>

      {promoUnavailable && (
        <p role="alert" className="mx-auto mb-8 max-w-xl rounded-[var(--radius-lg)] border border-[var(--line)] bg-white px-4 py-3 text-center text-sm text-black">
          {getDictionary(locale).promo.unavailable}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          /* Marca v2.0: Pro es la tarjeta azul destacada (letra blanca, boton blanco, insignia lima). */
          <Card
            key={tier.key}
            tone={tier.highlight ? "blue" : "white"}
            className={`relative flex flex-col ${tier.highlight ? "shadow-[0_18px_50px_rgba(30,0,255,0.28)] lg:-translate-y-3" : ""}`}
          >
            {tier.soon && (
              <Badge tone="soon" className="absolute -top-3 left-4">
                {t.coming_soon}
              </Badge>
            )}
            {tier.highlight && (
              <Badge tone="tier" className="absolute -top-3 left-4 border-black">
                {t.most_popular}
              </Badge>
            )}
            <h2 className="text-lg font-bold">{tier.name}</h2>
            <p className="mt-0.5 text-sm text-[var(--ink-2)]">{tier.tagline}</p>
            <div className="mt-4 min-h-[3.25rem]">
              {tier.usd === null ? (
                <span className="font-mono text-sm text-[var(--ink-2)]">{t.no_price_yet}</span>
              ) : (
                <PromoPrice copy={tier.key === "pro" ? promoCopy : null} locale={locale}>
                  <span className="font-mono text-3xl font-bold tracking-tight">{tier.price}</span>
                  <span className="ml-1.5 font-mono text-xs text-[var(--ink-2)]">{tier.period}</span>
                  {showMxn && tier.usd > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-[var(--ink-2)]">
                      {t.mxn_note.replace("{mxn}", mxn(tier.usd))}
                    </p>
                  )}
                </PromoPrice>
              )}
            </div>
            <ul className="mt-6 flex-1 space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${tier.highlight ? "bg-[var(--lime)]" : "bg-[var(--accent)]"}`} aria-hidden="true" />
                  <span className={tier.highlight ? "text-white" : "text-[var(--ink-2)]"}>{f}</span>
                </li>
              ))}
            </ul>
            {tier.key === "pro" ? (
              <ProCheckoutButton href={tier.ctaHref} locale={locale} signedIn={signedIn} variant="white" className="mt-6 w-full">
                {tier.cta}
              </ProCheckoutButton>
            ) : (
              <Button href={tier.ctaHref} variant={tier.ctaVariant} className="mt-6 w-full">
                {tier.cta}
              </Button>
            )}
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-2xl text-center">
        <p className="text-xs text-[var(--ink-2)]">{t.footnote}</p>
      </div>

      <div className="mt-16 border-t border-[var(--line)] pt-16">
        <h2 className="text-h2 text-center">{t.compare_h2}</h2>
        <span className="accent-rule mx-auto mb-8 mt-4" />
        {/* Tabla en recuadro blanco; la columna Pro (indice 2) va en azul con letra blanca. */}
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left">
                {t.compare_th.map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] ${i === 2 ? "bg-[var(--accent)] text-white" : "text-[var(--ink-2)]"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[var(--ink-2)]">
              {t.compare_rows.map(([feature, ...tiers]) => (
                <tr key={feature} className="border-b border-[var(--line)] last:border-b-0">
                  <td className="px-4 py-2.5 font-medium text-black">{feature}</td>
                  {tiers.map((val, i) => (
                    <td key={i} className={`px-4 py-2.5 font-mono text-xs ${i === 1 ? "bg-[var(--accent)] text-white" : ""}`}>
                      {val === "yes" ? (
                        <span role="img" aria-label={t.compare_yes} className={`inline-block h-2 w-2 rounded-full ${i === 1 ? "bg-white" : "bg-[var(--accent)]"}`} />
                      ) : val === "no" ? (
                        <span className={i === 1 ? "text-white" : "text-[var(--ink-3)]"}>&mdash;</span>
                      ) : val === "soon" ? (
                        <span className={i === 1 ? "text-white" : "text-[var(--ink-2)]"}>{t.compare_soon}</span>
                      ) : (
                        val
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ — shared purchase-friction questions, native accordion */}
      <div className="mt-16 border-t border-[var(--line)] pt-16">
        <h2 className="text-h2 text-center">{faqDict.faq_h2}</h2>
        <span className="accent-rule mx-auto mb-8 mt-4" />
        <div className="mx-auto max-w-3xl divide-y divide-[var(--line)]">
          {faqDict.faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-black marker:content-none">
                {item.q}
                <span className="text-[var(--ink-2)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-2)]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
