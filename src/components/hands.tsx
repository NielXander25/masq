"use client";

import { useParticipantAttribute, useRoomContext } from "@livekit/components-react";
import { RoomEvent, type Participant } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/primitives";
import { baseName } from "@/lib/alias";

export type RaisedHand = { identity: string; name: string; at: number; isLocal: boolean };

/** Raised hands in the order they went up, and your own hand. */
export function useHands(callId: string) {
  const room = useRoomContext();
  const [hands, setHands] = useState<RaisedHand[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      const everyone: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
      setHands(
        everyone
          .filter((p) => p.attributes.hand)
          .map((p) => ({
            identity: p.identity,
            name: baseName(p.name || p.identity),
            at: Number(p.attributes.hand),
            isLocal: p.isLocal,
          }))
          .sort((a, b) => a.at - b.at),
      );
    };
    read();
    const events = [RoomEvent.ParticipantAttributesChanged, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.Connected];
    events.forEach((e) => room.on(e, read));
    return () => {
      events.forEach((e) => room.off(e, read));
    };
  }, [room]);

  const send = useCallback(
    async (raised: boolean, identity?: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/calls/${callId}/hand`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raised, identity }),
        });
        if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Couldn't update the hand");
      } finally {
        setBusy(false);
      }
    },
    [callId],
  );

  const mine = hands.some((h) => h.isLocal);
  return {
    hands,
    mine,
    busy,
    error,
    toggle: () => send(!mine),
    lower: (identity: string) => send(false, identity),
  };
}
export type Hands = ReturnType<typeof useHands>;

/** ✋ on a tile while that person's hand is up. */
export function HandBadge({ participant }: { participant: Participant }) {
  const hand = useParticipantAttribute("hand", { participant });
  if (!hand) return null;
  return (
    <span className="hand-pop absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#ffd60a] text-lg shadow-lg">
      ✋
    </span>
  );
}

/** The queue, for the People sheet. The host can lower anyone's hand. */
export function RaisedHandsList({ hands, canLower }: { hands: Hands; canLower: boolean }) {
  if (hands.hands.length === 0) return null;
  return (
    <section className="mb-5">
      <h3 className="flex items-center gap-2 text-sm font-medium text-neutral-300">
        ✋ Raised hands
        <span className="rounded-full bg-[#ffd60a] px-2 text-xs font-bold text-black">{hands.hands.length}</span>
      </h3>
      <ol className="mt-2 space-y-2">
        {hands.hands.map((h, i) => (
          <li key={h.identity} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
            <span className="w-5 text-center text-sm font-bold text-neutral-400">{i + 1}</span>
            <Avatar name={h.name} size="h-9 w-9 text-sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.isLocal ? "You" : h.name}</span>
            {(canLower || h.isLocal) && (
              <button
                type="button"
                disabled={hands.busy}
                onClick={() => (h.isLocal ? hands.toggle() : hands.lower(h.identity))}
                className="rounded-full bg-white/10 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Lower
              </button>
            )}
          </li>
        ))}
      </ol>
      {hands.error && <p className="mt-2 text-sm text-red-400">{hands.error}</p>}
    </section>
  );
}
