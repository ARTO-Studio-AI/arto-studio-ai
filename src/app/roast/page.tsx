"use client";

import { useState, useEffect, useRef, Suspense, Component, type ErrorInfo, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { RoastResult } from "@/lib/roast-types";
import { track } from "@/lib/analytics";
import {
  generateDeterministicRoast,
  hash,
  pick,
  strategyRoasts,
  creativityRoasts,
  narrativeRoasts,
  digitalRoasts,
  verdicts,
  improvementPool,
} from "@/lib/roast-fallback";

/* ── Defensive normalizer ─────────────────────────────
 * Claude occasionally drifts from the tool schema:
 * - `improvements` may come back as a (sometimes truncated) string instead of an array.
 * - `verdict` may come back as a stringified JSON object (e.g. '{"score":1.5,"roast":"..."}').
 * This helper coerces whatever shape arrives into a valid RoastResult so the
 * UI never crashes on .map() or on rendering a non-string.
 */
function normalizeRoastResult(raw: unknown): RoastResult {
  const r = (raw ?? {}) as Record<string, unknown>;

  // improvements: accept real array, stringified array, or garbage
  let improvements: string[] = [];
  if (Array.isArray(r.improvements)) {
    improvements = (r.improvements as unknown[]).filter(
      (s): s is string => typeof s === "string"
    );
  } else if (typeof r.improvements === "string") {
    try {
      const parsed: unknown = JSON.parse(r.improvements);
      if (Array.isArray(parsed)) {
        improvements = parsed.filter((s): s is string => typeof s === "string");
      }
    } catch {
      /* leave empty; fallback below */
    }
  }
  if (improvements.length === 0) {
    improvements = [
      "Refine the brand positioning to name a specific customer and their outcome.",
      "Tighten the messaging so it would not survive being swapped onto a competitor.",
      "Invest in a distinctive visual system — the current execution reads as generic.",
    ];
  }

  // verdict: accept plain string or stringified object { roast | description | summary }
  let verdict = typeof r.verdict === "string" ? r.verdict : "";
  if (verdict.trim().startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(verdict);
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        const extracted = obj.roast ?? obj.description ?? obj.summary;
        if (typeof extracted === "string" && extracted) verdict = extracted;
      }
    } catch {
      /* keep as-is */
    }
  }
  if (!verdict) verdict = "No verdict was returned. Please run the roast again.";

  const pillar = (name: string) => {
    const p = (r[name] ?? {}) as { score?: unknown; roast?: unknown };
    const score = typeof p.score === "number" && Number.isFinite(p.score) ? p.score : 5;
    const roast =
      typeof p.roast === "string" && p.roast ? p.roast : `No ${name} analysis returned.`;
    return { score, roast };
  };

  const overall =
    typeof r.overall === "number" && Number.isFinite(r.overall) ? r.overall : 5;

  return {
    strategy: pillar("strategy"),
    creativity: pillar("creativity"),
    narrative: pillar("narrative"),
    digital: pillar("digital"),
    verdict,
    improvements,
    overall,
  };
}

/* ── Score bar component ──────────────────────────────── */

/* ── Animated counter hook ───────────────────────────── */

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target * 10) / 10);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

/* ── Score bar component (animated) ──────────────────── */

