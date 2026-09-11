import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ARTO Studio AI · Prompt Library handles personal data.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Legal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-zinc-500">Last updated: 14 May 2026</p>

      <div className="prose prose-neutral mt-10 max-w-none text-zinc-800">
        <p>
          This is the privacy policy for ARTO Studio AI · Prompt Library (the
          &quot;Service&quot;), operated by ARTO Group (&quot;we&quot;, &quot;us&quot;). It
          describes what personal data we collect, why, how long we keep it, and the rights
          you have. We try to keep this short and human. If anything here is unclear,
          email <a href="mailto:contact@artogroup.com">contact@artogroup.com</a>.
        </p>

        <h2>What data we collect</h2>
        <ul>
          <li>
            <strong>Account data:</strong> the email address you sign in with (via magic link
            or Google OAuth). If you sign in with Google we also receive your name and
            profile picture URL.
          </li>
          <li>
            <strong>Usage data:</strong> the searches you make, the prompts you open, mark as
            favorite, or add to a collection. Each search is stored with the query text,
            language detected, top match, and timestamp so we can improve the catalog and
            spot demand we&apos;re not yet covering.
          </li>
          <li>
            <strong>Subscription data:</strong> if you eventually pay for a plan, Stripe
            stores your payment details. We only store your Stripe customer ID, subscription
            status, and tier — never your full card number.
          </li>
          <li>
            <strong>Technical data:</strong> standard server logs (IP for rate limiting,
            request paths, response status). We do not run pixel trackers or third-party
            analytics that profile you across sites.
          </li>
        </ul>

        <h2>Why we collect it</h2>
        <ul>
          <li>To let you sign in and remember your favorites, collections, and tier.</li>
          <li>To recommend prompts that match your project via our Smart Search.</li>
          <li>To identify catalog gaps and generate new prompts where there is real demand.</li>
          <li>To prevent abuse via rate limits.</li>
          <li>To process payments (when you choose a paid plan).</li>
        </ul>

        <h2>Third parties we share data with</h2>
        <ul>
          <li>
            <strong>Supabase</strong> — database, authentication, file storage.
          </li>
          <li>
            <strong>Vercel</strong> — hosting and edge delivery.
          </li>
          <li>
            <strong>Resend</strong> — transactional email (magic link, confirmations).
          </li>
          <li>
            <strong>OpenAI</strong> — generates the embedding of your search query so we
            can match it against the catalog. The query text is sent in plain text.
          </li>
          <li>
            <strong>Anthropic</strong> — receives your query and up to 20 candidate prompts
            to write the coach-style recommendation. The query text is sent in plain text.
          </li>
          <li>
            <strong>Stripe</strong> — payment processing (only when you opt in to a paid plan).
          </li>
        </ul>
        <p>
          We do not sell, rent, or trade your data. We do not use your data to train any
          third-party model. The providers above process data under their own privacy
          policies and only for the purpose stated.
        </p>

        <h2>Retention</h2>
        <p>
          We keep your account and content (favorites, collections) as long as your account
          exists. Search queries are retained for 12 months and then deleted. If you delete
          your account, all your personal data is removed within 30 days, except records
          we&apos;re legally required to keep (e.g. tax / payment records: 5 years).
        </p>

        <h2>Your rights</h2>
        <p>
          You can request a copy of your data, ask us to correct it, or ask us to delete
          your account and all associated data at any time. Email{" "}
          <a href="mailto:contact@artogroup.com">contact@artogroup.com</a>. We respond
          within 30 days.
        </p>

        <h2>Cookies</h2>
        <p>
          We use session cookies strictly required to keep you logged in. We do not use
          tracking or advertising cookies.
        </p>

        <h2>Changes</h2>
        <p>
          If we materially change how we handle data, we update this page and (where the
          change is significant) notify signed-in users by email. The &quot;Last updated&quot;
          date at the top reflects the current version.
        </p>

        <hr />
        <p className="text-sm text-zinc-500">
          See also: <Link href="/terms">Terms of Service</Link>
        </p>
      </div>
    </article>
  );
}
