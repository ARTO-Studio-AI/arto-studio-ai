"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Lang } from "@/lib/i18n";

export default function RemovePromptButton({
  collectionId,
  promptId,
  lang,
}: { collectionId: string; promptId: string; lang: Lang }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(lang === "es" ? `Quitar ${promptId} de esta colección?` : `Remove ${promptId} from this collection?`)) return;
    setBusy(true);
    const resp = await fetch(`/api/collections/${collectionId}/prompts?prompt_id=${encodeURIComponent(promptId)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (resp.ok) router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={lang === "es" ? "Quitar" : "Remove"}
      className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50"
    >
      ✕
    </button>
  );
}
