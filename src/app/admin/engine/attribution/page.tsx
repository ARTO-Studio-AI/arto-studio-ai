"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { authHeaders, formatDate } from "../../shared";

interface AttributionEvent {
  id: string;
  event_type: string;
  source: string | null;
  source_detail: string | null;
  target_id: string | null;
  user_id: string | null;
  user_email: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  value_usd: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AttributionStats {
  total: number;
  totalValueUsd: number;
  byEventType: { event_type: string; count: number; total_value: number }[];
  bySource: { source: string | null; count: number }[];
  byCampaign: { utm_campaign: string | null; count: number }[];
  last30dConversions: number;
  last30dValueUsd: number;
}

const EVENT_TYPES = [
  "signup",
  "trial_start",
  "first_search",
  "first_skill_run",
  "conversion",
  "churn",
  "reactivation",
];

function eventColor(t: string): string {
  switch (t) {
    case "conversion":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "signup":
    case "trial_start":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "first_search":
    case "first_skill_run":
    case "reactivation":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "churn":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-zinc-50 text-zinc-600 border-zinc-200";
  }
}

function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function AttributionPage() {
  // apiKey is a vestige of the old Bearer-token auth — kept as a
  // const so existing fetch(... { headers: authHeaders(apiKey) }) calls
  // type-check. The layout now session-gates, and authHeaders() returns
  // an empty object so the value is ignored at runtime.
  const apiKey = "session";
  const [stats, setStats] = useState<AttributionStats | null>(null);
  const [events, setEvents] = useState<AttributionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filterEventType, setFilterEventType] = useState("");
  const [filterSource, setFilterSource] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterEventType) params.set("event_type", filterEventType);
      if (filterSource) params.set("source", filterSource);
      params.set("limit", "100");

      const [statsRes, eventsRes] = await Promise.all([
        fetch("/api/admin/engine/attribution?view=stats", {
          headers: authHeaders(apiKey),
        }),
        fetch(`/api/admin/engine/attribution?${params.toString()}`, {
          headers: authHeaders(apiKey),
        }),
      ]);

      if (statsRes.status === 503) {
        setError("DATABASE_URL is not configured on the server.");
        setLoading(false);
        return;
      }
      if (!statsRes.ok) {
        setError(`Failed to fetch stats (HTTP ${statsRes.status}).`);
        setLoading(false);
        return;
      }

      const statsData = (await statsRes.json()) as AttributionStats;
      const eventsData = (await eventsRes.json()) as { events: AttributionEvent[] };
      setStats(statsData);
      setEvents(eventsData.events || []);
    } catch {
      setError("Failed to fetch attribution events.");
    }
    setLoading(false);
  }, [apiKey, filterEventType, filterSource]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Attribution</h1>
      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-700">
        <p>
          <strong className="text-zinc-900">Qué es:</strong> eventos de conversión por
          source, campaign y UTM. Cubre el funnel: signup → trial_start →
          first_search → first_skill_run → conversion (paid) → churn / reactivation.
        </p>
        <p className="mt-1.5">
          <strong className="text-zinc-900">Cómo usarlo:</strong> click event-type card
          o source card para filtrar. Click fila para expandir y ver UTM completo +
          metadata.
        </p>
        <p className="mt-1.5">
          <strong className="text-zinc-900">Qué buscar:</strong> &ldquo;Conversions
          30d&rdquo; creciendo = funnel sano. &ldquo;Value 30d&rdquo; comparable al CAC
          objetivo. Sources concentrados en 1-2 canales = riesgo, diversificar.
        </p>
      </div>

      {loading && (
        <div className="mt-8 flex items-center gap-3 text-sm text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          Loading events...
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {stats && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
                Total events
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
                Conversions 30d
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-purple-600">
                {stats.last30dConversions}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {formatUsd(stats.last30dValueUsd)} value
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
                All-time value
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600">
                {formatUsd(stats.totalValueUsd)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
                Active sources
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{stats.bySource.length}</p>
            </div>
          </div>

          {stats.byEventType.length > 0 && (
            <>
              <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-zinc-500">
                By event type
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {stats.byEventType.map((e) => (
                  <button
                    key={e.event_type}
                    onClick={() =>
                      setFilterEventType(
                        e.event_type === filterEventType ? "" : e.event_type
                      )
                    }
                    className={`rounded-xl border bg-white p-4 text-left transition-colors ${
                      filterEventType === e.event_type
                        ? "border-zinc-900"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <p className="text-xs font-medium text-zinc-500">{e.event_type}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className="text-2xl font-bold tracking-tight">{e.count}</p>
                      {e.total_value > 0 && (
                        <p className="text-xs text-zinc-400">{formatUsd(e.total_value)}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {stats.bySource.length > 0 && (
            <>
              <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-zinc-500">
                By source
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {stats.bySource.map((s, i) => (
                  <button
                    key={`${s.source}-${i}`}
                    onClick={() =>
                      setFilterSource(s.source && s.source === filterSource ? "" : s.source || "")
                    }
                    className={`rounded-xl border bg-white p-4 text-left transition-colors ${
                      filterSource === s.source
                        ? "border-zinc-900"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <p className="text-xs font-medium text-zinc-500">{s.source || "—"}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight">{s.count}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <select
          value={filterEventType}
          onChange={(e) => setFilterEventType(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All event types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {filterSource && (
          <button
            onClick={() => setFilterSource("")}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:border-zinc-400"
          >
            Source: {filterSource} ×
          </button>
        )}
      </div>

      {events.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-widest text-zinc-500">
              <tr>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Value</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const expanded = expandedId === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr
                      className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50"
                      onClick={() => setExpandedId(expanded ? null : e.id)}
                    >
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${eventColor(e.event_type)}`}
                        >
                          {e.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {e.source || "—"}
                        {e.source_detail && (
                          <span className="block text-[10px] text-zinc-400">
                            {e.source_detail}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">{e.user_email || "—"}</td>
                      <td className="px-4 py-2 text-xs">
                        {e.value_usd ? formatUsd(e.value_usd) : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-500">
                        {formatDate(e.created_at)}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-zinc-100 bg-zinc-50">
                        <td colSpan={5} className="px-4 py-3 text-xs">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <p className="font-semibold text-zinc-500">UTM</p>
                              <p className="mt-1">
                                {e.utm_source || "—"} / {e.utm_medium || "—"} /{" "}
                                {e.utm_campaign || "—"}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-500">User ID</p>
                              <p className="mt-1 font-mono text-[10px]">
                                {e.user_id || "—"}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-500">Target ID</p>
                              <p className="mt-1 font-mono text-[10px]">
                                {e.target_id || "—"}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-500">Event ID</p>
                              <p className="mt-1 font-mono text-[10px]">{e.id}</p>
                            </div>
                          </div>
                          {e.metadata && Object.keys(e.metadata).length > 0 && (
                            <details className="mt-3">
                              <summary className="cursor-pointer font-semibold text-zinc-500">
                                Metadata
                              </summary>
                              <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-[11px] text-zinc-100">
                                {JSON.stringify(e.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && stats && events.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No attribution events match the current filters. Module 4 + signup hooks will
          populate this view.
        </div>
      )}
    </>
  );
}
