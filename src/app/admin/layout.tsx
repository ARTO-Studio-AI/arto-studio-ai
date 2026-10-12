import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import AdminSidebar from "./AdminSidebar";

/* /admin layout — server-gated, renders the persistent left sidebar.
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
    <div className="flex min-h-screen bg-zinc-50">
      <AdminSidebar email={auth.email} />
      <main className="flex-1 overflow-x-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
