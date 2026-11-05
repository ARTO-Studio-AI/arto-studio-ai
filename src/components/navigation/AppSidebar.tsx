"use client";

import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ACCOUNT_ITEM, APP_NAV_GROUPS, localeHref, type AppNavId, type AppNavItem } from "@/lib/app-nav";
import AppNavIcon from "@/components/navigation/AppNavIcon";
import VerticalLinks from "@/components/navigation/VerticalLinks";
import { createStoredFlag } from "@/components/navigation/stored-flag";

/* Barra lateral de escritorio (>= 1024 px) para usuarios con sesion (D28). Se queda fija bajo el
 * header (sticky) y se puede contraer a una columna de iconos; la preferencia vive en
 * localStorage de ese navegador. Si localStorage falla, se recuerda solo en memoria. */

type Labels = Dictionary["app_nav"];

const collapsedPref = createStoredFlag("asai_sidebar_collapsed");
const writeCollapsed = collapsedPref.write;

const GROUP_LABEL: Record<(typeof APP_NAV_GROUPS)[number]["id"], keyof Labels> = {
  home: "group_home",
  tools: "group_tools",
  library: "group_library",
};

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900";

interface Props {
  locale: Locale;
  labels: Labels;
  active: AppNavId | null;
}

export default function AppSidebar({ locale, labels, active }: Props) {
  const collapsed = collapsedPref.useFlag();

  const link = (item: AppNavItem) => {
    const isActive = active === item.id;
    const label = labels[item.id];
    return (
      <Link
        href={localeHref(locale, item.href)}
        aria-current={isActive ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${FOCUS} ${
          collapsed ? "justify-center" : ""
        } ${isActive ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"}`}
      >
        <AppNavIcon name={item.id} />
        <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
      </Link>
    );
  };

  return (
    <aside
      id="app-sidebar"
      className={`sticky top-[4.25rem] hidden h-[calc(100dvh-4.25rem)] shrink-0 self-start border-r border-zinc-200 bg-white lg:flex lg:flex-col ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <nav aria-label={labels.aria_sidebar} className="flex-1 overflow-y-auto px-2 py-4">
        {APP_NAV_GROUPS.map((group) => {
          const headingId = `app-nav-${group.id}`;
          return (
            <div key={group.id} className="mb-5 last:mb-0">
              <p id={headingId} className={collapsed ? "sr-only" : "text-eyebrow px-3 pb-1.5 text-zinc-400"}>
                {labels[GROUP_LABEL[group.id]]}
              </p>
              <ul aria-labelledby={headingId} className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    {link(item)}
                    {item.id === "prompts" && !collapsed && (
                      <details open={active === "prompts"} className="group ml-8 mt-0.5">
                        <summary
                          className={`flex cursor-pointer list-none items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 [&::-webkit-details-marker]:hidden ${FOCUS}`}
                        >
                          <AppNavIcon name="chevron" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                          {labels.prompts_by_vertical}
                        </summary>
                        <VerticalLinks locale={locale} allLabel={labels.all_prompts} className="mt-0.5 space-y-0.5" />
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-zinc-200 px-2 py-3">
        {link(ACCOUNT_ITEM)}
        <button
          type="button"
          onClick={() => writeCollapsed(!collapsed)}
          aria-controls="app-sidebar"
          aria-expanded={!collapsed}
          title={collapsed ? labels.expand : undefined}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900 ${FOCUS} ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <AppNavIcon name={collapsed ? "expand" : "collapse"} />
          <span className={collapsed ? "sr-only" : ""}>{collapsed ? labels.expand : labels.collapse}</span>
        </button>
      </div>
    </aside>
  );
}
