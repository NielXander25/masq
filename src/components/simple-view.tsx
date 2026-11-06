"use client";

import { useLocalParticipant, useParticipants, useSpeakingParticipants } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { useEffect, useState } from "react";
import { toggleMic } from "@/components/mic-controls";
import { ReactionTray, type REACTIONS } from "@/components/reactions";
import type { Hands } from "@/components/hands";
import { ChatIcon, CloseIcon, HandIcon, MicIcon, MicOffIcon, PeopleIcon, PhoneOffIcon, SmileIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/primitives";
import { baseName } from "@/lib/alias";

/**
 * Simple view, like Meet's "On-the-Go": who's talking in big, and a few big
 * buttons. Buttons change shape with their state: rounder when on, squarer
 * when off or open.
 */
export function SimpleView({
  title,
  recording,
  disguise,
  unread,
  hands,
  onReact,
  onMessages,
  onPeople,
  onHangUp,
  onExit,
}: {
  title: string;
  recording: boolean;
  disguise: boolean;
  unread: number;
  hands: Hands;
  onReact: (emoji: (typeof REACTIONS)[number]) => void;
  onMessages: () => void;
  /** Host only: open People (to see and lower raised hands). */
  onPeople?: () => void;
  onHangUp: () => void;
  onExit: () => void;
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const speaker = useCurrentSpeaker();
  const [tray, setTray] = useState(false);
  const muted = !isMicrophoneEnabled;
  const name = speaker ? baseName(speaker.name || speaker.identity) : "";
  const talking = speaker?.isSpeaking ?? false;

  return (
    <div className="simple-view fixed inset-0 z-[45] flex flex-col overflow-hidden bg-[#0b0b0f] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] bg-[radial-gradient(ellipse_at_top,rgba(129,140,248,0.16),transparent_65%)]" />

      {/* Leaving simple view is one tap. */}
      <button
        type="button"
        onClick={onExit}
        className="glass flex h-12 w-full shrink-0 items-center rounded-full px-2 text-[15px] font-semibold text-[#ff9f0a]"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-neutral-200">
          <CloseIcon className="h-4 w-4" />
        </span>
        <span className="flex-1 pr-9 text-center">Turn off simple view</span>
      </button>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 py-4 text-center">
        <h1 className="max-w-full truncate text-[30px] font-semibold leading-tight tracking-tight">{title}</h1>
        <p className="flex items-center gap-2 text-[15px] text-neutral-400">
          {recording && <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-label="Recording" />}
          {participants.length} {participants.length === 1 ? "person" : "people"}
        </p>
        {hands.hands.length > 0 && (
          <button
            type="button"
            onClick={onPeople}
            disabled={!onPeople}
            className="hand-pop mt-3 flex max-w-full items-center gap-2 rounded-full bg-[#ffd60a] px-4 py-2 text-[15px] font-semibold text-black"
          >
            <span>✋</span>
            <span className="truncate">
              {hands.hands[0]!.isLocal ? "You" : hands.hands[0]!.name}
              {hands.hands.length > 1 ? ` +${hands.hands.length - 1}` : ""} raised {hands.hands.length > 1 ? "hands" : "a hand"}
            </span>
          </button>
        )}

        {speaker && (
          <div className="mt-6 flex flex-col items-center">
            <div className={`speaker-ring flex items-center justify-center rounded-full p-4 ${talking ? "is-talking" : ""}`}>
              <div className={`rounded-full p-1 transition ${talking ? "bg-[#ffd60a]" : "bg-transparent"}`}>
                <Avatar name={name} size="h-36 w-36 text-6xl" />
              </div>
            </div>
            <p className="mt-4 max-w-[80vw] truncate text-[22px] font-medium">{speaker.isLocal ? "You" : name}</p>
          </div>
        )}
      </div>

      <div className="relative shrink-0 space-y-3">
        {tray && (
          <div className="absolute inset-x-0 -top-16 flex justify-center">
            <ReactionTray onPick={onReact} />
          </div>
        )}
        <button
          type="button"
          onClick={() => void toggleMic(localParticipant, disguise)}
          aria-pressed={muted}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          className={`morph flex h-36 w-full flex-col items-center justify-center gap-2 text-[17px] font-semibold ${
            muted ? "rounded-[26px] bg-[#ffd9d5] text-[#7a1a12]" : "rounded-[72px] bg-white/[0.12] text-white"
          }`}
        >
          {muted ? <MicOffIcon className="h-8 w-8" /> : <MicIcon className="h-8 w-8" />}
          {muted ? "Unmute" : "Mute"}
        </button>
        <div className={`grid gap-3 ${onPeople ? "grid-cols-4" : "grid-cols-3"}`}>
          {onPeople && (
            <button
              type="button"
              onClick={onPeople}
              aria-label="People"
              className="morph flex h-28 flex-col items-center justify-center gap-1.5 rounded-[48px] bg-white/[0.12] text-[15px] font-semibold"
            >
              <PeopleIcon className="h-7 w-7" />
              People
            </button>
          )}
          <button
            type="button"
            onClick={hands.toggle}
            disabled={hands.busy}
            aria-pressed={hands.mine}
            aria-label={hands.mine ? "Lower hand" : "Raise hand"}
            className={`morph flex h-28 flex-col items-center justify-center gap-1.5 text-[15px] font-semibold ${
              hands.mine ? "rounded-[24px] bg-[#ffd60a] text-black" : "rounded-[48px] bg-white/[0.12]"
            }`}
          >
            <HandIcon className="h-7 w-7" />
            {hands.mine ? "Lower" : "Raise"}
          </button>
          <button
            type="button"
            onClick={() => setTray((t) => !t)}
            aria-pressed={tray}
            aria-label={tray ? "Close reactions" : "Send a reaction"}
            className={`morph flex h-28 flex-col items-center justify-center gap-1.5 text-[15px] font-semibold ${
              tray ? "rounded-[24px] bg-[#f2e3c4] text-[#3d2c0b]" : "rounded-[48px] bg-white/[0.12]"
            }`}
          >
            <SmileIcon className="h-7 w-7" />
            React
          </button>
          <button
            type="button"
            onClick={onMessages}
            aria-label="Messages"
            className="morph relative flex h-28 flex-col items-center justify-center gap-1.5 rounded-[48px] bg-white/[0.12] text-[15px] font-semibold"
          >
            <ChatIcon className="h-7 w-7" />
            Messages
            {unread > 0 && (
              <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#ff3b30] px-1.5 text-xs font-bold">
                {unread}
              </span>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={onHangUp}
          aria-label="Hang up"
          className="flex h-14 w-full items-center justify-center rounded-full bg-[#ff3b30] text-white shadow-[0_8px_24px_rgba(255,59,48,0.4)] transition active:scale-[0.98]"
        >
          <PhoneOffIcon />
        </button>
      </div>
    </div>
  );
}

/** Whoever is talking now; else whoever talked last; else the first other person. */
function useCurrentSpeaker(): Participant | undefined {
  const speaking = useSpeakingParticipants();
  const participants = useParticipants();
  const [last, setLast] = useState<string | null>(null);
  const now = speaking.find((p) => !p.isLocal) ?? speaking[0];
  useEffect(() => {
    if (now) setLast(now.identity);
  }, [now]);
  return (
    now ??
    participants.find((p) => p.identity === last) ??
    participants.find((p) => !p.isLocal) ??
    participants[0]
  );
}
