"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  desc?: string;
}

interface Section {
  title: string;
  items: NavItem[];
}

/* Sections were proposed by Victor — keep this list as the canonical
 * organization. When you add a new admin surface, slot it under one of
 * these groups rather than creating a new top-level section unless it
 * really doesn't fit. */
const SECTIONS: Section[] = [
  {
    title: "Seguimiento",
    items: [
      { href: "/admin", label: "Resumen", desc: "Vista general" },
      { href: "/admin/traces/roast", label: "Roast traces" },
      { href: "/admin/traces/skills", label: "Skill traces" },
      { href: "/admin/engine/runs", label: "Engine · Runs" },
      { href: "/admin/engine/signals", label: "Engine · Signals" },
      { href: "/admin/engine/attribution", label: "Engine · Attribution" },
      { href: "/admin/engine/social", label: "Engine · Social" },
      { href: "/admin/engine/scraping", label: "Engine · Scraping" },
    ],
  },
  {
    title: "Outreach",
    items: [
      { href: "/admin/emails", label: "Correos" },
      { href: "/admin/outreach", label: "Outreach" },
      { href: "/admin/content", label: "Content Factory" },
    ],
  },
  {
    title: "Administrativas",
    items: [
      { href: "/admin/clients", label: "Clients" },
      { href: "/admin/admins", label: "Administradores" },
    ],
  },
  {
    title: "Desarrollo",
    items: [
      { href: "/admin/engine/gaps", label: "Engine · Gaps" },
      { href: "/admin/engine/config", label: "Engine · Config" },
    ],
  },
];

interface Props {
  email: string;
}

export default function AdminSidebar({ email }: Props) {
  const pathname = usePathname() || "";
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-4">
        {/* Logo links to admin home (Resumen) — standard pattern. The
         * 'Volver al sitio' button below is the explicit exit affordance
         * back to creative.artostudio.ai. */}
        <Link href="/admin" className="flex items-center gap-2">
          <Image
            src="/brand/arto-logo-black.svg"
            alt="ARTO"
            width={58}
            height={20}
            className="h-5 w-auto"
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Admin
          </span>
        </Link>
        <p className="mt-2 truncate text-[11px] text-zinc-400" title={email}>
          {email}
        </p>
        <Link
          href="/"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-50"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver al sitio
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              {section.title}
            </p>
            <ul className="mt-1 space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-200 px-2 py-3">
        {/* "Volver al sitio" lives in the header for primary discovery.
         * Footer keeps the sign-out only. */}
        <Link
          href="/auth/signout"
          className="block rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600"
        >
          Cerrar sesión
        </Link>
      </div>
    </aside>
  );
}
