"use client";

import { useRemoteParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import { MicIcon, MicOffIcon } from "@/components/ui/icons";
import { RevealName } from "@/components/dynamic-island";

export type LobbyGuest = {
  id: string;
  status: "PENDING" | "ADMITTED";
  /** Their LiveKit identity, to match them to who's connected. */
  identity: string;
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
    async (id: string, action: "admit" | "deny" | "mute" | "remove") => {
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
                <div className="min-w-0 flex-1">
                  <RevealName name={g.name ?? g.email} email={g.email} image={g.image} />
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
      <InCallList lobby={lobby} />
    </div>
  );
}

/** Guests in the call, with host controls: mute their mic or remove them. */
function InCallList({ lobby }: { lobby: Lobby }) {
  const remotes = useRemoteParticipants();
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <section>
      <h3 className="text-sm font-medium text-neutral-300">In the call</h3>
      {lobby.inCall.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No guests yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {lobby.inCall.map((g) => {
            const live = remotes.find((p) => p.identity === g.identity);
            const micOn = Boolean(live?.getTrackPublication(Track.Source.Microphone)?.isMuted === false);
            const name = g.name ?? g.email;
            return (
              <li key={g.id} className="rounded-2xl bg-neutral-950 p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <RevealName name={live ? name : `${name} (away)`} email={g.email} image={g.image} />
                  </div>
                  <button
                    disabled={!micOn || lobby.busy === g.id}
                    onClick={() => lobby.decide(g.id, "mute")}
                    aria-label={micOn ? `Mute ${name}` : `${name} is muted`}
                    title={micOn ? "Mute" : "Muted"}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 disabled:text-red-400 disabled:opacity-70"
                  >
                    {micOn ? <MicIcon className="h-4 w-4" /> : <MicOffIcon className="h-4 w-4" />}
                  </button>
                  <button
                    disabled={lobby.busy === g.id}
                    onClick={() => setConfirm(confirm === g.id ? null : g.id)}
                    className="rounded-full bg-neutral-800 px-3 py-1.5 text-sm text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
                {confirm === g.id && (
                  <div className="mt-3 rounded-xl bg-red-500/10 p-3">
                    <p className="text-sm text-red-200">
                      Remove {name} from the call? They won&apos;t be able to rejoin this call.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setConfirm(null)}
                        className="flex-1 rounded-full bg-neutral-800 px-3 py-2 text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          setConfirm(null);
                          await lobby.decide(g.id, "remove");
                        }}
                        className="flex-1 rounded-full bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
