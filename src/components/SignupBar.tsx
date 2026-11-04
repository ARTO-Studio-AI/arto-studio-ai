import type { Locale } from "@/i18n/config";
import { getSignupStats } from "@/lib/signup-stats";
import { formatCount } from "@/lib/signup-bar";
import SignupBarClient from "./SignupBarClient";

/* Barra de registro para visitantes (2026-11-05). Lado servidor: lee el numero real de
 * prompts gratis (cacheado una hora) y se lo pasa a la barra. Se monta desde Footer;
 * la barra decide en el navegador si hay sesion y si toca mostrarse. */
export default async function SignupBar({ locale }: { locale: Locale }) {
  const stats = await getSignupStats();
  return <SignupBarClient locale={locale} free={stats ? formatCount(stats.free, locale) : null} />;
}
