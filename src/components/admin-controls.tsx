"use client";

import { useState, useTransition } from "react";
import { revealHost, setBanned, setPlan } from "@/app/admin/actions";

export function RevealHost({ callId }: { callId: string }) {
  const [host, setHost] = useState<{ name: string | null; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (host) {
    return (
      <span className="text-sm">
        <span className="text-white">{host.name ?? "—"}</span>{" "}
        <span className="text-neutral-400">{host.email}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              setHost(await revealHost({ callId }));
            } catch (e) {
              setError((e as Error).message);
            }
          })
        }
        className="rounded-md border border-amber-700 px-2 py-1 text-xs text-amber-300 hover:bg-amber-950 disabled:opacity-50"
        title="Reveals the real account. This is recorded in the audit log."
      >
        {pending ? "Revealing…" : "Reveal host"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}

export function UserActions({
  userId,
  plan,
  banned,
  isSelf,
}: {
  userId: string;
  plan: "FREE" | "PRO";
  banned: boolean;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError((e as Error).message);
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Plan"
        defaultValue={plan}
        disabled={pending}
        onChange={(e) => run(() => setPlan({ userId, plan: e.target.value }))}
        className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs"
      >
        <option value="FREE">FREE</option>
        <option value="PRO">PRO</option>
      </select>
      {!isSelf && (
        <button
          disabled={pending}
          onClick={() => {
            if (!banned && !confirm("Ban this user? They'll be signed out and see a suspended page.")) return;
            run(() => setBanned({ userId, banned: !banned }));
          }}
          className={`rounded-md px-2 py-1 text-xs disabled:opacity-50 ${
            banned
              ? "border border-neutral-700 hover:bg-neutral-800"
              : "border border-red-800 text-red-300 hover:bg-red-950"
          }`}
        >
          {banned ? "Unban" : "Ban"}
        </button>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
