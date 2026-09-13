"use client";

import { useState, useTransition } from "react";
import { track } from "@/lib/analytics";

export default function FavoriteButton({
  promptId,
  initialFavorited,
  signedIn,
  labelAdd,
  labelRemove,
  labelSignIn,
}: {
  promptId: string;
  initialFavorited: boolean;
  signedIn: boolean;
  labelAdd: string;
  labelRemove: string;
  labelSignIn: string;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <a
        href="/login"
        className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500"
      >
        <span aria-hidden>♡</span> {labelSignIn}
      </a>
    );
  }

  function toggle() {
    setError(null);
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const res = await fetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId }),
      });
      if (!res.ok) {
        setFavorited(!next);
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Error");
        return;
      }
      if (next) track("favorite_added", { prompt_id: promptId });
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={favorited}
        className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
          favorited
            ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700"
            : "border-zinc-300 text-zinc-700 hover:border-zinc-500"
        }`}
      >
        <span aria-hidden>{favorited ? "♥" : "♡"}</span>
        {favorited ? labelRemove : labelAdd}
      </button>
      {error && <span className="mt-1 text-[10px] text-[var(--bad)]">{error}</span>}
    </div>
  );
}
