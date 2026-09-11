"use client";

import { useState } from "react";

export default function CopyButton({
  text,
  labelCopy = "Copy",
  labelCopied = "Copied ✓",
}: {
  text: string;
  labelCopy?: string;
  labelCopied?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-[var(--radius-sm)] border border-zinc-300 px-3 py-1 text-xs font-medium hover:border-zinc-500"
    >
      {copied ? labelCopied : labelCopy}
    </button>
  );
}
