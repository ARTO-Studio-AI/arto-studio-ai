"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { gaPageView } from "@/lib/ga";

/* Vista de pagina de GA4 en cada navegacion del App Router (D17). gaPageView() no hace
 * nada sin GA cargado (sin ID o sin consentimiento) y manda una sola vista por URL limpia.
 * La espera corta deja que Next ponga el <title> de la pagina nueva antes de leerlo. */
export default function GaPageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const timer = window.setTimeout(gaPageView, 250);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);
  return null;
}
