import type { Locale } from "@/i18n/config";
import { FREE_DAILY_OPENS } from "@/lib/prompt-limit";

/* Indicador discreto del contador free: "Te quedan 2 de 3 prompts hoy".
 * Se renderiza solo para free y anonimos; los planes pagados no lo ven.
 * Mono + punto de acento, sin color semantico: es informacion, no alerta. */

interface Props {
  locale: Locale;
  used: number;
  limit?: number;
}

export default function PromptQuota({ locale, used, limit = FREE_DAILY_OPENS }: Props) {
  const left = Math.max(0, limit - used);
  const label =
    locale === "es"
      ? `Te quedan ${left} de ${limit} prompts hoy`
      : `${left} of ${limit} free prompts left today`;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[11px] text-zinc-600"
      data-testid="prompt-quota"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
      {label}
    </span>
  );
}
