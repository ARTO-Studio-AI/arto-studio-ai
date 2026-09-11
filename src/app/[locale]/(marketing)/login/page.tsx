import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Sign in to save favorites, manage collections, and unlock the Pro
        catalog.
      </p>
      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6">
        <LoginForm />
      </div>
    </div>
  );
}
