"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  ADMIN_NAV_GROUPS,
  activeAdminNavId,
  adminMobileDrawerGroups,
  adminMobilePrimaryItems,
  type AdminNavId,
  type AdminNavItem,
} from "@/lib/admin-nav";
import { createStoredFlag } from "@/components/navigation/stored-flag";
import { useDrawerFocus } from "@/components/navigation/use-drawer-focus";
import AdminNavIcon from "./AdminNavIcon";

/* Navegacion del /admin con el lenguaje de la navegacion de usuario (PR #114, D28): barra
 * lateral con grupos e iconos desde md, contraible a una columna de iconos y recordada en este
 * navegador; en celular, barra superior con la marca, cuatro destinos abajo y «Más» con el resto
 * en un cajon modal (Esc, fondo o boton lo cierran y el foco vuelve a «Más»).
 *
 * El admin no tiene header del sitio, por eso la barra lateral va pegada arriba (top-0) y aparece
 * desde md, no desde lg como la de usuario: entre 768 y 1023 px no quedaria navegacion.
 * Solo presentacion: el candado sigue en layout.tsx (requireAdminSession) y en cada pagina. */

const collapsedPref = createStoredFlag("asai_admin_sidebar_collapsed");

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900";
const FOCUS_IN = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-zinc-900";

/* Salir es POST (/auth/signout solo acepta POST), igual que en /account. */
function SignOut({ className, iconOnly }: { className: string; iconOnly?: boolean }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={className} title={iconOnly ? "Cerrar sesión" : undefined}>
        <AdminNavIcon name="signout" />
        <span className={iconOnly ? "sr-only" : ""}>Cerrar sesión</span>
      </button>
    </form>
  );
}

