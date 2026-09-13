"use client";

import type { ReactNode } from "react";
import { buttonClass } from "@/components/ui";
import { track } from "@/lib/analytics";
import type { Locale } from "@/i18n/config";

/* CTA de Pro en /pricing. Es un <a> plano (no <Link>) por H-42: las rutas /api/
 * no se prefetchean. Manda checkout_started en el clic, antes de que el servidor
 * cree la sesion de Stripe; checkout_completed lo dispara el webhook (PR #59). */

export default function ProCheckoutButton({
  href,
  locale,
  signedIn,
  className = "",
  children,
}: {
  href: string;
  locale: Locale;
  signedIn: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={buttonClass("primary", "md", className)}
      onClick={() => track("checkout_started", { plan: "pro", price_usd: 9, locale, signed_in: signedIn })}
    >
      {children}
    </a>
  );
}
