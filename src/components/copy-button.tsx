"use client";

import { useState } from "react";

/** Opens the phone's share sheet where available, otherwise copies to the clipboard. */
export function ShareButton({ url, label = "Share invite" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my masqq call", url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/10 hover:bg-white/15"
    >
      {copied ? "Link copied" : label}
    </button>
  );
}
