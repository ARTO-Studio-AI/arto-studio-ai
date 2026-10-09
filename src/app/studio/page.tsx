"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import BrandRoastRunner from "./BrandRoastRunner";
import BrandPositioningRunner from "./BrandPositioningRunner";
import UnknownSkillRunner from "./UnknownSkillRunner";
import {
  keyHeaders,
  formatDate,
  tierColor,
  type StudioClient,
  type SkillCatalogEntry,
  type SkillTraceLite,
} from "./shared";

export default function StudioDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [client, setClient] = useState<StudioClient | null>(null);
  const [skills, setSkills] = useState<SkillCatalogEntry[]>([]);
  const [traces, setTraces] = useState<SkillTraceLite[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [tracesKey, setTracesKey] = useState(0); // bump to re-fetch

  const fetchSkills = useCallback(async (key: string) => {
    setLoadingSkills(true);
    try {
      const res = await fetch("/api/skills", { headers: keyHeaders(key) });
      if (res.status === 401) {
        setAuthed(false);
        setAuthError("Invalid API key.");
        localStorage.removeItem("arto_studio_key");
        setLoadingSkills(false);
        return;
      }
      const data = await res.json();
      const allSkills = (data.skills ?? []) as SkillCatalogEntry[];
      setSkills(allSkills);
      if (allSkills.length > 0 && !activeSlug) setActiveSlug(allSkills[0].slug);
    } catch {
      setAuthError("Network error fetching skills.");
    }
    setLoadingSkills(false);
  }, [activeSlug]);

  const fetchMyTraces = useCallback(
    async (key: string) => {
      try {
        const res = await fetch("/api/studio/my-traces?limit=20", {
          headers: keyHeaders(key),
        });
        if (!res.ok) return;
        const data = await res.json();
        setClient(data.client as StudioClient);
        setTraces(data.traces as SkillTraceLite[]);
      } catch {
        /* silent — non-blocking */
      }
    },
    []
  );

  useEffect(() => {
    const saved = localStorage.getItem("arto_studio_key");
    if (saved) {
      setApiKey(saved);
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed && apiKey) {
      fetchSkills(apiKey);
      fetchMyTraces(apiKey);
    }
  }, [authed, apiKey, fetchSkills, fetchMyTraces, tracesKey]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    localStorage.setItem("arto_studio_key", apiKey.trim());
    setAuthed(true);
    setAuthError("");
  }

  function handleLogout() {
    setAuthed(false);
    setApiKey("");
    setClient(null);
    setSkills([]);
    setTraces([]);
    setActiveSlug("");
    localStorage.removeItem("arto_studio_key");
  }

  /* ── Auth gate ── */
  if (!authed) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <nav className="border-b border-zinc-200 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/brand/arto-logo-black.svg" alt="ARTO" width={69} height={24} className="h-6 w-auto" />
            <span className="text-sm font-medium tracking-wide text-zinc-500">STUDIO</span>
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight">Studio sign-in</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Paste your <code className="rounded bg-zinc-100 px-1 font-mono text-xs">arto_live_...</code>{" "}
              key. Team members typically use a <strong>tier: internal</strong> client (create one
              from <Link href="/admin" className="underline">Admin</Link> → Clients → New client).
            </p>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setAuthError("");
                }}
                placeholder="arto_live_..."
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-zinc-900"
              />
              {authError && <p className="text-xs text-red-500">{authError}</p>}
              <button
                type="submit"
                className="w-full rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Sign in
              </button>
            </form>
            <p className="mt-4 text-xs text-zinc-400">
              Don&apos;t have a key? <Link href="/" className="underline">Get one</Link>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main ── */
  const activeSkill = skills.find((s) => s.slug === activeSlug);
  const currentSkillTraces = traces.filter((t) => t.skill_slug === activeSlug).slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/brand/arto-logo-black.svg" alt="ARTO" width={69} height={24} className="h-6 w-auto" />
            <span className="text-sm font-medium tracking-wide text-zinc-500">STUDIO</span>
          </Link>
          <div className="flex items-center gap-4">
            {client && (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400">{client.name}</span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tierColor(
                    client.tier
                  )}`}
                >
                  {client.tier}
                </span>
                {client.trial_calls_limit !== null && (
                  <span className="text-xs text-zinc-500">
                    {client.trial_calls_used}/{client.trial_calls_limit} trial
                  </span>
                )}
              </span>
            )}
            <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
              Admin
            </Link>
            <button
              onClick={() => setTracesKey((k) => k + 1)}
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              Refresh
            </button>
            <button onClick={handleLogout} className="text-sm text-zinc-500 hover:text-red-600">
              Sign out
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 pb-0">
          {loadingSkills ? (
            <span className="px-4 py-2 text-sm text-zinc-400">Loading skills…</span>
          ) : skills.length === 0 ? (
            <span className="px-4 py-2 text-sm text-zinc-400">
              No skills available for this key.
            </span>
          ) : (
            skills.map((s) => (
              <button
                key={s.slug}
                onClick={() => setActiveSlug(s.slug)}
                className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeSlug === s.slug
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {s.name}
                {s.public && (
                  <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    public
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </nav>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-6 py-8 lg:grid-cols-[1fr_280px]">
        <section>
          {activeSkill ? (
            activeSkill.slug === "brand-roast" ? (
              <BrandRoastRunner apiKey={apiKey} onDone={() => setTracesKey((k) => k + 1)} />
            ) : activeSkill.slug === "brand-positioning" ? (
              <BrandPositioningRunner
                apiKey={apiKey}
                onDone={() => setTracesKey((k) => k + 1)}
              />
            ) : (
              <UnknownSkillRunner
                apiKey={apiKey}
                slug={activeSkill.slug}
                name={activeSkill.name}
                description={activeSkill.description}
                onDone={() => setTracesKey((k) => k + 1)}
              />
            )
          ) : (
            <p className="text-sm text-zinc-500">Select a skill from the tabs above.</p>
          )}
        </section>

        {/* Sidebar: recent calls for this skill */}
        <aside className="lg:sticky lg:top-32 lg:h-fit">
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Your recent calls{activeSkill ? ` · ${activeSkill.name}` : ""}
            </h3>
            {currentSkillTraces.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-400">No calls yet for this skill.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {currentSkillTraces.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-zinc-500">#{t.id}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          t.source === "ai"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {t.source}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-medium text-zinc-900">
                      {previewInput(t.input)}
                    </p>
                    <p className="mt-0.5 text-zinc-400">
                      {(t.latency_ms / 1000).toFixed(1)}s · {formatDate(t.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/admin"
              className="mt-4 inline-block text-xs text-zinc-500 hover:text-zinc-900"
            >
              See full trace history →
            </Link>
          </div>
        </aside>
      </main>
    </div>
  );
}

function previewInput(input: unknown): string {
  if (!input || typeof input !== "object") return "—";
  const i = input as Record<string, unknown>;
  const brand = typeof i.brandName === "string" ? i.brandName : "";
  const industry = typeof i.industry === "string" ? i.industry : "";
  if (brand && industry) return `${brand} · ${industry}`;
  if (brand) return brand;
  return JSON.stringify(input).slice(0, 50);
}
