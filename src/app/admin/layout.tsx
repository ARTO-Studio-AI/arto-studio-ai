import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import AdminNav from "./AdminNav";

/* /admin layout, server-gated; renders the admin navigation (AdminNav: barra lateral desde md,
 * barra inferior con cajon en celular; 5 nov 2026).
 * Every page under /admin inherits this; cada pagina servidor ademas llama guardAdmin(). */

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") {
      redirect("/login?next=/admin");
    }
    redirect("/");
  }

  return (
    <div className="asai-site asai-back flex min-h-screen flex-col bg-[var(--bg)] text-black md:flex-row">
      <AdminNav email={auth.email} />
      <main className="min-w-0 flex-1 overflow-x-auto">
        {/* Abajo deja libre el alto de la barra inferior en celular. */}
        <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-8">{children}</div>
      </main>
    </div>
  );
}
