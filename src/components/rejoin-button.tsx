"use client";

import { useState, useTransition } from "react";
import { rejoinCall } from "@/app/call/[callId]/actions";

/** Rejoin a call the guest left. Reloads into the call on success. */
export function RejoinButton({ callId, className = "" }: { callId: string; className?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await rejoinCall({ callId });
            if (res.ok) window.location.assign(`/call/${callId}`);
            else setError(res.error);
          })
        }
        className={`rounded-full bg-white px-6 py-2.5 text-[15px] font-semibold text-black transition active:scale-[0.98] disabled:opacity-50 ${className}`}
      >
        {pending ? "Rejoining…" : "Rejoin call"}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </span>
  );
}
