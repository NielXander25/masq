"use client";

import { useDataChannel } from "@livekit/components-react";
import { useCallback, useRef, useState } from "react";

// Only these can be sent or shown, so a reaction can never carry other text.
export const REACTIONS = ["👍", "❤️", "😂", "😮", "👏", "🎉", "🙏", "😢"] as const;
type Emoji = (typeof REACTIONS)[number];

const TOPIC = "reactions";
const LIFETIME_MS = 3200;
const MAX_ON_SCREEN = 30;

type Floating = { id: number; emoji: Emoji; name: string; x: number; drift: number };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Send and receive emoji reactions over the LiveKit data channel. */
export function useReactions() {
  const [items, setItems] = useState<Floating[]>([]);
  const nextId = useRef(0);
  const lastFrom = useRef(new Map<string, number>());

  const show = useCallback((emoji: Emoji, name: string) => {
    const id = nextId.current++;
    const item = { id, emoji, name, x: 8 + Math.random() * 30, drift: (Math.random() - 0.5) * 60 };
    setItems((prev) => [...prev.slice(-(MAX_ON_SCREEN - 1)), item]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), LIFETIME_MS);
  }, []);

  const { send } = useDataChannel(TOPIC, (msg) => {
    let emoji: unknown;
    try {
      emoji = JSON.parse(decoder.decode(msg.payload)).e;
    } catch {
      return;
    }
    if (!REACTIONS.includes(emoji as Emoji)) return;
    // Light flood control: at most ~4 per second from one person.
    const who = msg.from?.identity ?? "?";
    const now = Date.now();
    if (now - (lastFrom.current.get(who) ?? 0) < 250) return;
    lastFrom.current.set(who, now);
    // The host's name is their alias (plus title), never their account.
    show(emoji as Emoji, (msg.from?.name || "Someone").split(" · ")[0]!);
  });

  const react = useCallback(
    (emoji: Emoji) => {
      show(emoji, "You");
      void send(encoder.encode(JSON.stringify({ e: emoji })), { reliable: true, topic: TOPIC }).catch(() => {});
    },
    [send, show],
  );

  return { items, react };
}

/** Emojis floating up from the bottom-left of the stage, Meet style. */
export function ReactionOverlay({ items }: { items: Floating[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-live="polite">
      {items.map((r) => (
        <div
          key={r.id}
          className="reaction-float absolute bottom-24 flex flex-col items-center"
          style={{ left: `${r.x}%`, ["--drift" as string]: `${r.drift}px` }}
        >
          <span className="text-5xl drop-shadow-lg">{r.emoji}</span>
          <span className="mt-1 max-w-[8rem] truncate rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
            {r.name}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The emoji tray that pops up above the call controls. */
export function ReactionTray({ onPick }: { onPick: (e: Emoji) => void }) {
  return (
    <div
      role="toolbar"
      aria-label="Send a reaction"
      className="flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-neutral-900/95 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur"
    >
      {REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          aria-label={`React ${e}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[26px] transition hover:bg-white/10 active:scale-125"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
