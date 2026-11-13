/**
 * Shared utilities for the admin tabs.
 * Every tab lives under `src/app/admin/` and reuses this module.
 */

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

export function authHeaders(_apiKey?: string): HeadersInit {
  // Session-based admin auth: the browser sends Supabase cookies on
  // same-origin fetches, so no Authorization header is needed. Kept as a
  // function to avoid touching every tab callsite.
  return {};
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