function ScoreBar({ label, score, roast, delay = 0 }: { label: string; score: number; roast: string; delay?: number }) {
  const pct = (score / 10) * 100;
  const color =
    score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-amber-500" : "bg-red-500";
  const [visible, setVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const displayScore = useCountUp(visible ? score : 0);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delay);
    const t2 = setTimeout(() => setBarWidth(pct), delay + 100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [delay, pct]);

  return (
    <div
      className={`rounded-xl border border-border bg-white p-6 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest">{label}</h3>
        <span className="text-2xl font-bold tracking-tight">{displayScore}/10</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{roast}</p>
    </div>
  );
}

/* ── Overall score display (animated) ────────────────── */

function OverallScoreDisplay({ score }: { score: number }) {
  const animated = useCountUp(score, 1500);
  const color =
    score >= 7
      ? "text-emerald-500"
      : score >= 5
      ? "text-amber-500"
      : "text-red-500";

  return (
    <div className="mt-6 inline-flex items-baseline gap-1">
      <span className={`text-7xl font-bold tracking-tight ${color}`}>
        {animated}
      </span>
      <span className="text-2xl font-bold text-zinc-300">/10</span>
    </div>
  );
}

/* ── History types ───────────────────────────────────── */

interface RoastHistoryEntry {
  brandName: string;
  industry: string;
  overall: number;
  date: string;
  s: number;
  c: number;
  n: number;
  d: number;
}

const HISTORY_KEY = "arto_roast_history";

function loadHistory(): RoastHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToHistory(entry: RoastHistoryEntry) {
  const history = loadHistory();
  // Avoid exact duplicates (same brand + industry)
  const filtered = history.filter(
    (h) => !(h.brandName === entry.brandName && h.industry === entry.industry)
  );
  // Most recent first, max 20
  const updated = [entry, ...filtered].slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

/* ── Share helpers ───────────────────────────────────── */

function buildShareUrl(brand: string, result: RoastResult): string {
  const params = new URLSearchParams({
    brand,
    score: String(result.overall),
    s: String(result.strategy.score),
    c: String(result.creativity.score),
    n: String(result.narrative.score),
    d: String(result.digital.score),
  });
  return `${window.location.origin}/roast?${params.toString()}`;
}

function parseSharedResult(params: URLSearchParams): { brand: string; result: RoastResult } | null {
  const brand = params.get("brand");
  const score = params.get("score");
  const s = params.get("s");
  const c = params.get("c");
  const n = params.get("n");
  const d = params.get("d");

  if (!brand || !score || !s || !c || !n || !d) return null;

  const sNum = Number(s);
  const cNum = Number(c);
  const nNum = Number(n);
  const dNum = Number(d);

  if ([sNum, cNum, nNum, dNum].some((v) => isNaN(v) || v < 0 || v > 10)) return null;

  const seed = hash(brand.toLowerCase());

  return {
    brand,
    result: {
      overall: Number(score),
      strategy: { score: sNum, roast: pick(strategyRoasts, seed) },
      creativity: { score: cNum, roast: pick(creativityRoasts, seed >> 2) },
      narrative: { score: nNum, roast: pick(narrativeRoasts, seed >> 4) },
      digital: { score: dNum, roast: pick(digitalRoasts, hash(brand)) },
      verdict: pick(verdicts, seed >> 1),
      improvements: (() => {
        const imps = [
          pick(improvementPool, seed),
          pick(improvementPool, seed + 3),
          pick(improvementPool, seed + 7),
        ];
        const unique = [...new Set(imps)];
        while (unique.length < 3) {
          unique.push(pick(improvementPool, seed + unique.length + 10));
        }
        return unique.slice(0, 3);
      })(),
    },
  };
}

/* ── Social share panel ─────────────────────────────── */

async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, "_blank");
  }
}

type ShareChannel = "x" | "linkedin" | "whatsapp" | "copy_link" | "download_square" | "download_story";

function SocialSharePanel({ brand, result }: { brand: string; result: RoastResult }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = buildShareUrl(brand, result);
  const shareText = `My brand "${brand}" scored ${result.overall}/10 on ARTO's Brand Roast. Think yours can do better?`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const shared = (channel: ShareChannel) => track("roast_shared", { channel, overall: result.overall });

  async function copyLink() {
    shared("copy_link");
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const socials: { label: string; channel: ShareChannel; color: string; href: string; icon: ReactNode }[] = [
    {
      label: "X / Twitter",
      channel: "x",
      color: "hover:bg-black hover:text-white hover:border-black",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      label: "LinkedIn",
      channel: "linkedin",
      color: "hover:bg-[#0077b5] hover:text-white hover:border-[#0077b5]",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
    },
    {
      label: "WhatsApp",
      channel: "whatsapp",
      color: "hover:bg-[#25d366] hover:text-white hover:border-[#25d366]",
      href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      ),
    },
  ];

  const ogBase = `/roast/og?brand=${encodeURIComponent(brand)}&score=${result.overall}&s=${result.strategy.score}&c=${result.creativity.score}&n=${result.narrative.score}&d=${result.digital.score}`;

  return (
    <div className="mt-6 flex flex-col items-center gap-4">
      {/* Social share */}
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">Share your roast</p>
      <div className="flex flex-wrap justify-center gap-2">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => shared(s.channel)}
            className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors ${s.color}`}
          >
            {s.icon}
            {s.label}
          </a>
        ))}
        <button
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100"
        >
          {copied ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="13" height="13" x="9" y="9" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy link
            </>
          )}
        </button>
      </div>

      {/* Download for Instagram */}
      <div className="flex flex-wrap justify-center gap-2">
        <p className="w-full text-center text-xs text-zinc-400">Download image for Instagram</p>
        <button
          onClick={() => {
            shared("download_square");
            downloadImage(`${ogBase}&format=square`, `roast-${brand}-square.png`);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium transition-colors hover:bg-zinc-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Feed 1:1
        </button>
        <button
          onClick={() => {
            shared("download_story");
            downloadImage(`${ogBase}&format=story`, `roast-${brand}-story.png`);
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium transition-colors hover:bg-zinc-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Story 9:16
        </button>
      </div>
    </div>
  );
}

/* ── Inner component (uses useSearchParams) ──────────── */

function BrandRoastInner() {
  const searchParams = useSearchParams();
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<RoastResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState(0);
  const [isSharedView, setIsSharedView] = useState(false);
  const [email, setEmail] = useState("");
  const [emailUnlocked, setEmailUnlocked] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [history, setHistory] = useState<RoastHistoryEntry[]>([]);

  // Load email + history from localStorage on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("arto_roast_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setEmailUnlocked(true);
    }
    setHistory(loadHistory());
  }, []);

  // Load shared results from URL params
  useEffect(() => {
    const shared = parseSharedResult(searchParams);
    if (shared) {
      setBrandName(shared.brand);
      setResult(shared.result);
      setIsSharedView(true);
    }
  }, [searchParams]);

  const stages = [
    "Scanning brand positioning...",
    "Evaluating creative direction...",
    "Analyzing narrative & voice...",
    "Auditing digital presence...",
    "Calculating ARTO Score...",
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim() || !industry.trim()) return;

    setResult(null);
    setAnalyzing(true);
    setStage(0);
    track("roast_started", {
      industry,
      company_size: companySize || "unspecified",
      has_url: websiteUrl.trim().length > 0,
      has_description: description.trim().length > 0,
    });

    // Run loading animation and API call in parallel
    let currentStage = 0;
    const stageInterval = setInterval(() => {
      currentStage++;
      if (currentStage < stages.length) {
        setStage(currentStage);
      }
    }, 800);

    const apiStart = Date.now();
    const minDisplayMs = 3000; // Minimum time to show loading animation

    fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandName, websiteUrl, industry, companySize, description }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const elapsed = Date.now() - apiStart;
        const remaining = Math.max(0, minDisplayMs - elapsed);

        // Normalize response — tolerant of Claude tool-schema drift
        const roastResult: RoastResult = normalizeRoastResult(data?.result);
        const source = typeof data?.source === "string" ? data.source : "unknown";

        // Wait for minimum display time so animation completes
        setTimeout(() => {
          clearInterval(stageInterval);
          setAnalyzing(false);
          setResult(roastResult);
          track("roast_completed", { industry, overall: roastResult.overall, source });
          const updated = saveToHistory({
            brandName,
            industry,
            overall: roastResult.overall,
            date: new Date().toISOString(),
            s: roastResult.strategy.score,
            c: roastResult.creativity.score,
            n: roastResult.narrative.score,
            d: roastResult.digital.score,
          });
          setHistory(updated);
        }, remaining);
      })
      .catch(() => {
        // Client-side fallback if API is unreachable
        const elapsed = Date.now() - apiStart;
        const remaining = Math.max(0, minDisplayMs - elapsed);

        setTimeout(() => {
          clearInterval(stageInterval);
          setAnalyzing(false);
          const roastResult = generateDeterministicRoast(brandName, industry, description);
          setResult(roastResult);
          track("roast_completed", { industry, overall: roastResult.overall, source: "client_fallback" });
          const updated = saveToHistory({
            brandName,
            industry,
            overall: roastResult.overall,
            date: new Date().toISOString(),
            s: roastResult.strategy.score,
            c: roastResult.creativity.score,
            n: roastResult.narrative.score,
            d: roastResult.digital.score,
          });
          setHistory(updated);
        }, remaining);
      });
  }

  function handleReset() {
    setResult(null);
    setBrandName("");
    setIndustry("");
    setCompanySize("");
    setWebsiteUrl("");
    setDescription("");
    setStage(0);
    setIsSharedView(false);
    // Clear URL params without reload
    window.history.replaceState({}, "", "/roast");
  }

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/arto-logo-black.png"
              alt="ARTO"
              width={80}
              height={24}
              className="h-6 w-auto"
            />
            <span className="text-sm font-medium tracking-wide text-muted">
              Creative 24/7
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-8 md:flex">
            <Link href="/work" className="text-sm text-muted hover:text-foreground transition-colors">
              Work
            </Link>
            <Link
              href="/roast"
              className="text-sm font-medium text-foreground transition-colors"
            >
              Brand Roast
            </Link>
            <Link
              href="/#pricing"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <a
              href="/#waitlist"
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Join Waitlist
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 md:hidden"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="8" x2="20" y2="8" />
                  <line x1="4" y1="16" x2="20" y2="16" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border px-6 py-4 md:hidden">
            <div className="flex flex-col gap-4">
              <Link href="/work" className="text-sm text-muted hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Work
              </Link>
              <Link href="/roast" className="text-sm font-medium text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Brand Roast
              </Link>
              <Link href="/#pricing" className="text-sm text-muted hover:text-foreground transition-colors" onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </Link>
              <a
                href="/#waitlist"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Join Waitlist
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="border-b border-border bg-foreground text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-24">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-zinc-400">
            Free tool by ARTO Studio AI
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Brand Roast
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-400">
            Get a brutally honest analysis of your brand — scored across Strategy,
            Creativity, Narrative, and Digital — using the same methodology we use
            with Fortune 500 clients.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            No sugarcoating. No generic advice. Just the truth your brand needs to hear.
          </p>
        </div>
      </section>

      {/* Form / Results */}
      <section className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-20">
          {!result && !analyzing && (
            <div className="mx-auto max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Enter your brand details
              </h2>
              <p className="mt-2 text-muted">
                Be honest — the more context you give, the sharper the roast.
              </p>
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">

                {/* Row 1: Brand name + Website */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="brandName" className="block text-sm font-medium">
                      Brand name *
                    </label>
                    <input
                      id="brandName"
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      required
                      className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                    />
                  </div>
                  <div>
                    <label htmlFor="websiteUrl" className="block text-sm font-medium">
                      Website URL
                      <span className="ml-1 text-xs font-normal text-zinc-400">(optional — improves accuracy)</span>
                    </label>
                    <input
                      id="websiteUrl"
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourband.com"
                      className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                    />
                  </div>
                </div>

                {/* Row 2: Industry + Company size */}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="industry" className="block text-sm font-medium">
                      Sector / Industry *
                    </label>
                    <select
                      id="industry"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      required
                      className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground bg-white"
                    >
                      <option value="">Select your sector</option>
                      <optgroup label="Technology">
                        <option value="SaaS / B2B Software">SaaS / B2B Software</option>
                        <option value="Consumer Tech">Consumer Tech / Apps</option>
                        <option value="Fintech">Fintech</option>
                        <option value="Healthtech">Healthtech / MedTech</option>
                        <option value="Edtech">Edtech</option>
                        <option value="Proptech">Proptech</option>
                        <option value="AI / Data">AI / Data</option>
                      </optgroup>
                      <optgroup label="Consumer & Retail">
                        <option value="E-commerce">E-commerce / Retail</option>
                        <option value="Fashion & Beauty">Fashion & Beauty</option>
                        <option value="Food & Beverage">Food & Beverage</option>
                        <option value="CPG">CPG / Consumer Goods</option>
                        <option value="Luxury">Luxury & Premium</option>
                      </optgroup>
                      <optgroup label="Services">
                        <option value="Agency">Agency / Creative Services</option>
                        <option value="Professional Services">Professional Services</option>
                        <option value="Legal">Legal / Consulting</option>
                        <option value="Finance">Finance / Investment</option>
                        <option value="Real Estate">Real Estate / Architecture</option>
                        <option value="Education">Education / Training</option>
                        <option value="Health & Wellness">Health & Wellness</option>
                        <option value="Travel & Hospitality">Travel & Hospitality</option>
                      </optgroup>
                      <optgroup label="Industry">
                        <option value="Manufacturing">Manufacturing / Industrial</option>
                        <option value="Automotive">Automotive</option>
                        <option value="Energy">Energy / Sustainability</option>
                        <option value="Construction">Construction / Engineering</option>
                        <option value="Logistics">Logistics / Supply Chain</option>
                      </optgroup>
                      <optgroup label="Media & Culture">
                        <option value="Entertainment">Entertainment / Media</option>
                        <option value="Sports & Fitness">Sports & Fitness</option>
                        <option value="Arts & Culture">Arts, Culture & Design</option>
                        <option value="NGO / Social Impact">NGO / Social Impact</option>
                      </optgroup>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="companySize" className="block text-sm font-medium">
                      Company size
                    </label>
                    <select
                      id="companySize"
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground bg-white"
                    >
                      <option value="">Select size</option>
                      <option value="solo">Solo / Freelancer (1)</option>
                      <option value="micro">Micro (2–10 people)</option>
                      <option value="small">Small (11–50 people)</option>
                      <option value="medium">Mid-size (51–200 people)</option>
                      <option value="large">Large (201–1,000 people)</option>
                      <option value="enterprise">Enterprise (1,000+)</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium">
                    Brief description of your brand
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does your brand do? Who is your audience? What makes you different (or not)?"
                    rows={4}
                    className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-foreground px-8 py-4 text-base font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  Roast My Brand
                </button>
                <p className="text-center text-xs text-zinc-400">
                  Free forever. No signup required. Results are for entertainment
                  and strategic inspiration.
                </p>
              </form>

              {/* Previous roasts */}
              {history.length > 0 && (
                <div className="mt-12 border-t border-border pt-10">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted">
                    Previous Roasts
                  </h3>
                  <div className="mt-4 space-y-3">
                    {history.map((entry, i) => {
                      const scoreColor =
                        entry.overall >= 7
                          ? "text-emerald-500"
                          : entry.overall >= 5
                          ? "text-amber-500"
                          : "text-red-500";
                      return (
                        <button
                          key={`${entry.brandName}-${i}`}
                          onClick={() => {
                            setBrandName(entry.brandName);
                            setIndustry(entry.industry);
                            setDescription("");
                            setResult(generateDeterministicRoast(entry.brandName, entry.industry, ""));
                          }}
                          className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-zinc-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{entry.brandName}</p>
                            <p className="text-xs text-muted">
                              {entry.industry} &middot;{" "}
                              {new Date(entry.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <span className={`ml-4 text-lg font-bold ${scoreColor}`}>
                            {entry.overall}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Analyzing animation */}
          {analyzing && (
            <div className="mx-auto max-w-2xl text-center py-12 md:py-20 animate-fade-in">
              <div className="mx-auto mb-8 h-16 w-16 animate-spin rounded-full border-4 border-zinc-200 border-t-foreground" />
              <h2 className="text-2xl font-bold tracking-tight">
                Analyzing {brandName}...
              </h2>
              <p className="mt-4 text-lg text-muted">{stages[stage]}</p>
              <div className="mt-8 mx-auto max-w-sm">
                <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-foreground transition-all duration-700"
                    style={{ width: `${((stage + 1) / stages.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="animate-fade-in">
              {/* Overall Score */}
              <div className="mb-12 text-center">
                <p className="text-sm font-medium uppercase tracking-widest text-muted">
                  ARTO Score for
                </p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
                  {brandName}
                </h2>
                <p className="mt-1 text-sm text-muted">{industry}</p>
                <OverallScoreDisplay score={result.overall} />
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  Weighted: Strategy (30%) + Creativity (25%) + Narrative (25%) + Digital (20%)
                </p>
                <SocialSharePanel brand={brandName} result={result} />
              </div>

              {/* Email gate — unlock full report */}
              {!emailUnlocked && !isSharedView ? (
                <div className="mx-auto max-w-lg">
                  <div className="rounded-2xl border border-border bg-zinc-50 p-8 text-center md:p-10">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight">
                      Unlock your full report
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      Enter your email to see the detailed breakdown by pillar, your verdict, and actionable improvements.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        // Read directly from the input element to handle browser autofill
                        const inputEl = e.currentTarget.querySelector("input[type=email]") as HTMLInputElement | null;
                        const value = (inputEl?.value || email).trim();
                        if (!value || !value.includes("@")) {
                          setEmailError("Please enter a valid email address.");
                          return;
                        }
                        setEmail(value);
                        setEmailError("");
                        localStorage.setItem("arto_roast_email", value);
                        setEmailUnlocked(true);
                        track("roast_email_submitted", { industry, overall: result.overall });
                        // Send email to server for trace association
                        fetch("/api/roast/email", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: value, brandName }),
                        }).catch(() => {}); // fire-and-forget
                      }}
                      className="mt-6"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                          placeholder="you@company.com"
                          className="flex-1 rounded-xl border border-border px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
                        />
                        <button
                          type="submit"
                          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 whitespace-nowrap"
                        >
                          Unlock full report
                        </button>
                      </div>
                      {emailError && (
                        <p className="mt-2 text-xs text-red-500">{emailError}</p>
                      )}
                    </form>
                    <p className="mt-4 text-xs text-zinc-400">
                      No spam. We may send you branding tips and ARTO updates.
                    </p>
                  </div>

                  {/* Blurred preview of what's behind the gate */}
                  <div className="mt-6 select-none pointer-events-none" aria-hidden="true">
                    <div className="grid gap-6 md:grid-cols-2 blur-md opacity-50">
                      <div className="rounded-xl border border-border bg-white p-6 h-32" />
                      <div className="rounded-xl border border-border bg-white p-6 h-32" />
                      <div className="rounded-xl border border-border bg-white p-6 h-32" />
                      <div className="rounded-xl border border-border bg-white p-6 h-32" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Score cards */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <ScoreBar label="Strategy" score={result.strategy.score} roast={result.strategy.roast} delay={0} />
                    <ScoreBar label="Creativity" score={result.creativity.score} roast={result.creativity.roast} delay={150} />
                    <ScoreBar label="Narrative" score={result.narrative.score} roast={result.narrative.roast} delay={300} />
                    <ScoreBar label="Digital" score={result.digital.score} roast={result.digital.roast} delay={450} />
                  </div>

                  {/* Verdict */}
                  <div className="mt-12 rounded-2xl border border-border bg-zinc-50 p-8 md:p-10">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted">
                      The Verdict
                    </h3>
                    <p className="mt-4 text-lg font-medium leading-relaxed">
                      {result.verdict}
                    </p>
                  </div>

                  {/* Improvements */}
                  <div className="mt-8 rounded-2xl border border-border p-8 md:p-10">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted">
                      Where to Start
                    </h3>
                    <ul className="mt-4 space-y-4">
                      {(Array.isArray(result.improvements) ? result.improvements : []).map((imp, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-white">
                            {i + 1}
                          </span>
                          <span className="text-sm leading-relaxed text-muted">{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {/* CTA */}
              <div className="mt-12 rounded-2xl bg-foreground p-8 text-center text-white md:p-12">
                <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {isSharedView ? "Think your brand can do better?" : "Ready to fix what's broken?"}
                </h3>
                <p className="mx-auto mt-4 max-w-lg text-zinc-400">
                  {isSharedView
                    ? "Get your own free brand roast — scored across Strategy, Creativity, Narrative, and Digital using ARTO's real methodology."
                    : "This roast is just the surface. ARTO Studio AI gives you a complete brand strategy, creative direction, and content system — powered by 15+ years of real methodology."}
                </p>
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  {isSharedView ? (
                    <button
                      onClick={handleReset}
                      className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-zinc-100"
                    >
                      Roast my brand
                    </button>
                  ) : (
                    <>
                      <a
                        href="/#waitlist"
                        className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-zinc-100"
                      >
                        Start 7-day free trial
                      </a>
                      <button
                        onClick={handleReset}
                        className="inline-flex items-center justify-center rounded-full border border-zinc-700 px-8 py-3.5 text-base font-medium transition-colors hover:bg-zinc-800"
                      >
                        Roast another brand
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-foreground text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <Image
                src="/brand/arto-logo-black.png"
                alt="ARTO"
                width={60}
                height={18}
                className="h-4 w-auto invert"
              />
              <span className="text-xs tracking-wide text-zinc-500">Creative 24/7</span>
            </div>
            <p className="text-xs text-zinc-500">
              A product by ARTO Group. Design, Culture & Technology since 2009.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Error boundary ────────────────────────────────────── */

class RoastErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BrandRoast] Error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-zinc-500">{this.state.error}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: "" });
              window.location.href = "/roast";
            }}
            className="mt-6 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Page export (Suspense boundary for useSearchParams) ── */

export default function BrandRoast() {
  return (
    <RoastErrorBoundary>
      <Suspense fallback={null}>
        <BrandRoastInner />
      </Suspense>
    </RoastErrorBoundary>
  );
}
