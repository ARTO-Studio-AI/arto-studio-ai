/**
 * Shared helpers for the Studio interface.
 */

export function keyHeaders(apiKey: string): HeadersInit {
  return { "x-arto-api-key": apiKey };
}

export function keyHeadersWithJson(apiKey: string): HeadersInit {
  return { "x-arto-api-key": apiKey, "Content-Type": "application/json" };
}

/* Escala de D21 (Victor, 12 nov 2026): azul 7 o mas, negro de 5 a 6.9, rojo abajo de 5. Sin semaforo. */
export function scoreColor(score: number): string {
  if (score >= 7) return "text-[var(--accent)]";
  if (score >= 5) return "text-black";
  return "text-[var(--bad)]";
}

export function scoreBg(score: number): string {
  return score < 5 ? "bg-white border-[var(--bad)]" : "bg-white border-zinc-200";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function tierColor(tier: string): string {
  switch (tier) {
    case "internal":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "enterprise":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "agency":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "starter":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "trial":
    default:
      return "bg-zinc-50 text-zinc-700 border-zinc-200";
  }
}

export interface StudioClient {
  id: string;
  name: string;
  email: string;
  tier: string;
  allowed_skills: string[];
  rate_limit_per_hour: number;
  trial_calls_limit: number | null;
  trial_calls_used: number;
}

export interface SkillCatalogEntry {
  slug: string;
  name: string;
  description: string;
  public: boolean;
  requiresWebFetch: boolean;
  inputFields: string[];
  outputFields: string[];
}

export interface SkillTraceLite {
  id: number;
  skill_slug: string;
  client_id: string | null;
  input: unknown;
  output: unknown;
  source: "ai" | "fallback";
  model: string;
  latency_ms: number;
  email: string | null;
  created_at: string;
}
