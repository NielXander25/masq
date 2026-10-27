"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/primitives";

export type LobbyGuest = {
  id: string;
  status: "PENDING" | "ADMITTED";
  name: string | null;
  email: string;
  image: string | null;
};

/** Host only: polls who's waiting and who's in, and admits or denies. */
export function useLobby(callId: string, enabled: boolean) {
  const [guests, setGuests] = useState<LobbyGuest[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/calls/${callId}/lobby`, { cache: "no-store" });
      if (!res.ok) return;
      const data: { guests: LobbyGuest[]; maxParticipants: number | null } = await res.json();
      setGuests(data.guests);
      setLimit(data.maxParticipants);
    } catch {
      // Try again on the next tick.
    }
  }, [callId]);

  useEffect(() => {
    if (!enabled) return;
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [load, enabled]);

  const decide = useCallback(
    async (id: string, action: "admit" | "deny") => {
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
    },
    [callId, load],
  );

  return {
    waiting: guests.filter((g) => g.status === "PENDING"),
    inCall: guests.filter((g) => g.status === "ADMITTED"),
    limit,
    busy,
    error,
    decide,
  };
}

export type Lobby = ReturnType<typeof useLobby>;

/** Meet-style card at the top of the call: "Gina wants to join". */
export function JoinRequestCard({ lobby }: { lobby: Lobby }) {
  const g = lobby.waiting[0];
  if (!g) return null;
  const more = lobby.waiting.length - 1;
  return (
    <div className="pointer-events-auto mx-auto w-full max-w-md rounded-2xl bg-neutral-900/95 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur">
      <div className="flex items-center gap-3">
        <Avatar name={g.name ?? g.email} image={g.image} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{g.name ?? g.email} wants to join</div>
          <div className="truncate text-xs text-neutral-400">{g.email}</div>
        </div>
      </div>
      {lobby.error && <p className="mt-2 rounded bg-red-950 px-2 py-1 text-sm text-red-300">{lobby.error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          disabled={lobby.busy === g.id}
          onClick={() => lobby.decide(g.id, "deny")}
          className="flex-1 rounded-full bg-neutral-800 px-3 py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
        >
          Deny
        </button>
        <button
          disabled={lobby.busy === g.id}
          onClick={() => lobby.decide(g.id, "admit")}
          className="flex-1 rounded-full bg-green-500 px-3 py-2 text-sm font-semibold text-black hover:bg-green-400 disabled:opacity-50"
        >
          Admit
        </button>
      </div>
      {more > 0 && <p className="mt-2 text-center text-xs text-neutral-400">+{more} more waiting · open People</p>}
    </div>
  );
}

/** The People sheet's contents. */
export function LobbyPanel({ lobby }: { lobby: Lobby }) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-300">
          Waiting to join
          {lobby.waiting.length > 0 && (
            <span className="rounded-full bg-amber-400 px-2 text-xs text-black">{lobby.waiting.length}</span>
          )}
        </h3>
        {lobby.limit !== null && (
          <p className="mt-1 text-xs text-neutral-500">Free plan: up to {lobby.limit - 1} guest at a time.</p>
        )}
        {lobby.error && <p className="mt-2 rounded bg-red-950 px-2 py-1 text-sm text-red-300">{lobby.error}</p>}
        {lobby.waiting.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Nobody is waiting.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {lobby.waiting.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-2xl bg-neutral-950 p-3">
                <Avatar name={g.name ?? g.email} image={g.image} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{g.name ?? g.email}</div>
                  <div className="truncate text-xs text-neutral-400">{g.email}</div>
                </div>
                <button
                  disabled={lobby.busy === g.id}
                  onClick={() => lobby.decide(g.id, "deny")}
                  className="rounded-full bg-neutral-800 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Deny
                </button>
                <button
                  disabled={lobby.busy === g.id}
                  onClick={() => lobby.decide(g.id, "admit")}
                  className="rounded-full bg-green-500 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  Admit
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="text-sm font-medium text-neutral-300">In the call</h3>
        {lobby.inCall.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No guests yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {lobby.inCall.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-2xl bg-neutral-950 p-3">
                <Avatar name={g.name ?? g.email} image={g.image} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{g.name ?? g.email}</div>
                  <div className="truncate text-xs text-neutral-400">{g.email}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
