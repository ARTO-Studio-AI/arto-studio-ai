import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import TrackedLink from "@/components/analytics/TrackedLink";
import LockIcon from "@/components/LockIcon";
import { buttonClass } from "@/components/ui";

/* Franja «Desbloquea N prompts con Pro» (D28, 2026-11-05), al estilo del «Unlock 76 items
 * with Pro» de AI Black Magic. Solo para visitantes y Free: la pagina decide si la pinta.
 * El numero viene de getProPromptCount() (cache de una hora); sin numero sale el titulo
 * generico. El precio y la linea de valor salen del diccionario de /pricing. */

interface Props {
  locale: Locale;
  count: number | null;
  placement: "catalog" | "prompt_detail";
  className?: string;
}

export function formatCount(n: number, locale: Locale): string {
  return n.toLocaleString(locale === "es" ? "es-MX" : "en-US");
}

export default function ProUnlockBanner({ locale, count, placement, className = "" }: Props) {
  const dict = getDictionary(locale);
  const t = dict.pro_unlock;
  const pricing = dict.pricing;
  const title = count
    ? t.strip_title.replace("{count}", formatCount(count, locale))
    : t.strip_title_fallback;

  return (
    <aside
      className={`asai-dark flex flex-col gap-3 rounded-[var(--radius-lg)] border border-black bg-black p-4 text-white sm:flex-row sm:items-center sm:justify-between ${className}`}
      data-testid="pro-unlock-banner"
      aria-label={title}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[var(--lime)]">
          <LockIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{title}</p>
          <p className="mt-0.5 text-sm text-white">
            {pricing.tier_pro_tagline}{" "}
            <span className="font-mono text-white">
              {pricing.tier_pro_price} {pricing.tier_pro_period}
            </span>
          </p>
        </div>
      </div>
      <TrackedLink
        event="pro_unlock_clicked"
        props={{ placement, cta: "pricing", locale }}
        href={`/${locale}/pricing`}
        className={buttonClass("lime", "md", "min-h-[44px] shrink-0 sm:min-h-0")}
      >
        {t.strip_cta}
      </TrackedLink>
    </aside>
  );
}
