import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localeOf, pageMetadata } from "@/lib/seo";

/* Pro $9 checkout is internal. The route is auth-gated: if the user isn't
 * signed in, /api/stripe/checkout/pro bounces them to /login with a `next`
 * param and returns here after sign-in. After payment, Stripe redirects
 * to /account?upgraded=pro and the existing webhook updates profiles.tier.
 */
const PRO_CHECKOUT_HREF = "/api/stripe/checkout/pro";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("pricing", localeOf(locale));
}

export default async function PricingPage({ params }: Props) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const t = getDictionary(locale).pricing;
  // FAQ copy is shared with the homepage (lives in the `home` dict block).
  const faqDict = getDictionary(locale).home;
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;

  // Build the 4 tiers from the dictionary. Keep styling and CTA targets in
  // code because they don't translate; everything else is dictionary-driven.
  const TIERS = [
    {
      name: t.tier_free_name,
      tagline: t.tier_free_tagline,
      price: t.tier_free_price,
      period: t.tier_free_period,
      cta: t.tier_free_cta,
      ctaHref: "/roast",
      external: false,
      ctaStyle: "border border-neutral-300 text-neutral-700 hover:border-neutral-400",
      badge: null as string | null,
      highlight: false,
      features: t.tier_free_features,
    },
    {
      name: t.tier_pro_name,
      tagline: t.tier_pro_tagline,
      price: t.tier_pro_price,
      period: t.tier_pro_period,
      cta: t.tier_pro_cta,
      ctaHref: PRO_CHECKOUT_HREF,
      external: false,
      ctaStyle: "bg-neutral-900 text-white hover:bg-neutral-700",
      badge: null,
      highlight: true,
      features: t.tier_pro_features,
    },
    {
      name: t.tier_skills_name,
      tagline: t.tier_skills_tagline,
      price: t.tier_skills_price,
      period: t.tier_skills_period,
      cta: t.tier_skills_cta,
      ctaHref: lp("/skills"),
      external: false,
      ctaStyle: "border border-neutral-300 text-neutral-700 hover:border-neutral-400",
      badge: t.coming_soon,
      highlight: false,
      features: t.tier_skills_features,
    },
    {
      name: t.tier_agents_name,
      tagline: t.tier_agents_tagline,
      price: t.tier_agents_price,
      period: t.tier_agents_period,
      cta: t.tier_agents_cta,
      ctaHref: lp("/agents"),
      external: false,
      ctaStyle: "border border-neutral-300 text-neutral-700 hover:border-neutral-400",
      badge: t.coming_soon,
      highlight: false,
      features: t.tier_agents_features,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.h1}</h1>
        <p className="mx-auto mt-3 max-w-lg text-neutral-600">{t.sub}</p>
        <p className="mx-auto mt-4 max-w-xl text-sm text-neutral-500">{t.value_note}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => {
          const ctaClasses = `mt-6 block rounded-md px-4 py-2.5 text-center text-sm font-medium transition ${tier.ctaStyle}`;
          return (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-xl border bg-white p-6 ${
                tier.highlight ? "border-2 border-neutral-900" : "border-neutral-200"
              }`}
            >
              {tier.badge && (
                <span className="absolute -top-3 left-4 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {tier.badge}
                </span>
              )}
              {tier.highlight && (
                <span className="absolute -top-3 left-4 rounded bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">
                  {t.most_popular}
                </span>
              )}
              <h2 className="text-lg font-bold">{tier.name}</h2>
              <p className="mt-0.5 text-sm text-neutral-500">{tier.tagline}</p>
              <div className="mt-4">
                <span className="text-3xl font-extrabold">{tier.price}</span>
                <span className="ml-1 text-sm text-neutral-400">{tier.period}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-green-500">&#10003;</span>
                    <span className="text-neutral-600">{f}</span>
                  </li>
                ))}
              </ul>
              {tier.external ? (
                <a
                  href={tier.ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ctaClasses}
                >
                  {tier.cta}
                </a>
              ) : (
                <Link href={tier.ctaHref} className={ctaClasses}>
                  {tier.cta}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-12 max-w-2xl text-center">
        <p className="text-xs text-neutral-400">{t.footnote}</p>
      </div>

      <div className="mt-16 border-t border-neutral-200 pt-16">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">{t.compare_h2}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left">
                {t.compare_th.map((h) => (
                  <th key={h} className="py-3 pr-4 text-xs uppercase text-neutral-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-neutral-600">
              {t.compare_rows.map(([feature, ...tiers]) => (
                <tr key={feature} className="border-b border-neutral-100">
                  <td className="py-2.5 pr-4 font-medium text-neutral-900">{feature}</td>
                  {tiers.map((val, i) => (
                    <td key={i} className="py-2.5 pr-4">
                      {val === "yes" ? (
                        <span className="text-green-500">&#10003;</span>
                      ) : val === "no" ? (
                        <span className="text-neutral-300">&mdash;</span>
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
      <div className="mt-16 border-t border-neutral-200 pt-16">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight">{faqDict.faq_h2}</h2>
        <div className="mx-auto max-w-3xl divide-y divide-neutral-200">
          {faqDict.faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-neutral-900 marker:content-none">
                {item.q}
                <span className="text-neutral-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
