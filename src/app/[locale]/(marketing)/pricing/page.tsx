import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localeOf, pageMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card } from "@/components/ui";
import TrackOnMount from "@/components/analytics/TrackOnMount";
import ProCheckoutButton from "./ProCheckoutButton";

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
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("pricing", localeOf(locale));
}

function mxn(usd: number): string {
  return Math.round(usd * USD_MXN).toLocaleString("en-US");
}

export default async function PricingPage({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = getDictionary(locale).pricing;
  // FAQ copy is shared with the homepage (lives in the `home` dict block).
  const faqDict = getDictionary(locale).home;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  const showMxn = locale === "es" && t.mxn_note.length > 0;

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
        <p className="mx-auto mt-4 max-w-lg text-zinc-600">{t.sub}</p>
        <p className="mx-auto mt-4 max-w-xl text-sm text-zinc-500">{t.value_note}</p>
        <p className="mx-auto mt-2 max-w-xl font-mono text-[11px] text-zinc-500">{t.launch_note}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => (
          <Card key={tier.key} highlight={tier.highlight} className={`relative flex flex-col ${tier.soon ? "bg-zinc-50" : ""}`}>
            {tier.soon && (
              <Badge tone="soon" className="absolute -top-3 left-4 bg-white">
                {t.coming_soon}
              </Badge>
            )}
            {tier.highlight && (
              <Badge tone="inverse" className="absolute -top-3 left-4">
                {t.most_popular}
              </Badge>
            )}
            <h2 className="text-lg font-bold">{tier.name}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">{tier.tagline}</p>
            <div className="mt-4 min-h-[3.25rem]">
              {tier.usd === null ? (
                <span className="font-mono text-sm text-zinc-500">{t.no_price_yet}</span>
              ) : (
                <>
                  <span className="font-mono text-3xl font-bold tracking-tight">{tier.price}</span>
                  <span className="ml-1.5 font-mono text-xs text-zinc-500">{tier.period}</span>
                  {showMxn && tier.usd > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">
                      {t.mxn_note.replace("{mxn}", mxn(tier.usd))}
                    </p>
                  )}
                </>
              )}
            </div>
            <ul className="mt-6 flex-1 space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                  <span className="text-zinc-600">{f}</span>
                </li>
              ))}
            </ul>
            {tier.key === "pro" ? (
              <ProCheckoutButton href={tier.ctaHref} locale={locale} signedIn={signedIn} className="mt-6 w-full">
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
        <p className="text-xs text-zinc-500">{t.footnote}</p>
      </div>

      <div className="mt-16 border-t border-zinc-200 pt-16">
        <h2 className="text-h2 text-center">{t.compare_h2}</h2>
        <span className="accent-rule mx-auto mb-8 mt-4" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left">
                {t.compare_th.map((h) => (
                  <th key={h} className="py-3 pr-4 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-zinc-600">
              {t.compare_rows.map(([feature, ...tiers]) => (
                <tr key={feature} className="border-b border-zinc-100">
                  <td className="py-2.5 pr-4 font-medium text-zinc-900">{feature}</td>
                  {tiers.map((val, i) => (
                    <td key={i} className="py-2.5 pr-4 font-mono text-xs">
                      {val === "yes" ? (
                        <span role="img" aria-label={t.compare_yes} className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
                      ) : val === "no" ? (
                        <span className="text-zinc-300">&mdash;</span>
                      ) : val === "soon" ? (
                        <span className="text-zinc-500">{t.compare_soon}</span>
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
      <div className="mt-16 border-t border-zinc-200 pt-16">
        <h2 className="text-h2 text-center">{faqDict.faq_h2}</h2>
        <span className="accent-rule mx-auto mb-8 mt-4" />
        <div className="mx-auto max-w-3xl divide-y divide-zinc-200">
          {faqDict.faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-zinc-900 marker:content-none">
                {item.q}
                <span className="text-zinc-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
