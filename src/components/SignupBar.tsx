import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSignupStats } from "@/lib/signup-stats";
import { formatCount } from "@/lib/signup-bar";
import { promoConfigured } from "@/lib/promo-server";
import SignupBarClient from "./SignupBarClient";

/* Barra de registro para visitantes (2026-11-05). Lado servidor: lee el numero real de
 * prompts gratis (cacheado una hora) y se lo pasa a la barra. Se monta desde Footer;
 * la barra decide en el navegador si hay sesion y si toca mostrarse.
 *
 * Promo de 24 h (5 nov 2026): promoEnabled solo es true con STRIPE_PROMO_COUPON_24H y
 * secreto de firma. Si es false el navegador ni siquiera pregunta a /api/promo. */
export default async function SignupBar({ locale }: { locale: Locale }) {
  const stats = await getSignupStats();
  const dict = getDictionary(locale);
  return (
    <SignupBarClient
      locale={locale}
      free={stats ? formatCount(stats.free, locale) : null}
      promoEnabled={promoConfigured()}
      promoCopy={dict.promo}
      proFeatures={dict.pricing.tier_pro_features}
    />
  );
}
