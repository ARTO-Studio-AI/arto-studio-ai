import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmailAsync } from "@/lib/auth";

/* Minimal Account page for Phase B. Shows tier + email + sign-out.
   When /prompts, /collections, /favorites migrate (Phase C), expand here:
   add favorites count, search history, billing portal link. */

/* Chips monocromos: el plan lo dice el texto; los pagados van en tinta inversa. */
const TIER_LABELS: Record<string, { label: string; chip: string }> = {
  free: { label: "Free", chip: "bg-zinc-100 text-zinc-700" },
  pro: { label: "Pro", chip: "bg-zinc-900 text-white" },
  skills: { label: "Studio", chip: "bg-zinc-900 text-white" },
  agents: { label: "AI Agents", chip: "bg-zinc-900 text-white" },
  enterprise: { label: "Enterprise", chip: "bg-zinc-900 text-white" },
};

export default async function AccountPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await sb
    .from("profiles")
    .select("email, tier, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const tierKey = (profile?.tier as string | undefined) ?? "free";
  const tierStyle = TIER_LABELS[tierKey] ?? TIER_LABELS.free;
  // Server-side admin check against ADMIN_EMAILS allowlist. Renders an
  // additional card linking to /admin if the visitor is on the list.
  const isAdmin = await isAdminEmailAsync(user.email);
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Account</h1>

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
        {tierKey === "free" && (
          <Link
            href="/pricing"
            className="rounded-[var(--radius-sm)] bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Upgrade to Pro
          </Link>
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
