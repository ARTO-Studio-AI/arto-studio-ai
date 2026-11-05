"use client";

import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { PromoPriceView } from "@/components/promo/PromoViews";
import { usePromo } from "@/components/promo/promo-store";

/* Precio de Pro en /pricing con la promo (5 nov 2026). El servidor pinta el precio normal
 * (children); si /api/promo dice que la persona tiene un reloj vigente (con o sin sesion), se
 * cambia por el precio de esa promo: insignia, precio tachado, reloj y letra pequena
 * (PromoPriceView, la misma pieza de la vista previa de /admin/promociones). Sin secreto de
 * firma (copy=null) no se pregunta nada y se queda el precio normal. El descuento real lo
 * decide el checkout en el servidor. */
export default function PromoPrice({
  copy,
  locale = "es",
  children,
}: {
  /** Textos comunes de la promo; null si no hay promos posibles o no es la tarjeta de Pro. */
  copy: Dictionary["promo"] | null;
  locale?: Locale;
  children?: ReactNode;
}) {
  const promo = usePromo(copy !== null, locale);
  if (!copy || !promo?.active || !promo.offer) return <>{children}</>;
  return <PromoPriceView offer={promo.offer} dict={copy} endsAt={promo.endsAt} />;
}
