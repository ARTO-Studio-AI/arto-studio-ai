import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { localeOf, pageMetadata } from "@/lib/seo";
import { safeNextPath } from "@/lib/safe-next";
import LoginForm from "./LoginForm";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("login", localeOf(locale));
}

/* Registro free (2026-10-06): la misma pantalla sirve para crear la cuenta gratis y para
 * entrar. `next` se valida aqui (safeNextPath, H-46) y otra vez en /auth/callback. */
const COPY = {
  es: {
    h1: "Crea tu cuenta gratis",
    body: "Con tu cuenta abres los prompts gratis de la biblioteca, guardas favoritos y colecciones, y te avisamos primero cuando salgan los packs de skills. Si ya tienes cuenta, entra igual.",
  },
  en: {
    h1: "Create your free account",
    body: "Your account opens the free prompts in the library, saves favorites and collections, and gets you first in line when the skill packs ship. Already have one? Sign in the same way.",
  },
} as const;

export default async function LoginPage({ params, searchParams }: Props) {
  const [{ locale: localeParam }, sp] = await Promise.all([params, searchParams]);
  const locale = localeOf(localeParam);
  const next = safeNextPath(sp.next, "", process.env.NEXT_PUBLIC_SITE_URL || "https://creative.artostudio.ai") || undefined;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) redirect(next ?? `/${locale}`);

  const t = COPY[locale];
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{t.h1}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t.body}</p>
      <div className="mt-8 rounded-[var(--radius-md)] border border-zinc-200 bg-white p-6">
        <LoginForm locale={locale} next={next} />
      </div>
    </div>
  );
}
