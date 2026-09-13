import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmailAsync } from "@/lib/auth";
import { isLocale, type Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { localeOf, pageMetadata } from "@/lib/seo";
import { UpgradePendingNotice } from "./UpgradePendingNotice";

/* Account page. Shows email, plan, subscription state and billing portal.
   After Stripe Checkout, /api/stripe/checkout/pro sends the user here with
   ?upgraded=pro; the tier itself is written by the webhook, so the page
   reads the real profile and, while it is still `free`, polls until it
   flips (UpgradePendingNotice). Nothing here trusts the query string. */

/* Chips monocromos: el plan lo dice el texto; los pagados van en tinta inversa. */
const TIER_LABELS: Record<string, { label: string; chip: string }> = {
  free: { label: "Free", chip: "bg-zinc-100 text-zinc-700" },
  pro: { label: "Pro", chip: "bg-zinc-900 text-white" },
  skills: { label: "Studio", chip: "bg-zinc-900 text-white" },
  agents: { label: "AI Agents", chip: "bg-zinc-900 text-white" },
  enterprise: { label: "Enterprise", chip: "bg-zinc-900 text-white" },
};

const SUBSCRIPTION_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    active: "Active",
    past_due: "Payment past due",
    canceled: "Canceled",
    inactive: "Inactive",
  },
  es: {
    active: "Activa",
    past_due: "Pago pendiente",
    canceled: "Cancelada",
    inactive: "Inactiva",
  },
};

const COPY: Record<
  Locale,
  {
    subscription: string;
    renews: string;
    ends: string;
    manage: string;
    upgradedDone: string;
    pastDue: string;
  }
> = {
  en: {
    subscription: "Subscription",
    renews: "Renews on",
    ends: "Access until",
    manage: "Manage billing",
    upgradedDone: "Your Prompts Pro plan is active.",
    pastDue:
      "Your last payment failed. Update your card in the billing portal to keep your plan.",
  },
  es: {
    subscription: "Suscripción",
    renews: "Se renueva el",
    ends: "Acceso hasta el",
    manage: "Administrar facturación",
    upgradedDone: "Tu plan Prompts Pro está activo.",
    pastDue:
      "Tu último pago falló. Actualiza tu tarjeta en el portal de facturación para conservar tu plan.",
  },
};

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ upgraded?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("account", localeOf(locale));
}

export default async function AccountPage({ params, searchParams }: Props) {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "en";
  const { upgraded } = await searchParams;
  const copy = COPY[locale];

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await sb
    .from("profiles")
    .select(
      "email, tier, created_at, stripe_customer_id, subscription_status, subscription_ends_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  const tierKey = (profile?.tier as string | undefined) ?? "free";
  const tierStyle = TIER_LABELS[tierKey] ?? TIER_LABELS.free;
  const subscriptionStatus = (profile?.subscription_status as string | null) ?? null;
  const subscriptionEndsAt = profile?.subscription_ends_at
    ? new Date(profile.subscription_ends_at as string)
    : null;
  const hasStripeCustomer = Boolean(profile?.stripe_customer_id);
  const upgradePending = upgraded === "pro" && tierKey === "free";
  const upgradeDone = upgraded === "pro" && tierKey === "pro";

  // Server-side admin check against ADMIN_EMAILS allowlist. Renders an
  // additional card linking to /admin if the visitor is on the list.
  const isAdmin = await isAdminEmailAsync(user.email);
  const dateLocale = locale === "es" ? "es-MX" : "en-US";
  const formatDate = (d: Date) =>
    d.toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" });
  const memberSince = profile?.created_at ? formatDate(new Date(profile.created_at)) : null;

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Account</h1>

      {upgradePending && <UpgradePendingNotice locale={locale} />}

      {upgradeDone && (
        <div
          role="status"
          className="mt-6 rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {copy.upgradedDone}
        </div>
      )}

      {subscriptionStatus === "past_due" && (
        <div
          role="alert"
          className="mt-6 rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {copy.pastDue}
        </div>
      )}

      <div className="mt-8 rounded-[var(--radius-md)] border border-zinc-200 bg-white p-6">
        <dl className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-medium">{profile?.email ?? user.email}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Plan</dt>
            <dd>
              <span className={`rounded-full ${tierStyle.chip} px-2.5 py-0.5 text-xs font-medium`}>
                {tierStyle.label}
              </span>
            </dd>
          </div>
          {subscriptionStatus && subscriptionStatus !== "inactive" && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">{copy.subscription}</dt>
              <dd className="font-medium">
                {SUBSCRIPTION_LABELS[locale][subscriptionStatus] ?? subscriptionStatus}
              </dd>
            </div>
          )}
          {subscriptionEndsAt && tierKey !== "free" && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">
                {subscriptionStatus === "canceled" ? copy.ends : copy.renews}
              </dt>
              <dd className="font-medium">{formatDate(subscriptionEndsAt)}</dd>
            </div>
          )}
          {memberSince && (
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">Member since</dt>
              <dd className="font-medium">{memberSince}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/prompts"
          className="rounded-[var(--radius-md)] border border-zinc-200 bg-white p-5 transition hover:border-zinc-400"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Browse
          </p>
          <p className="mt-2 font-semibold">Prompt Library</p>
          <p className="mt-1 text-sm text-zinc-500">
            3,000+ prompts across 12 verticals. Bilingual EN / ES, smart search,
            collections, favorites.
          </p>
        </Link>
        <Link
          href="/roast"
          className="rounded-[var(--radius-md)] border border-zinc-200 bg-white p-5 transition hover:border-zinc-400"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Try
          </p>
          <p className="mt-2 font-semibold">Brand Roast</p>
          <p className="mt-1 text-sm text-zinc-500">
            Free brand analysis across Strategy / Creativity / Narrative / Digital.
          </p>
        </Link>
      </div>

      {isAdmin && (
        <div className="mt-6">
          <Link
            href="/admin"
            className="block rounded-[var(--radius-md)] border border-zinc-900 bg-zinc-50 p-5 transition hover:bg-white"
          >
            <p className="text-eyebrow text-zinc-500">
              Admin
            </p>
            <p className="mt-2 font-semibold text-zinc-900">Admin panel</p>
            <p className="mt-1 text-sm text-zinc-600">
              Roast traces, clients, skill traces, engine observability. Needs
              the admin API key on entry.
            </p>
          </Link>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {tierKey === "free" && !upgradePending && (
          <Link
            href="/pricing"
            className="rounded-[var(--radius-sm)] bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Upgrade to Pro
          </Link>
        )}
        {hasStripeCustomer && (
          // Ruta API con redirect 303 a Stripe: <Link> la prefetchearia y crearia sesiones del portal.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            href="/api/stripe/billing-portal"
            className="rounded-[var(--radius-sm)] border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-500"
          >
            {copy.manage}
          </a>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-[var(--radius-sm)] border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-500"
          >
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
