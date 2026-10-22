"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { gaPageView } from "@/lib/ga";
import { metaPageView } from "@/lib/meta-pixel";

/* Vista de pagina de GA4 en cada navegacion del App Router (D17). gaPageView() no hace
 * nada sin GA cargado (sin ID o sin consentimiento) y manda una sola vista por URL limpia.
 * El PageView del pixel de Meta (D19) sale en el mismo momento, con sus propias reglas.
 * La espera corta deja que Next ponga el <title> de la pagina nueva antes de leerlo. */
export default function GaPageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      gaPageView();
      metaPageView();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);
  return null;
}
