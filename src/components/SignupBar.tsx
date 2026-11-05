import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSignupStats } from "@/lib/signup-stats";
import { formatCount } from "@/lib/signup-bar";
import { promoSigningReady } from "@/lib/promo-server";
import SignupBarClient from "./SignupBarClient";

/* Barra de registro para visitantes (2026-11-05). Lado servidor: lee el numero real de
 * prompts gratis (cacheado una hora) y se lo pasa a la barra. Se monta desde Footer;
 * la barra decide en el navegador si hay sesion y si toca mostrarse.
 *
 * Promos (5 nov 2026): con secreto de firma la barra pregunta a /api/promo que promo toca
 * (de /admin/promociones o la de STRIPE_PROMO_COUPON_24H); el servidor responde
 * { enabled: false } si no hay ninguna viva. No se decide aqui porque esta barra va en el
 * footer de paginas estaticas: una promo que se prende despues del build no saldria. */
export default async function SignupBar({ locale }: { locale: Locale }) {
  const stats = await getSignupStats();
  const dict = getDictionary(locale);
  // Sin secreto de firma no hay promos: ni los textos viajan a la pagina.
  const promo = promoSigningReady() ? { copy: dict.promo, features: dict.pricing.tier_pro_features } : null;
  return <SignupBarClient locale={locale} free={stats ? formatCount(stats.free, locale) : null} promo={promo} />;
}
