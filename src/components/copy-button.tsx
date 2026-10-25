"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy invite link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
