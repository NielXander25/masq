"use client";

import { useState } from "react";

/** Opens the phone's share sheet where available, otherwise copies to the clipboard. */
export function ShareButton({ url, label = "Share invite" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Masq call", url });
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
      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
    >
      {copied ? "Link copied" : label}
    </button>
  );
}
