"use client";

import { useCallback, useEffect, useState } from "react";

type Guest = {
  id: string;
  status: "PENDING" | "ADMITTED";
  name: string | null;
  email: string;
  image: string | null;
};

export function LobbyPanel({ callId }: { callId: string }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/calls/${callId}/lobby`, { cache: "no-store" });
      if (!res.ok) return;
      const data: { guests: Guest[]; maxParticipants: number | null } = await res.json();
      setGuests(data.guests);
      setLimit(data.maxParticipants);
    } catch {
      // Try again on the next tick.
    }
  }, [callId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [load]);

  async function decide(id: string, action: "admit" | "deny") {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/calls/${callId}/participants/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong");
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  const waiting = guests.filter((g) => g.status === "PENDING");
  const inCall = guests.filter((g) => g.status === "ADMITTED");

  return (
    <aside className="flex flex-col gap-4 border-neutral-800 p-4 md:border-l">
      <section>
        <h2 className="flex items-center gap-2 font-medium">
          Waiting
          {waiting.length > 0 && (
            <span className="rounded-full bg-amber-500 px-2 text-xs text-black">{waiting.length}</span>
          )}
        </h2>
        {limit !== null && (
          <p className="mt-1 text-xs text-neutral-500">Free plan: up to {limit - 1} guest at a time.</p>
        )}
        {error && <p className="mt-2 rounded bg-red-950 px-2 py-1 text-sm text-red-300">{error}</p>}
        {waiting.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Nobody is waiting.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {waiting.map((g) => (
              <li key={g.id} className="rounded-lg border border-neutral-800 p-3">
                <GuestIdentity guest={g} />
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy === g.id}
                    onClick={() => decide(g.id, "admit")}
                    className="flex-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
                  >
                    Admit
                  </button>
                  <button
                    disabled={busy === g.id}
                    onClick={() => decide(g.id, "deny")}
                    className="flex-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
                  >
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium">In the call</h2>
        {inCall.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No guests yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {inCall.map((g) => (
              <li key={g.id} className="rounded-lg border border-neutral-800 p-3">
                <GuestIdentity guest={g} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function GuestIdentity({ guest }: { guest: Guest }) {
  return (
    <div className="flex items-center gap-3">
      {guest.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={guest.image} alt="" className="h-9 w-9 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <div className="h-9 w-9 rounded-full bg-neutral-700" />
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{guest.name ?? guest.email}</div>
        <div className="truncate text-xs text-neutral-400">{guest.email}</div>
      </div>
    </div>
  );
}
