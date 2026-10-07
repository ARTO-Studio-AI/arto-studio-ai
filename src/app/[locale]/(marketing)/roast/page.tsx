import type { Metadata } from "next";
import { buildMetadata, localeOf, pageMetadata, siteUrl } from "@/lib/seo";
import { readShareParams } from "@/lib/roast-share";
import RoastClient from "./RoastClient";

/* Brand Roast dentro del arbol [locale] (2026-10-06): hereda Nav y Footer del layout de
 * marketing. /roast?lang=xx y /roast redirigen aqui desde src/proxy.ts; la imagen OG
 * sigue en /roast/og (fuera del arbol, exenta del prefijo de idioma).
 * 2026-10-07: un enlace compartido (?brand=&score=…) trae su propia vista previa en
 * redes (la imagen del resultado con la invitacion a hacer el tuyo). La frase solo se
 * muestra si la firma del servidor es valida (roast-share.ts). */

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale: l }, sp] = await Promise.all([params, searchParams]);
  const locale = localeOf(l);
  const share = readShareParams((k) => first(sp[k]), locale);
  if (!share) return pageMetadata("roast", locale);
  const q = new URLSearchParams({
    brand: share.brand,
    score: share.score,
    s: share.s,
    c: share.c,
    n: share.n,
    d: share.d,
    lang: share.lang,
  });
  if (share.h) {
    q.set("h", share.h);
    q.set("sig", first(sp.sig) ?? "");
  }
  const es = locale === "es";
  return buildMetadata({
    locale,
    path: "/roast",
    title: es
      ? `${share.brand} sacó ${share.score}/10 en el Brand Roast de ARTO`
      : `${share.brand} scored ${share.score}/10 on ARTO's Brand Roast`,
    description: share.h
      ? `“${share.h}” ${es ? "¿Y tu marca? Roastéala gratis." : "What about yours? Roast it free."}`
      : es
        ? "¿Y tu marca? Roastéala gratis en 20 segundos con la metodología de ARTO."
        : "What about your brand? Roast it free in 20 seconds with ARTO's methodology.",
    // URL absoluta: absoluteUrl() de seo.ts quita la query, y aqui la query es la imagen.
    ogImage: `${siteUrl()}/roast/og?${q.toString()}`,
  });
}

export default async function RoastPage({ params, searchParams }: Props) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  const lang = localeOf(locale);
  const share = readShareParams((k) => first(sp[k]), lang);
  return <RoastClient lang={lang} verifiedHeadline={share?.h || undefined} />;
}
