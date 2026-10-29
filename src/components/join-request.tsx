"use client";

import Link from "next/link";
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
  const [hostStarted, setHostStarted] = useState(true);
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
        setHostStarted(data.callStatus !== "SCHEDULED");
        if (data.callStatus === "ENDED") setStatus("ENDED");
        else setStatus(data.status);
      } catch {
        // Network blip: try again on the next tick.
      }
    };
    poll();
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
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-700 border-t-green-400" />
        <p className="text-lg font-medium">
          {status === "ADMITTED"
            ? "You're in. Joining…"
            : hostStarted
              ? `Asking ${alias} to let you in…`
              : `Waiting for ${alias} to start the call…`}
        </p>
        <p className="text-sm text-neutral-500">
          {hostStarted ? "You'll join as soon as you're admitted." : "You'll be asked in when the call starts."} Keep this
          page open.
        </p>
      </div>
    );
  }
  if (status === "DENIED") return <Notice>{alias} declined your request to join.</Notice>;
  if (status === "ENDED") return <Notice>This call has ended.</Notice>;

  return (
    <form
      className="space-y-4"
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
      <label className="glass flex cursor-pointer items-start gap-3 rounded-[22px] p-4">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 accent-green-500"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span className="text-sm text-neutral-300">{CONSENT_TEXT}.</span>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!consent || pending}
        className="h-14 w-full rounded-full bg-white text-[17px] font-semibold text-black shadow-[0_10px_40px_-10px_rgba(255,255,255,0.35)] transition active:scale-[0.98] disabled:bg-white/10 disabled:text-neutral-500 disabled:shadow-none"
      >
        {pending ? "Sending…" : "Ask to join"}
      </button>
    </form>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-[22px] p-5 text-center">
      <p className="text-lg text-neutral-200">{children}</p>
      <Link
        href="/dashboard"
        aria-label="Home"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl ring-1 ring-white/15"
      >
        🏠
      </Link>
    </div>
  );
}
