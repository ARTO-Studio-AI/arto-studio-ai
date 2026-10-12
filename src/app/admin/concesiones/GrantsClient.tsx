"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";

export interface GrantView {
  email: string;
  tier: string;
  is_admin: boolean;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  registered: boolean;
  profileTier: string | null;
  stripeLive: boolean;
}

const FIELD = "rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none";

async function post(body: unknown) {
  const r = await fetch("/api/admin/concesiones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

export default function GrantsClient({ rows }: { rows: GrantView[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("pro");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; bad?: boolean } | null>(null);

  async function grant() {
    setBusy(true);
    const r = await post({ action: "grant", email, tier, note });
    setBusy(false);
    if (!r.ok) return setStatus({ text: String(r.data.error ?? "No se pudo dar el plan."), bad: true });
    setStatus({ text: `${email.trim().toLowerCase()}: plan ${tier} ${r.data.result === "created" ? "concedido" : "actualizado"}.` });
    setEmail("");
    setNote("");
    router.refresh();
  }

  async function revoke(e: string) {
    setBusy(true);
    const r = await post({ action: "revoke", email: e });
    setBusy(false);
    setAsking(null);
    if (!r.ok) return setStatus({ text: String(r.data.error ?? "No se pudo quitar."), bad: true });
    setStatus({
      text: r.data.keptByStripe
        ? `${e}: concesión quitada; conserva Pro porque paga por Stripe.`
        : r.data.downgraded
          ? `${e}: concesión quitada; la cuenta volvió a gratis.`
          : `${e}: concesión quitada.`,
    });
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-2 rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-4">
        <label className="text-sm font-medium text-zinc-700">Correo
          <input className={`${FIELD} mt-1 block w-72`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.com" />
        </label>
        <label className="text-sm font-medium text-zinc-700">Plan
          <select className={`${FIELD} mt-1 block`} value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">Motivo (opcional)
          <input className={`${FIELD} mt-1 block w-72`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="cliente ARTO, prensa, equipo…" />
        </label>
        <Button onClick={grant} disabled={busy || !email.includes("@")}>Dar plan</Button>
      </div>

      {status && (
        <div role="status" aria-live="polite" className={`rounded-[var(--radius-md)] border px-4 py-3 text-sm ${status.bad ? "border-red-200 bg-red-50 text-red-800" : "border-zinc-200 bg-white text-zinc-700"}`}>
          {status.text}
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50">
            <tr>{["Correo", "Plan concedido", "Cuenta", "Notas", ""].map((h) => <th key={h} className="text-eyebrow px-4 py-2.5 font-medium text-zinc-500">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((g) => (
              <tr key={g.email}>
                <td className="px-4 py-2.5 align-top text-zinc-900">{g.email}</td>
                <td className="px-4 py-2.5 align-top">
                  <Badge tone="inverse" dot>{g.tier}</Badge>
                  {g.is_admin && <div className="mt-1"><Badge tone="neutral">administrador</Badge></div>}
                </td>
                <td className="px-4 py-2.5 align-top text-zinc-600">
                  {g.registered ? `registrada · plan actual ${g.profileTier}` : "todavía no se registra"}
                  {g.stripeLive && <div className="text-xs text-zinc-500">paga por Stripe</div>}
                </td>
                <td className="max-w-xs whitespace-pre-line px-4 py-2.5 align-top text-xs text-zinc-500">{g.notes ?? "—"}</td>
                <td className="px-4 py-2.5 align-top">
                  {g.is_admin ? (
                    <span className="text-xs text-zinc-400">bloqueada</span>
                  ) : asking === g.email ? (
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => revoke(g.email)} disabled={busy}>Sí, quitar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>No</Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setAsking(g.email)} disabled={busy}>Quitar</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-500">Sin concesiones.</p>}
      </div>
    </div>
  );
}
