"use client";

import { useSpeakingParticipants } from "@livekit/components-react";
import { useEffect, useState } from "react";
import type { Lobby } from "@/components/lobby-panel";
import { Avatar } from "@/components/ui/primitives";

/**
 * iPhone "Dynamic Island" style status pill at the top of the call: the alias,
 * timer, recording dot and who's talking. It grows into a card for things
 * that need attention (a guest asking to join, a lost connection).
 */
export function DynamicIsland({
  alias,
  subtitle,
  running,
  recording,
  reconnecting,
  realVoice,
  lobby,
}: {
  alias: string;
  subtitle: string;
  running: boolean;
  recording: boolean;
  reconnecting: boolean;
  realVoice: boolean;
  /** Host only: guests waiting to be let in. */
  lobby?: Lobby;
}) {
  const [open, setOpen] = useState(false);
  const speaking = useSpeakingParticipants().filter((p) => !p.isLocal);
  // The host's name is "Alias · Title": show just the alias.
  const speaker = speaking[0] ? (speaking[0].name || "Someone").split(" · ")[0] : null;
  const waiting = lobby?.waiting[0];
  const expanded = Boolean(waiting) || reconnecting || open;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-40 flex justify-center px-3">
      <div
        className={`island pointer-events-auto overflow-hidden bg-black text-white shadow-[0_8px_30px_rgba(0,0,0,0.6)] ring-1 ring-white/10 ${
          expanded ? "w-[min(94vw,380px)] rounded-[28px]" : "w-[min(78vw,250px)] rounded-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Call details"
          className="flex h-9 w-full items-center gap-2 px-3 text-left"
        >
          {speaker ? <SpeakingBars /> : <span className={`h-2 w-2 shrink-0 rounded-full ${reconnecting ? "bg-amber-400" : "bg-green-400"}`} />}
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
            {reconnecting ? "Reconnecting…" : (speaker ?? alias)}
          </span>
          {recording && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" aria-label="Recording" />}
          {realVoice && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-label="Real voice" />}
          <CallTimer running={running} />
        </button>

        {expanded && (
          <div className="island-content px-4 pb-4 pt-1">
            {waiting && lobby ? (
              <>
                <RevealName name={waiting.name ?? waiting.email} email={waiting.email} image={waiting.image} />
                {lobby.error && <p className="mt-2 rounded-lg bg-red-500/15 px-2 py-1 text-sm text-red-300">{lobby.error}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={lobby.busy === waiting.id}
                    onClick={() => lobby.decide(waiting.id, "deny")}
                    className="flex-1 rounded-full bg-white/15 py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    Deny
                  </button>
                  <button
                    disabled={lobby.busy === waiting.id}
                    onClick={() => lobby.decide(waiting.id, "admit")}
                    className="flex-1 rounded-full bg-green-500 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    Admit
                  </button>
                </div>
                {lobby.waiting.length > 1 && (
                  <p className="mt-2 text-center text-xs text-neutral-400">+{lobby.waiting.length - 1} more waiting</p>
                )}
              </>
            ) : reconnecting ? (
              <p className="text-sm text-amber-300">Your connection dropped. Hang on, we&apos;re getting you back.</p>
            ) : (
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{alias}</div>
                <div className="text-neutral-400">{subtitle}</div>
                {recording && <div className="text-red-400">● This call is being recorded</div>}
                {realVoice && <div className="text-amber-300">● Guests hear your real voice (disguise off)</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Just the name; tap it to see who exactly (their email). */
export function RevealName({ name, email, image }: { name: string; email: string; image: string | null }) {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setShown((v) => !v)}
      aria-expanded={shown}
      className="flex w-full items-center gap-3 text-left"
    >
      <Avatar name={name} image={image} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        {shown && <span className="block truncate text-xs text-neutral-400">{email}</span>}
      </span>
      <span className={`text-neutral-500 transition ${shown ? "rotate-180" : ""}`} aria-hidden>
        ⌄
      </span>
    </button>
  );
}

function SpeakingBars() {
  return (
    <span className="flex h-3.5 shrink-0 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="speak-bar w-[3px] rounded-full bg-green-400" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

export function CallTimer({ running }: { running: boolean }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const s = Math.floor((now - start) / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  const text = h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  return <span className="shrink-0 text-[13px] font-medium tabular-nums text-neutral-300">{text}</span>;
}
