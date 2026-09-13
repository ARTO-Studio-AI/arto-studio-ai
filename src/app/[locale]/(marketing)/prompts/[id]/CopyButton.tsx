"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/* Copia el cuerpo del prompt y manda prompt_copied. promptId, promptTier y
 * locale son opcionales para no romper otros usos del boton. */

export default function CopyButton({
  text,
  labelCopy = "Copy",
  labelCopied = "Copied ✓",
  promptId,
  promptTier,
  locale,
}: {
  text: string;
  labelCopy?: string;
  labelCopied?: string;
  promptId?: string;
  promptTier?: string;
  locale?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        if (promptId) {
          track("prompt_copied", { prompt_id: promptId, prompt_tier: promptTier ?? "free", locale: locale ?? "en" });
        }
      }}
      className="rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-1 text-xs font-medium hover:border-zinc-500"
    >
      {copied ? labelCopied : labelCopy}
    </button>
  );
}
