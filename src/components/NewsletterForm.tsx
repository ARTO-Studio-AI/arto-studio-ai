"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";

/* Aviso de lanzamiento de Skills Studio y Agentes. POSTea a /api/waitlist,
 * que ya existe y guarda email + source en la tabla waitlist. Es solo un
 * "avisame cuando abra": no promete acceso anticipado ni descuentos. */

interface Props {
  source?: "skills" | "agents" | "general";
  cta?: string;
}

export default function NewsletterForm({ source = "general", cta = "Notify me" }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      if (res.ok) {
        setStatus("ok");
        setMessage("Saved. We will email you when it opens.");
        setEmail("");
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(data.error || "Something went wrong. Try again?");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again?");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="flex-1 rounded-[var(--radius-sm)] border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-zinc-900 focus:outline-none"
        disabled={status === "loading" || status === "ok"}
      />
      <button type="submit" disabled={status === "loading" || status === "ok"} className={buttonClass("primary", "md")}>
        {status === "loading" ? "Saving..." : status === "ok" ? "Saved" : cta}
      </button>
      {message && (
        <p className={`text-xs ${status === "error" ? "text-[var(--bad)]" : "text-zinc-600"}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
