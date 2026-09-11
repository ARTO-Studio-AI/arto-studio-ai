import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmailAsync } from "@/lib/auth";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/* Layout for marketing routes only — homepage, pricing, skills, agents,
 * work, prompts, learn, login, account, collections, favorites, tools,
 * privacy, terms.
 *
 * /admin, /studio, /roast, /upgrade, /welcome keep their own layouts
 * because they ship a different nav/footer pattern AND they are NOT
 * under [locale]/ (they're not bilingual yet — admin/studio are
 * internal, /roast and /upgrade and /welcome are part of the legacy
 * API-key product flow).
 *
 * Server component so we can fetch the auth user from Supabase and
 * pass it down to the (client) Nav alongside the active locale, which
 * the LangSwitcher needs to render the current flag.
 */

export default async function MarketingLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  let userEmail: string | null = null;
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    userEmail = user?.email ?? null;
  } catch {
    // If Supabase env vars are missing during build, render as anonymous.
    userEmail = null;
  }

  // Admin status: bootstrap env var OR dynamic admin_users table.
  // Server-side check so the link never ships to non-admins.
  const isAdmin = await isAdminEmailAsync(userEmail);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
        <Nav
          user={userEmail ? { email: userEmail } : null}
          locale={locale}
          nav={dict.nav}
          isAdmin={isAdmin}
        />
      </header>
      <main className="flex-1">{children}</main>
      <Footer locale={locale} footer={dict.footer} />
    </div>
  );
}
