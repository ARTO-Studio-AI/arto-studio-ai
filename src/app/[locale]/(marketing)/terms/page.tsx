import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing the use of ARTO Studio AI · Prompt Library.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Legal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-zinc-500">Last updated: 14 May 2026</p>

      <div className="prose prose-neutral mt-10 max-w-none text-zinc-800">
        <p>
          These are the Terms of Service (&quot;Terms&quot;) for ARTO Studio AI · Prompt
          Library (the &quot;Service&quot;), operated by ARTO Group (&quot;we&quot;,
          &quot;us&quot;). By using the Service you agree to these Terms. If you don&apos;t
          agree, please don&apos;t use the Service.
        </p>

        <h2>What the Service does</h2>
        <p>
          The Service is a curated catalog of AI prompts (instructions to give to large
          language models, image generators, etc.) in English and Spanish across creative
          verticals. We add a Smart Search feature that uses third-party AI providers
          (OpenAI and Anthropic) to recommend prompts based on your description of a project.
        </p>

        <h2>Accounts</h2>
        <p>
          You may need to sign in to access certain prompts (Pro / Enterprise tier). You
          are responsible for the activity on your account. Don&apos;t share your sign-in
          link or session cookie with anyone. Notify us if you suspect unauthorized access.
        </p>

        <h2>Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            Resell, redistribute, or republish the prompts as your own catalog or
            collection — they are licensed for your own creative work, not for resale.
          </li>
          <li>Use the Service to generate content that is illegal, defamatory, or that
            violates someone else&apos;s intellectual property rights.
          </li>
          <li>Scrape the catalog systematically. Use our public API (when available) for
            programmatic access.
          </li>
          <li>Bypass rate limits, tier checks, or other access controls.</li>
          <li>Interfere with the Service&apos;s operation or other users&apos; access.</li>
        </ul>

        <h2>Intellectual property</h2>
        <p>
          The prompts, the catalog structure, the design, and the codebase are owned by
          ARTO Group. We grant you a non-exclusive, non-transferable license to use the
          prompts you have access to (Free, Pro, or Enterprise depending on your tier) for
          your own creative and commercial work — including work for clients.
        </p>
        <p>
          The outputs you generate when you run our prompts through third-party AI
          providers belong to you (subject to the third-party provider&apos;s own terms).
          We don&apos;t claim ownership over what you produce with the prompts.
        </p>

        <h2>Paid plans</h2>
        <p>
          Pro and Enterprise are subscription plans, billed monthly. We use Stripe to
          process payments. You can cancel at any time from your account page; access
          remains active until the end of the current billing period. We don&apos;t offer
          refunds for partial periods, except as required by law.
        </p>

        <h2>Third-party AI providers</h2>
        <p>
          The Smart Search feature sends your query to OpenAI and Anthropic. Their use of
          that data is governed by their own privacy policies and terms. We have no control
          over how third-party models behave or what they generate. Don&apos;t put
          confidential or personally identifying information in search queries.
        </p>

        <h2>Disclaimer of warranties</h2>
        <p>
          The Service is provided &quot;as is&quot;. We try hard to make it useful and
          reliable, but we don&apos;t guarantee it will be uninterrupted, error-free, or
          fit a particular purpose. The prompts are educational and creative tools; we
          make no claims about specific business outcomes you might achieve by using them.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, ARTO Group is not liable for indirect,
          incidental, special, or consequential damages arising from your use of the
          Service. Our total liability is capped at the amount you paid us in the 12
          months before the event giving rise to the claim, or USD 100, whichever is
          greater.
        </p>

        <h2>Termination</h2>
        <p>
          You can delete your account at any time by emailing{" "}
          <a href="mailto:contact@artogroup.com">contact@artogroup.com</a>. We can suspend
          or terminate accounts that violate these Terms, with prior notice when reasonable.
        </p>

        <h2>Governing law</h2>
        <p>
          These Terms are governed by the laws of Mexico. Disputes will be resolved in
          the competent courts of Monterrey, Mexico, unless local consumer law requires
          otherwise.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these Terms. Material changes will be announced by email and
          posted here. Continued use after a change means you accept the updated Terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, complaints, or notices? Email{" "}
          <a href="mailto:contact@artogroup.com">contact@artogroup.com</a>.
        </p>

        <hr />
        <p className="text-sm text-zinc-500">
          See also: <Link href="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </article>
  );
}
