import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { localeOf, pageMetadata } from "@/lib/seo";
import LoginForm from "./LoginForm";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata("login", localeOf(locale));
}

export default async function LoginPage({ params }: Props) {
  const { locale: localeParam } = await params;
  const locale = localeOf(localeParam);
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Sign in to save favorites, manage collections, and unlock the Pro
        catalog.
      </p>
      <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-6">
        <LoginForm locale={locale} />
      </div>
    </div>
  );
}
