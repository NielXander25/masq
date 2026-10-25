"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { requestJoin } from "@/app/c/[callId]/actions";

type Status = "NONE" | "PENDING" | "ADMITTED" | "DENIED" | "LEFT" | "ENDED";

export const CONSENT_TEXT =
  "The host is anonymous. They will see your name and email, and this call may be recorded and transcribed";

export function JoinRequest({
  callId,
  alias,
  initialStatus,
}: {
  callId: string;
  alias: string;
  initialStatus: Status;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "PENDING") return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/calls/${callId}/me`, { cache: "no-store" });
        if (!res.ok) return;
        const data: { status: Status; callStatus: string } = await res.json();
        if (stopped) return;
        if (data.callStatus === "ENDED") setStatus("ENDED");
        else setStatus(data.status);
      } catch {
        // Network blip: try again on the next tick.
      }
    };
    const timer = setInterval(poll, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [callId, status]);

  useEffect(() => {
    if (status === "ADMITTED") router.replace(`/call/${callId}`);
  }, [status, callId, router]);

  if (status === "PENDING" || status === "ADMITTED") {
    return (
      <div className="rounded-xl border border-neutral-800 p-5">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
          <p>{status === "ADMITTED" ? "Admitted. Joining…" : `Waiting for ${alias} to let you in…`}</p>
        </div>
        <p className="mt-2 text-sm text-neutral-500">Keep this page open.</p>
      </div>
    );
  }
  if (status === "DENIED") {
    return <Notice>{alias} declined your request to join.</Notice>;
  }
  if (status === "ENDED") {
    return <Notice>This call has ended.</Notice>;
  }

  return (
    <form
      className="space-y-4 rounded-xl border border-neutral-800 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await requestJoin({ callId, consent });
          if (res.ok) setStatus("PENDING");
          else setError(res.error);
        });
      }}
    >
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span className="text-sm text-neutral-300">{CONSENT_TEXT}.</span>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!consent || pending}
        className="w-full rounded-lg bg-white px-4 py-2.5 font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Request to join"}
      </button>
    </form>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-neutral-800 p-5 text-neutral-300">{children}</p>;
}
