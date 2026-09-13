import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { Badge } from "@/components/ui";

interface Props {
  locale: Locale;
  footer: Dictionary["footer"];
}

/* "Studio API" se quito el 11 sep 2026: apuntaba al login interno de /studio.
 * Vuelve cuando exista /developers. */

export default function Footer({ locale, footer }: Props) {
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  const link = "text-zinc-600 transition hover:text-zinc-900";
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-4">
          <div>
            <Image src="/brand/arto-logo-black.png" alt="ARTO" width={80} height={20} className="h-5 w-auto" />
            <p className="mt-2 text-xs text-zinc-500">{footer.copyright}</p>
          </div>

          <div>
            <p className="text-eyebrow mb-2 text-zinc-500">{footer.product}</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link href={lp("/prompts")} className={link}>{footer.prompts}</Link>
              <Link href={lp("/skills")} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-600">
                {footer.skills}
                <Badge tone="soon">Soon</Badge>
              </Link>
              <Link href={lp("/agents")} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-600">
                {footer.agents}
                <Badge tone="soon">Soon</Badge>
              </Link>
              <Link href="/roast" className={link}>{footer.roast}</Link>
            </div>
          </div>

          <div>
            <p className="text-eyebrow mb-2 text-zinc-500">{footer.company}</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link href={lp("/pricing")} className={link}>{footer.pricing}</Link>
              <Link href={lp("/learn")} className={link}>{footer.learn}</Link>
              <Link href={lp("/work")} className={link}>{footer.work}</Link>
              <Link href={lp("/tools")} className={link}>AI Tools</Link>
            </div>
          </div>

          <div>
            <p className="text-eyebrow mb-2 text-zinc-500">{footer.legal}</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link href={lp("/privacy")} className={link}>{footer.privacy}</Link>
              <Link href={lp("/terms")} className={link}>{footer.terms}</Link>
              <a href="https://artogroup.com" target="_blank" rel="noopener noreferrer" className={link}>
                ARTO Group
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
