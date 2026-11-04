"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { activeNavId, shouldShowAppNav } from "@/lib/app-nav";
import AppSidebar from "@/components/navigation/AppSidebar";
import AppBottomNav from "@/components/navigation/AppBottomNav";

/* Envoltura del contenido para usuarios con sesion (D28). El layout de marketing solo la usa
 * cuando hay sesion; sin sesion el HTML sale igual que antes. En la home publica del locale
 * tambien devuelve el marcado de siempre (main + footer), sin barra lateral ni inferior.
 *
 * Con la navegacion visible: barra lateral a la izquierda desde lg, barra inferior bajo md, y un
 * espaciador despues del footer del alto de esa barra para que no tape el contenido. */

interface Props {
  locale: Locale;
  labels: Dictionary["app_nav"];
  footer: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({ locale, labels, footer, children }: Props) {
  const pathname = usePathname();

  if (!shouldShowAppNav(pathname, locale, true)) {
    return (
      <>
        <main className="flex-1">{children}</main>
        {footer}
      </>
    );
  }

  const active = activeNavId(pathname, locale);

  return (
    <>
      <div className="flex flex-1">
        <AppSidebar locale={locale} labels={labels} active={active} />
        <main className="min-w-0 flex-1 overflow-x-clip">{children}</main>
      </div>
      {footer}
      <div aria-hidden="true" className="h-[calc(3.5rem+1px+env(safe-area-inset-bottom))] shrink-0 md:hidden" />
      <AppBottomNav locale={locale} labels={labels} active={active} />
    </>
  );
}
