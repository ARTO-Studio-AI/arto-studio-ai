"use client";

import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { PROMO_FIRST_MONTH_USD, PROMO_PRICE_USD } from "@/lib/promo";
import PromoClock from "@/components/promo/PromoClock";
import { usePromo } from "@/components/promo/promo-store";

/* Precio de Pro en /pricing con la promo de 24 h (5 nov 2026). El servidor pinta el
 * precio normal (children); si /api/promo dice que la persona sigue dentro de sus 24 h
 * (con o sin sesion), se cambia por $9 tachado → $4.50 el primer mes, el reloj y la letra
 * pequena. Sin STRIPE_PROMO_COUPON_24H (enabled=false) no se pregunta nada y se queda
 * el precio normal. El descuento real lo decide el checkout en el servidor. */
export default function PromoPrice({
  enabled,
  copy,
  children,
}: {
  enabled: boolean;
  copy: Dictionary["promo"];
  children?: ReactNode;
}) {
  const promo = usePromo(enabled);
  if (!promo?.active) return <>{children}</>;
  return (
    <div>
      <p className="mb-1 inline-block rounded-full bg-[var(--accent)] px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-950">
        {copy.pricing_badge}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <s className="font-mono text-lg text-zinc-400">${PROMO_PRICE_USD}</s>
        <span className="font-mono text-3xl font-bold tracking-tight">${PROMO_FIRST_MONTH_USD.toFixed(2)}</span>
        <span className="font-mono text-xs text-zinc-500">USD {copy.first_month}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-700">
        {copy.ends_in} <PromoClock endsAt={promo.endsAt} className="font-semibold text-zinc-900" />
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">{copy.then}</p>
    </div>
  );
}
