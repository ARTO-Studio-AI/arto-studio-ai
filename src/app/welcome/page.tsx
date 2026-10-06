import Link from "next/link";
import Image from "next/image";
import { config } from "dotenv";
import path from "path";

// Load .env.local explicitly (workaround for Next.js 16 Turbopack env loading)
config({
  path: path.join(/* turbopackIgnore: true */ process.cwd(), ".env.local"),
  override: true,
});

export const dynamic = "force-dynamic";

/* /welcome?session_id=cs_...
 *
 * Success URL of the Starter (API key) checkout. Everything shown here comes
 * from the Checkout Session as Stripe reports it: no copy assumes the payment
 * went through. We call the REST API with fetch, like the checkout routes do,
 * instead of the SDK (see the note in /api/stripe/checkout/route.ts). */

interface CheckoutSessionView {
  id: string;
  status: "open" | "complete" | "expired" | null;
  payment_status: "paid" | "unpaid" | "no_payment_required" | null;
  mode: string | null;
  email: string | null;
  plan: "starter" | "pro" | null;
}

type Lookup =
  | { kind: "missing" }
  | { kind: "not_configured" }
  | { kind: "error"; message: string }
  | { kind: "ok"; session: CheckoutSessionView };

async function lookupSession(sessionId: string | undefined): Promise<Lookup> {
  const id = sessionId?.trim() ?? "";
  if (!id || !/^cs_[A-Za-z0-9_]+$/.test(id)) return { kind: "missing" };

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return { kind: "not_configured" };

  try {
    const resp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" }
    );
    const data = (await resp.json()) as {
      id?: string;
      status?: CheckoutSessionView["status"];
      payment_status?: CheckoutSessionView["payment_status"];
      mode?: string;
      customer_details?: { email?: string | null } | null;
      customer_email?: string | null;
      metadata?: Record<string, string> | null;
      error?: { message?: string };
    };
    if (!resp.ok || !data.id) {
      return { kind: "error", message: data.error?.message ?? `Stripe returned ${resp.status}` };
    }
    const meta = data.metadata ?? {};
    const plan: CheckoutSessionView["plan"] =
      meta.tier === "pro" ? "pro" : meta.client_id ? "starter" : null;
    return {
      kind: "ok",
      session: {
        id: data.id,
        status: data.status ?? null,
        payment_status: data.payment_status ?? null,
        mode: data.mode ?? null,
        email: data.customer_details?.email ?? data.customer_email ?? null,
        plan,
      },
    };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : "unknown error" };
  }
}

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function WelcomePage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  const lookup = await lookupSession(session_id);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <nav className="border-b border-border px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/arto-logo-black.png" alt="ARTO" width={80} height={24} className="h-6 w-auto" />
          <span className="text-sm font-medium tracking-wide text-muted">Creative 24/7</span>
        </Link>
      </nav>

      <main className="mx-auto mt-16 max-w-xl px-6 text-center">
        {renderBody(lookup)}

        <Link
          href="/"
          className="mt-8 inline-block rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-zinc-50"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}

function renderBody(lookup: Lookup) {
  if (lookup.kind === "missing") {
    return (
      <>
        <Badge tone="neutral" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">No checkout session found</h1>
        <p className="mt-3 text-lg text-muted">
          This page needs the <code className="font-mono text-sm">session_id</code> Stripe
          adds after checkout. If you just paid, open the link from Stripe again or
          write to hello@artogroup.com.
        </p>
      </>
    );
  }

  if (lookup.kind === "not_configured") {
    return (
      <>
        <Badge tone="neutral" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Payments are not configured</h1>
        <p className="mt-3 text-lg text-muted">
          We could not check this session. Contact hello@artogroup.com.
        </p>
      </>
    );
  }

  if (lookup.kind === "error") {
    return (
      <>
        <Badge tone="neutral" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">We could not verify this session</h1>
        <p className="mt-3 text-lg text-muted">
          Stripe did not confirm the checkout session. If you were charged, your
          plan will still activate through the webhook; write to hello@artogroup.com
          if it does not show up.
        </p>
        <p className="mt-3 font-mono text-xs text-zinc-400">{lookup.message}</p>
      </>
    );
  }

  const { session } = lookup;
  const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
  const planLabel =
    session.plan === "pro" ? "Prompts Pro" : session.plan === "starter" ? "ARTO Studio AI Starter" : null;

  if (session.status === "expired") {
    return (
      <>
        <Badge tone="neutral" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">This checkout expired</h1>
        <p className="mt-3 text-lg text-muted">
          No payment was made. Start the checkout again whenever you want.
        </p>
        <SessionMeta session={session} />
      </>
    );
  }

  if (!paid || session.status !== "complete") {
    return (
      <>
        <Badge tone="neutral" />
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Payment not completed yet</h1>
        <p className="mt-3 text-lg text-muted">
          Stripe reports this session as{" "}
          <span className="font-medium">{session.status ?? "unknown"}</span> with payment{" "}
          <span className="font-medium">{session.payment_status ?? "unknown"}</span>. Nothing was
          activated. If you think this is wrong, write to hello@artogroup.com.
        </p>
        <SessionMeta session={session} />
      </>
    );
  }

  return (
    <>
      <Badge tone="success" />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Payment confirmed</h1>
      <p className="mt-3 text-lg text-muted">
        Stripe confirmed your payment{planLabel ? ` for ${planLabel}` : ""}. Your plan
        activates as soon as Stripe notifies us, usually within seconds.
      </p>

      {session.plan === "starter" && (
        <div className="mt-8 rounded-2xl border border-border bg-zinc-50 p-6 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Next step</p>
          <p className="mt-2 text-sm text-foreground">
            Your existing API key keeps working; no need to regenerate. Once the
            upgrade lands you will get a confirmation email, and the key has
            unlimited access to{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
              /api/skills/brand-positioning
            </code>
            .
          </p>
        </div>
      )}

      {session.plan === "pro" && (
        <div className="mt-8 rounded-2xl border border-border bg-zinc-50 p-6 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Next step</p>
          <p className="mt-2 text-sm text-foreground">
            Head to{" "}
            <Link href="/account?upgraded=pro" className="underline">
              your account
            </Link>{" "}
            to see the plan once it is active.
          </p>
        </div>
      )}

      <SessionMeta session={session} />
    </>
  );
}

function SessionMeta({ session }: { session: CheckoutSessionView }) {
  return (
    <dl className="mt-6 space-y-1 text-left text-xs text-zinc-500">
      {session.email && (
        <div className="flex justify-between gap-4">
          <dt>Email</dt>
          <dd className="font-medium text-zinc-700">{session.email}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt>Session</dt>
        <dd className="font-mono">{session.id}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>Status</dt>
        <dd className="font-medium text-zinc-700">
          {session.status ?? "unknown"} / {session.payment_status ?? "unknown"}
        </dd>
      </div>
    </dl>
  );
}

function Badge({ tone }: { tone: "success" | "neutral" }) {
  const wrap = tone === "success" ? "bg-emerald-100" : "bg-zinc-100";
  const icon = tone === "success" ? "text-emerald-600" : "text-zinc-500";
  return (
    <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${wrap}`}>
      <svg
        className={`h-8 w-8 ${icon}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        {tone === "success" ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
        )}
      </svg>
    </div>
  );
}
