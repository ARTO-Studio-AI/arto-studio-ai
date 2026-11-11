import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { Badge } from "@/components/ui";
import { CookieSettingsButton } from "@/components/CookieBanner";
import SignupBar from "@/components/SignupBar";

interface Props {
  locale: Locale;
  footer: Dictionary["footer"];
}

/* "Studio API" se quito el 11 sep 2026: apuntaba al login interno de /studio.
 * Vuelve cuando exista /developers. */

export default function Footer({ locale, footer }: Props) {
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  /* Pie negro (marca ASAI v2.0): letra blanca, etiquetas en lima, logo lima. Nunca azul sobre
   * negro (2.5:1). */
  const link = "text-white transition hover:text-[var(--lime)]";
  const soon = "flex items-center gap-1.5 text-white transition hover:text-[var(--lime)]";
  return (
    <footer className="asai-dark border-t border-black bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-4">
          <div>
            <Image src="/brand/asai/logo-lima.svg" alt="ARTO Studio AI" width={166} height={32} className="h-8 w-auto" loading="eager" unoptimized />
            <p className="mt-3 text-xs text-white">{footer.copyright}</p>
          </div>

          <div>
            <p className="text-eyebrow mb-2 text-[var(--lime)]">{footer.product}</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link href={lp("/prompts")} className={link}>{footer.prompts}</Link>
              <Link href={lp("/skills")} className={soon}>
                {footer.skills}
                <Badge tone="soon">{locale === "es" ? "Pronto" : "Soon"}</Badge>
              </Link>
              <Link href={lp("/mods")} className={link}>{footer.mods}</Link>
              <Link href={lp("/agents")} className={soon}>
                {footer.agents}
                <Badge tone="soon">{locale === "es" ? "Pronto" : "Soon"}</Badge>
              </Link>
              <Link href={lp("/roast")} className={link}>{footer.roast}</Link>
            </div>
          </div>

          <div>
            <p className="text-eyebrow mb-2 text-[var(--lime)]">{footer.company}</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link href={lp("/pricing")} className={link}>{footer.pricing}</Link>
              <Link href={lp("/learn")} className={link}>{footer.learn}</Link>
              <Link href={lp("/work")} className={link}>{footer.work}</Link>
              <Link href={lp("/tools")} className={link}>AI Tools</Link>
            </div>
          </div>

          <div>
            <p className="text-eyebrow mb-2 text-[var(--lime)]">{footer.legal}</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link href={lp("/privacy")} className={link}>{footer.privacy}</Link>
              <Link href={lp("/terms")} className={link}>{footer.terms}</Link>
              <CookieSettingsButton label="Cookies" className={`${link} text-left`} />
              <a href="https://artogroup.com" target="_blank" rel="noopener noreferrer" className={link}>
                ARTO Group
              </a>
            </div>
          </div>
        </div>
      </div>
      <SignupBar locale={locale} />
    </footer>
  );
}
