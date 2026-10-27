import Link from "next/link";
import { Badge } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { isPromoActive } from "@/lib/edit-bundle/access";
import { EDIT_BUNDLE_PAGE, EDIT_SKILLS } from "@/lib/edit-bundle/catalog";

/* Tarjeta del ARTO Edit Bundle #1 en /skills: lleva a la landing de la promocion. */

interface Props {
  locale: Locale;
  t: Dictionary["edit_bundle"];
  now?: Date;
}

export default function BundleCard({ locale, t, now = new Date() }: Props) {
  const promo = isPromoActive(now);
  return (
    <Link
      href={`/${locale}${EDIT_BUNDLE_PAGE}`}
      className="group block rounded-[var(--radius-lg)] border-2 border-zinc-900 bg-zinc-900 p-6 text-white transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="inverse">{promo ? t.label_free : t.label_pro}</Badge>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-400">{promo ? t.bundle_included_promo : t.bundle_included}</span>
      </div>
      <h3 className="mt-4 text-2xl font-extrabold tracking-tight">{t.bundle_name}</h3>
      <p className="mt-1 text-zinc-300">{t.bundle_tagline}</p>
      <p className="mt-3 text-sm text-zinc-400">{t.bundle_card_body}</p>
      <p className="mt-4 text-sm text-zinc-300">{EDIT_SKILLS.map((s) => s.name[locale]).join(" · ")}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] group-hover:underline">
        {t.see_bundle} →
      </span>
    </Link>
  );
}
