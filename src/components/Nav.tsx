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

const NAV_LINK = "text-zinc-700 transition hover:text-zinc-900";

export default function Nav({ user, locale, nav, isAdmin = false }: Props) {
  const [productsOpen, setProductsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const signedIn = Boolean(user);
  const lp = (p: string) => `/${locale}${p.startsWith("/") ? p : "/" + p}`;
  const LIBRARY_HREF = lp("/prompts");
  // /roast lives outside [locale] so we link to it directly.
  const ROAST_HREF = "/roast";

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
    { href: lp("/agents"), title: nav.ai_agents, blurb: nav.ai_agents_blurb, badge: nav.badge_soon, tone: "soon" as const },
  ];

  const AccountLink = ({ mobile = false }: { mobile?: boolean }) =>
    signedIn ? (
      <Link
        href={lp("/account")}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700 transition hover:border-zinc-400 ${mobile ? "mt-1 justify-center" : ""}`}
        title={user?.email || undefined}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 font-mono text-[11px] font-medium text-white">
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
        className={`rounded-[var(--radius-sm)] border border-zinc-300 bg-zinc-50 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-700 transition hover:border-zinc-900 ${mobile ? "mt-1 text-center" : ""}`}
        title="Admin panel"
      >
        Admin
      </Link>
    ) : null;

  return (
    <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <Link href={lp("/")} className="flex items-baseline gap-2">
        <Image src="/brand/arto-logo-black.png" alt="ARTO Creative 24/7" width={96} height={24} className="h-6 w-auto" priority />
        <span className="hidden font-mono text-[11px] font-medium tracking-[0.08em] text-zinc-500 sm:inline">
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
            <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-[var(--radius-md)] border border-zinc-200 bg-white p-2 shadow-[var(--shadow-md)]">
              {products.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className="block rounded-[var(--radius-sm)] px-3 py-2.5 hover:bg-zinc-50"
                  onClick={() => setProductsOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900">{p.title}</span>
                    <Badge tone={p.tone}>{p.badge}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">{p.blurb}</p>
                </Link>
              ))}
              <div className="mt-1 border-t border-zinc-100 pt-1">
                <Link
                  href={ROAST_HREF}
                  className="block rounded-[var(--radius-sm)] px-3 py-2.5 hover:bg-zinc-50"
                  onClick={() => setProductsOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900">{nav.brand_roast}</span>
                    <Badge tone="live">{nav.badge_free}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">{nav.brand_roast_blurb}</p>
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

      <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label={nav.menu} aria-expanded={mobileOpen}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {mobileOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-50 border-b border-zinc-200 bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-eyebrow text-zinc-400">{nav.products}</p>
            {products.map((p) => (
              <Link key={p.href} href={p.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-zinc-700">
                {p.title}
                <Badge tone={p.tone}>{p.badge}</Badge>
              </Link>
            ))}
            <Link href={ROAST_HREF} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-zinc-700">
              {nav.brand_roast}
              <Badge tone="live">{nav.badge_free}</Badge>
            </Link>
            <div className="my-1 border-t border-zinc-100" />
            <Link href={lp("/work")} onClick={() => setMobileOpen(false)} className="text-zinc-700">{nav.work}</Link>
            <Link href={lp("/learn")} onClick={() => setMobileOpen(false)} className="text-zinc-700">{nav.learn}</Link>
            <Link href={lp("/pricing")} onClick={() => setMobileOpen(false)} className="text-zinc-700">{nav.pricing}</Link>
            <div className="my-1 border-t border-zinc-100" />
            <LangSwitcher current={locale} />
            <AdminLink mobile />
            <AccountLink mobile />
          </div>
        </div>
      )}
    </nav>
  );
}
