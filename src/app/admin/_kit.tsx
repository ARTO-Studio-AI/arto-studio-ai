import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";

/* Piezas compartidas del /admin nuevo (fase 1, 2026-10-12). Cada pagina servidor pide su
 * propio candado ademas del layout: Next no re-ejecuta el layout en navegacion parcial. */

export async function guardAdmin(): Promise<string> {
  const auth = await requireAdminSession();
  if (!auth.ok) redirect(auth.reason === "unauthenticated" ? "/login?next=/admin" : "/");
  return auth.email;
}

const DATE = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
export const fecha = (iso: string | null | undefined) => (iso ? DATE.format(new Date(iso)) : "—");

export const PAGE_SIZE = 50;
export function pageOf(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-eyebrow text-zinc-500">{eyebrow}</p>
        <h1 className="text-h2 mt-1">{title}</h1>
      </div>
      {children}
    </div>
  );
}

/* Tabla simple con el estilo del sitio. */
export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string | false }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50">
          <tr>
            {head.map((h) => (
              <th key={h} className="text-eyebrow whitespace-nowrap px-4 py-2.5 font-medium text-zinc-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-8 text-center text-sm text-zinc-500">{empty}</p>}
    </div>
  );
}

export const TD = "px-4 py-2.5 align-top text-zinc-700";

export function Pager({ base, page, total, params = {} }: { base: string; page: number; total: number; params?: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("p", String(p));
    return `${base}?${q.toString()}`;
  };
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
      <span>Página {page} de {pages} · {total.toLocaleString("es-MX")} en total</span>
      <div className="flex gap-3">
        {page > 1 && <Link className="hover:text-zinc-900" href={href(page - 1)}>← Anterior</Link>}
        {page < pages && <Link className="hover:text-zinc-900" href={href(page + 1)}>Siguiente →</Link>}
      </div>
    </div>
  );
}
