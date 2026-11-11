"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LangSwitcher from "@/components/LangSwitcher";
import { Badge, buttonClass } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/* Unified ARTO Studio AI Navigation. Products dropdown shows the 4-product
 * structure. Auth-aware: server passes the user prop so the right-side
 * button is "Sign in" (anon) or initials → /account (signed in).
 *
 * Locale-aware: every internal link is prefixed with /<locale>. The
 * marketing layout passes the active locale + dictionary slice (nav) so we
 * never have to thread strings through manually. The LangSwitcher
 * component handles toggling between locales. */

interface NavUser {
  email?: string | null;
}

interface Props {
  user: NavUser | null;
  locale: Locale;
  nav: Dictionary["nav"];
  /* Server-derived from ADMIN_EMAILS allowlist. Controls visibility of the
   * "Admin" link in the auth area — the /admin page itself still has its
   * own API-key gate, this is just to surface the entry point to admins. */
  isAdmin?: boolean;
}

function initialsOf(email?: string | null): string {
  if (!email) return "U";
  const local = email.split("@")[0] ?? "";
  if (local.length === 0) return "U";
  const parts = local.split(/[.\-_]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

/* Sobre lima la letra es negra siempre; el hover subraya (marca ASAI v2.0). */
const NAV_LINK = "font-medium text-black transition hover:underline hover:underline-offset-4";

export default function Nav({ user, locale, nav, isAdmin = false }: Props) {
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const signedIn = Boolean(user);
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  const LIBRARY_HREF = lp("/prompts");
  const ROAST_HREF = lp("/roast");

  // Click-outside + Escape close for the Products dropdown. Hover was the
  // original model but the 8px gap between trigger and menu sat outside
  // the relative wrapper, so moving the mouse down to click an option
  // fired onMouseLeave and closed the menu before the click landed.
  const productsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!productsOpen) return;
    function onClick(e: MouseEvent) {
      if (productsRef.current && !productsRef.current.contains(e.target as Node)) {
        setProductsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProductsOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [productsOpen]);

  const products = [
    { href: LIBRARY_HREF, title: nav.prompt_library, blurb: nav.prompt_library_blurb, badge: nav.badge_live, tone: "live" as const },
    { href: lp("/skills"), title: nav.skills_studio, blurb: nav.skills_studio_blurb, badge: nav.badge_soon, tone: "soon" as const },
    { href: lp("/mods"), title: nav.mods, blurb: nav.mods_blurb, badge: nav.badge_soon, tone: "soon" as const },
    { href: lp("/agents"), title: nav.ai_agents, blurb: nav.ai_agents_blurb, badge: nav.badge_soon, tone: "soon" as const },
  ];

  const AccountLink = ({ mobile = false }: { mobile?: boolean }) =>
    signedIn ? (
      <Link
        href={lp("/account")}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2 rounded-full border border-black bg-white px-2.5 py-1 text-black transition hover:bg-[var(--lime-hover)] ${mobile ? "mt-1 justify-center" : ""}`}
        title={user?.email || undefined}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black font-mono text-[11px] font-medium text-white">
          {initialsOf(user?.email)}
        </span>
        <span className="text-xs">{nav.account}</span>
      </Link>
    ) : (
      <Link href={lp("/login")} onClick={() => setMobileOpen(false)} className={buttonClass("primary", "sm", mobile ? "mt-1 w-full" : "")}>
        {nav.sign_in}
      </Link>
    );

  const AdminLink = ({ mobile = false }: { mobile?: boolean }) =>
    isAdmin && signedIn ? (
      <Link
        href="/admin"
        onClick={() => setMobileOpen(false)}
        className={`rounded-[var(--radius-sm)] border border-black bg-white px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-black transition hover:bg-[var(--lime-hover)] ${mobile ? "mt-1 text-center" : ""}`}
        title="Admin panel"
      >
        Admin
      </Link>
    ) : null;

  return (
    <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <Link href={lp("/")} className="flex items-center gap-3" aria-label="ARTO Studio AI">
        {/* Logo negro sobre lima (marca ASAI v2.0). SVG limpio, sin bloque <metadata>. */}
        <Image src="/brand/asai/logo-negro.svg" alt="ARTO Studio AI" width={156} height={30} className="h-7 w-auto" priority unoptimized />
        <span className="hidden font-mono text-[11px] font-medium tracking-[0.08em] text-[var(--ink-2)] lg:inline">
          {nav.tagline}
        </span>
      </Link>

      <div className="hidden items-center gap-6 text-sm md:flex">
        <div className="relative" ref={productsRef}>
          <button
            type="button"
            className={`flex items-center gap-1 ${NAV_LINK}`}
            onClick={() => setProductsOpen(!productsOpen)}
            aria-haspopup="menu"
            aria-expanded={productsOpen}
          >
            {nav.products}
            <svg
              className={`h-3 w-3 transition ${productsOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {productsOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-2 shadow-[var(--shadow-md)]">
              {products.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className="block rounded-[var(--radius-sm)] px-3 py-2.5 hover:bg-[var(--lime)]"
                  onClick={() => setProductsOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-black">{p.title}</span>
                    <Badge tone={p.tone}>{p.badge}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-2)]">{p.blurb}</p>
                </Link>
              ))}
              <div className="mt-1 border-t border-[var(--line)] pt-1">
                <Link
                  href={ROAST_HREF}
                  className="block rounded-[var(--radius-sm)] px-3 py-2.5 hover:bg-[var(--lime)]"
                  onClick={() => setProductsOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-black">{nav.brand_roast}</span>
                    <Badge tone="live">{nav.badge_free}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--ink-2)]">{nav.brand_roast_blurb}</p>
                </Link>
              </div>
            </div>
          )}
        </div>

        <Link href={lp("/work")} className={NAV_LINK}>{nav.work}</Link>
        <Link href={lp("/learn")} className={NAV_LINK}>{nav.learn}</Link>
        <Link href={lp("/pricing")} className={NAV_LINK}>{nav.pricing}</Link>
        <LangSwitcher current={locale} />
        <AdminLink />
        <AccountLink />
      </div>

      <button className="text-black md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label={nav.menu} aria-expanded={mobileOpen}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-[var(--line)] bg-[var(--bg)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-eyebrow text-[var(--ink-2)]">{nav.products}</p>
            {products.map((p) => (
              <Link key={p.href} href={p.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 font-medium text-black">
                {p.title}
                <Badge tone={p.tone}>{p.badge}</Badge>
              </Link>
            ))}
            <Link href={ROAST_HREF} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 font-medium text-black">
              {nav.brand_roast}
              <Badge tone="live">{nav.badge_free}</Badge>
            </Link>
            <div className="my-1 border-t border-[var(--line)]" />
            <Link href={lp("/work")} onClick={() => setMobileOpen(false)} className="font-medium text-black">{nav.work}</Link>
            <Link href={lp("/learn")} onClick={() => setMobileOpen(false)} className="font-medium text-black">{nav.learn}</Link>
            <Link href={lp("/pricing")} onClick={() => setMobileOpen(false)} className="font-medium text-black">{nav.pricing}</Link>
            <div className="my-1 border-t border-[var(--line)]" />
            <LangSwitcher current={locale} />
            <AdminLink mobile />
            <AccountLink mobile />
          </div>
        </div>
      )}
    </nav>
  );
}