function Sidebar({ email, active }: { email: string; active: AdminNavId | null }) {
  const collapsed = collapsedPref.useFlag();
  const row = `flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition ${FOCUS} ${collapsed ? "justify-center" : ""}`;

  const link = (item: AdminNavItem) => {
    const isActive = active === item.id;
    return (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={`${row} ${isActive ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}
      >
        <AdminNavIcon name={item.id} />
        <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
      </Link>
    );
  };

  return (
    <aside
      id="admin-sidebar"
      className={`sticky top-0 hidden h-dvh shrink-0 self-start border-r border-zinc-200 bg-white md:flex md:flex-col ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className={`border-b border-zinc-200 py-4 ${collapsed ? "px-2" : "px-5"}`}>
        <Link
          href="/admin"
          title={collapsed ? "Admin · Resumen" : undefined}
          className={`flex items-center gap-2 rounded-md ${FOCUS} ${collapsed ? "justify-center" : ""}`}
        >
          <Image src={collapsed ? "/brand/asai/simbolo-negro.svg" : "/brand/asai/logo-negro.svg"} alt="ARTO Studio AI" width={collapsed ? 28 : 120} height={collapsed ? 28 : 23} className={collapsed ? "h-6 w-auto" : "h-5 w-auto"} unoptimized />
          <span className={collapsed ? "sr-only" : "text-eyebrow text-zinc-500"}>Admin</span>
        </Link>
        {!collapsed && (
          <p className="mt-2 truncate text-xs text-zinc-400" title={email}>
            {email}
          </p>
        )}
      </div>

      <nav aria-label="Administración" className="flex-1 overflow-y-auto px-2 py-4">
        {ADMIN_NAV_GROUPS.map((group) => {
          const headingId = `admin-nav-${group.id}`;
          return (
            <div key={group.id} className="mb-5 last:mb-0">
              <p id={headingId} className={collapsed ? "sr-only" : "text-eyebrow px-3 pb-1.5 text-zinc-400"}>
                {group.label}
              </p>
              <ul aria-labelledby={headingId} className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>{link(item)}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-zinc-200 px-2 py-3">
        <Link
          href="/"
          title={collapsed ? "Ver el sitio" : undefined}
          className={`${row} text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900`}
        >
          <AdminNavIcon name="site" />
          <span className={collapsed ? "sr-only" : "truncate"}>Ver el sitio</span>
        </Link>
        <SignOut iconOnly={collapsed} className={`${row} text-zinc-600 hover:bg-red-50 hover:text-red-600`} />
        <button
          type="button"
          onClick={() => collapsedPref.write(!collapsed)}
          aria-controls="admin-sidebar"
          aria-expanded={!collapsed}
          title={collapsed ? "Expandir menú" : undefined}
          className={`${row} text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900`}
        >
          <AdminNavIcon name={collapsed ? "expand" : "collapse"} />
          <span className={collapsed ? "sr-only" : ""}>{collapsed ? "Expandir menú" : "Contraer menú"}</span>
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ email, active }: { email: string; active: AdminNavId | null }) {
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDrawerFocus(open, setOpen, { panel: panelRef, close: closeRef, trigger: moreRef });

  const primary = adminMobilePrimaryItems();
  const drawerGroups = adminMobileDrawerGroups();
  const activeInDrawer = active !== null && !primary.some((i) => i.id === active);

  function closeAndRestoreFocus() {
    setOpen(false);
    moreRef.current?.focus();
  }

  const itemClass = (isActive: boolean) =>
    `relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight transition ${FOCUS_IN} ${
      isActive ? "font-semibold text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
    }`;
  const activeBar = <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-zinc-900" />;
  const drawerRow = `flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-sm ${FOCUS_IN}`;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur-sm md:hidden">
        <Link href="/admin" className={`flex items-center gap-2 rounded-md ${FOCUS}`}>
          <Image src="/brand/asai/logo-negro.svg" alt="ARTO Studio AI" width={120} height={23} className="h-5 w-auto" unoptimized />
          <span className="text-eyebrow text-zinc-500">Admin</span>
        </Link>
        <Link
          href="/"
          className={`flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-sm text-zinc-600 hover:text-zinc-900 ${FOCUS}`}
        >
          <AdminNavIcon name="site" className="h-4 w-4" />
          Ver el sitio
        </Link>
      </header>

      <nav
        aria-label="Administración, menú inferior"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      >
        <ul className="flex">
          {primary.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id} className="flex flex-1">
                <Link href={item.href} aria-current={isActive ? "page" : undefined} className={itemClass(isActive)}>
                  {isActive && activeBar}
                  <AdminNavIcon name={item.id} className="h-6 w-6" />
                  <span>{item.short ?? item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              ref={moreRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls="admin-nav-drawer"
              className={itemClass(activeInDrawer)}
            >
              {activeInDrawer && activeBar}
              <AdminNavIcon name="more" className="h-6 w-6" />
              <span>Más</span>
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-zinc-900/40" onClick={closeAndRestoreFocus} />
          <div
            ref={panelRef}
            id="admin-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-nav-drawer-title"
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 shadow-lg"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="min-w-0">
                <h2 id="admin-nav-drawer-title" className="text-base font-semibold text-zinc-900">
                  Más del admin
                </h2>
                <p className="truncate text-xs text-zinc-400">{email}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeAndRestoreFocus}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100 ${FOCUS_IN}`}
              >
                <AdminNavIcon name="close" className="h-6 w-6" />
                <span className="sr-only">Cerrar menú</span>
              </button>
            </div>

            {drawerGroups.map((group) => {
              const headingId = `admin-drawer-${group.id}`;
              return (
                <div key={group.id} className="mb-4">
                  <p id={headingId} className="text-eyebrow px-3 pb-1 text-zinc-400">
                    {group.label}
                  </p>
                  <ul aria-labelledby={headingId}>
                    {group.items.map((item) => {
                      const isActive = active === item.id;
                      return (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            aria-current={isActive ? "page" : undefined}
                            className={`${drawerRow} ${isActive ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-700"}`}
                          >
                            <AdminNavIcon name={item.id} />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            <div className="border-t border-zinc-200 pt-3">
              <SignOut className={`${drawerRow} text-zinc-700 hover:bg-red-50 hover:text-red-600`} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminNav({ email }: { email: string }) {
  const active = activeAdminNavId(usePathname());
  return (
    <>
      <MobileNav email={email} active={active} />
      <Sidebar email={email} active={active} />
    </>
  );
}
