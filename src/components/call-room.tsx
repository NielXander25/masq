"use client";

import "@livekit/components-styles";
import {
  ConnectionQualityIndicator,
  LiveKitRoom,
  ParticipantName,
  ParticipantTile,
  RoomAudioRenderer,
  TrackMutedIndicator,
  VideoTrack,
  isTrackReference,
  useConnectionState,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { ConnectionState, DisconnectReason, Track } from "livekit-client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { JoinRequestCard, LobbyPanel, useLobby, type Lobby } from "@/components/lobby-panel";
import { CameraRequiredGuard, MicButton, PresetSwitcher } from "@/components/mic-controls";
import { PreJoin } from "@/components/prejoin";
import { ReactionOverlay, ReactionTray, useReactions } from "@/components/reactions";
import { RejoinButton } from "@/components/rejoin-button";
import {
  CopyIcon,
  LinkIcon,
  MoreIcon,
  PeopleIcon,
  PhoneOffIcon,
  ScreenShareIcon,
  ShareIcon,
  SmileIcon,
  VideoIcon,
  VideoOffIcon,
} from "@/components/ui/icons";
import { Avatar, RoundButton, Sheet } from "@/components/ui/primitives";
import type { VoicePreset } from "@/lib/voice/presets";
import { useMicStore } from "@/lib/voice/store";

type Props = {
  callId: string;
  isHost: boolean;
  alias: string;
  /** Optional role shown to guests, e.g. "Interviewer". */
  title?: string | null;
  /** Show everyone that the call is being recorded. */
  recording?: boolean;
  /** Host only. */
  inviteUrl?: string;
  /** Host only: disguise the voice with this preset. */
  voicePreset?: VoicePreset | null;
  /** Guest only: the host requires cameras on. */
  cameraRequired?: boolean;
};
type Phase = "prejoin" | "connecting" | "in-call" | "left" | "ended" | "error";

export function CallRoom({
  callId,
  isHost,
  alias,
  title,
  recording = false,
  inviteUrl,
  voicePreset,
  cameraRequired = false,
}: Props) {
  const voiceOn = isHost && Boolean(voicePreset);
  const [phase, setPhase] = useState<Phase>("prejoin");
  const [cameraOn, setCameraOn] = useState(false);
  const [conn, setConn] = useState<{ token: string; serverUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The pre-join screen runs the mic through the processor (for "Hear myself").
  // Only a disguised host keeps it in the call; release it when leaving.
  useEffect(() => {
    useMicStore.getState().setMode(voicePreset ?? "clean");
    return () => useMicStore.getState().release();
  }, [voicePreset]);

  useEffect(() => {
    if (phase !== "connecting") return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.status === 410) return setPhase("ended");
      if (!res.ok) {
        setError(data.error ?? "Could not join the call");
        return setPhase("error");
      }
      setConn(data);
      setPhase("in-call");
    })();
    return () => {
      cancelled = true;
    };
  }, [callId, phase]);

  async function endCall() {
    await fetch(`/api/calls/${callId}/end`, { method: "POST" });
    setPhase("ended");
  }

  function onDisconnected(reason?: DisconnectReason) {
    if (reason === DisconnectReason.ROOM_DELETED) return setPhase("ended");
    if (reason === DisconnectReason.CLIENT_INITIATED) {
      void fetch(`/api/calls/${callId}/leave`, { method: "POST" }).finally(() =>
        setPhase((p) => (p === "ended" ? p : "left")),
      );
      return;
    }
    if (reason === DisconnectReason.PARTICIPANT_REMOVED) return setPhase("left");
  }

  if (phase === "prejoin") {
    return (
      <PreJoin
        alias={alias}
        title={title}
        isHost={isHost}
        disguise={voiceOn}
        cameraRequired={cameraRequired}
        onJoin={({ camera }) => {
          // Without a disguise, hand the mic to LiveKit (standard WebRTC path).
          if (!voiceOn) useMicStore.getState().release();
          setCameraOn(camera);
          setPhase("connecting");
        }}
      />
    );
  }
  if (phase === "ended") return <Message title="This call has ended." />;
  if (phase === "left") {
    return (
      <Message title="You left the call.">
        {isHost ? (
          <button
            onClick={() => location.reload()}
            className="rounded-full bg-white px-6 py-3 font-semibold text-black hover:bg-neutral-200"
          >
            Rejoin call
          </button>
        ) : (
          <RejoinButton callId={callId} />
        )}
      </Message>
    );
  }
  if (phase === "error") return <Message title={error ?? "Something went wrong."} />;
  if (!conn) return <Message title="Connecting…" spinner />;

  return (
    <LiveKitRoom
      data-lk-theme="default"
      className="bg-black"
      token={conn.token}
      serverUrl={conn.serverUrl}
      connect
      // Disguised host: LiveKit never opens the real microphone; MicButton
      // publishes the disguised track. Everyone else: LiveKit's native mic,
      // with the browser's echo cancellation and noise suppression.
      audio={voiceOn ? false : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }}
      video={!isHost && cameraOn}
      // The host's media only ever goes through TURN, so guests never see their IP.
      connectOptions={isHost ? { rtcConfig: { iceTransportPolicy: "relay" } } : undefined}
      onDisconnected={onDisconnected}
      onError={(e) => {
        setError(e.message);
        setPhase("error");
      }}
    >
      <InCall
        callId={callId}
        isHost={isHost}
        alias={alias}
        title={title}
        recording={recording}
        inviteUrl={inviteUrl}
        voiceOn={voiceOn}
        cameraRequired={cameraRequired}
        onEndForEveryone={endCall}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function InCall({
  callId,
  isHost,
  alias,
  title,
  recording,
  inviteUrl,
  voiceOn,
  cameraRequired,
  onEndForEveryone,
}: {
  callId: string;
  isHost: boolean;
  alias: string;
  title?: string | null;
  recording: boolean;
  inviteUrl?: string;
  voiceOn: boolean;
  cameraRequired: boolean;
  onEndForEveryone: () => Promise<void>;
}) {
  const room = useRoomContext();
  const state = useConnectionState();
  const { localParticipant, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const lobby = useLobby(callId, isHost);
  const [sheet, setSheet] = useState<"people" | "more" | "end" | null>(null);
  const [canScreenShare, setCanScreenShare] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const reactions = useReactions();
  useEffect(() => setCanScreenShare(Boolean(navigator.mediaDevices?.getDisplayMedia)), []);

  const subtitle = isHost
    ? `You're hosting anonymously${title ? ` as ${title}` : ""}`
    : `${title ? `${title} · ` : ""}Anonymous`;

  return (
    // Our own full-screen frame: LiveKit's room styles don't lay out children as flex.
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      {/* Stage */}
      <div className="relative min-h-0 flex-1">
        <Stage alias={alias} isHost={isHost} inviteUrl={inviteUrl} />
        <ReactionOverlay items={reactions.items} />
        {trayOpen && (
          <div className="absolute inset-x-0 bottom-3 z-40 flex justify-center px-3">
            <ReactionTray onPick={reactions.react} />
          </div>
        )}

        {/* Top bar over the video */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-base font-semibold">{alias}</span>
                {recording && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    REC
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-neutral-300">
                {subtitle}
                {isHost && !voiceOn && <span className="ml-1 text-amber-300">· Real voice (disguise off)</span>}
              </div>
            </div>
            <CallTimer running={state === ConnectionState.Connected} />
          </div>
          {state === ConnectionState.Reconnecting && (
            <p className="mt-2 inline-block rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold text-black">Reconnecting…</p>
          )}
          {cameraRequired && <div className="pointer-events-auto"><CameraRequiredGuard alias={alias} /></div>}
          {isHost && (
            <div className="pointer-events-none mt-3">
              <JoinRequestCard lobby={lobby} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls, Meet / WhatsApp style */}
      <div className="z-20 flex items-center justify-center gap-3 bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:gap-4">
        <MicButton disguise={voiceOn} callId={callId} />
        {!isHost && !cameraRequired && (
          <RoundButton
            label={isCameraEnabled ? "Turn camera off" : "Turn camera on"}
            tone={isCameraEnabled ? "default" : "off"}
            onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          >
            {isCameraEnabled ? <VideoIcon /> : <VideoOffIcon />}
          </RoundButton>
        )}
        <RoundButton
          label={trayOpen ? "Close reactions" : "Send a reaction"}
          pressed={trayOpen}
          tone={trayOpen ? "light" : "default"}
          onClick={() => setTrayOpen((o) => !o)}
        >
          <SmileIcon />
        </RoundButton>
        {isHost && (
          <RoundButton label="People" onClick={() => setSheet("people")} badge={lobby.waiting.length}>
            <PeopleIcon />
          </RoundButton>
        )}
        {(isHost || canScreenShare) && (
          <RoundButton label="More options" onClick={() => setSheet("more")}>
            <MoreIcon />
          </RoundButton>
        )}
        <button
          onClick={() => (isHost ? setSheet("end") : room.disconnect())}
          aria-label={isHost ? "Hang up" : "Leave call"}
          title={isHost ? "Hang up" : "Leave call"}
          className="flex h-12 w-16 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500 sm:h-14 sm:w-20"
        >
          <PhoneOffIcon />
        </button>
      </div>

      <Sheet open={sheet === "people"} onClose={() => setSheet(null)} title="People">
        {inviteUrl && <InviteLink url={inviteUrl} alias={alias} />}
        <div className="mt-5">
          <LobbyPanel lobby={lobby} />
        </div>
      </Sheet>

      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} title="More">
        <div className="space-y-4">
          {isHost && voiceOn && (
            <div className="flex items-center justify-between gap-3">
              <span>Voice preset</span>
              <PresetSwitcher />
            </div>
          )}
          {isHost && inviteUrl && <InviteLink url={inviteUrl} alias={alias} />}
          {!isHost && canScreenShare && (
            <button
              onClick={() => {
                void localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
                setSheet(null);
              }}
              className="flex w-full items-center gap-3 rounded-2xl bg-neutral-800 px-4 py-3"
            >
              <ScreenShareIcon className="h-5 w-5" />
              {isScreenShareEnabled ? "Stop sharing screen" : "Share screen"}
            </button>
          )}
        </div>
      </Sheet>

      <Sheet open={sheet === "end"} onClose={() => setSheet(null)} title="Leave the call?">
        <div className="space-y-2">
          <button
            onClick={async () => {
              setSheet(null);
              await onEndForEveryone();
            }}
            className="w-full rounded-full bg-red-600 px-4 py-3.5 font-semibold text-white hover:bg-red-500"
          >
            End call for everyone
          </button>
          <button
            onClick={() => room.disconnect()}
            className="w-full rounded-full bg-neutral-800 px-4 py-3.5 font-semibold hover:bg-neutral-700"
          >
            Just leave (you can rejoin)
          </button>
          <button onClick={() => setSheet(null)} className="w-full py-2 text-sm text-neutral-400">
            Cancel
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * WhatsApp-style layout: alone, you fill the screen; with one other person,
 * they fill it and you're a small picture-in-picture; with more, a grid.
 */
function Stage({ alias, isHost, inviteUrl }: { alias: string; isHost: boolean; inviteUrl?: string }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const local = tracks.filter((t) => t.participant.isLocal && t.source === Track.Source.Camera);
  const others = tracks.filter((t) => !(t.participant.isLocal && t.source === Track.Source.Camera));
  const key = (t: TrackReferenceOrPlaceholder) => `${t.participant.identity}:${t.source}`;

  if (others.length === 0) {
    return (
      <div className="absolute inset-0">
        {local[0] && <CallTile trackRef={local[0]} className="h-full w-full" />}
        <div className="absolute inset-x-4 bottom-6 z-10 mx-auto max-w-sm rounded-3xl bg-neutral-900/90 p-4 text-center shadow-xl ring-1 ring-white/10 backdrop-blur">
          <p className="font-medium">Waiting for others to join</p>
          {isHost && inviteUrl ? (
            <div className="mt-3">
              <InviteLink url={inviteUrl} alias={alias} compact />
            </div>
          ) : (
            <p className="mt-1 text-sm text-neutral-400">{alias} will be here soon.</p>
          )}
        </div>
      </div>
    );
  }

  if (others.length === 1) {
    return (
      <div className="absolute inset-0">
        <CallTile trackRef={others[0]} className="h-full w-full" />
        {local[0] && (
          <div className="absolute bottom-4 right-4 z-10 aspect-[3/4] w-28 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20 sm:w-40">
            <CallTile trackRef={local[0]} className="h-full w-full" small />
          </div>
        )}
      </div>
    );
  }

  const all = [...others, ...local];
  const cols = all.length <= 4 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3";
  return (
    <div className={`absolute inset-0 grid auto-rows-fr gap-1.5 overflow-y-auto p-1.5 pt-20 ${cols}`}>
      {all.map((t) => (
        <CallTile key={key(t)} trackRef={t} className="min-h-[160px] rounded-2xl" />
      ))}
    </div>
  );
}

/** A participant: their video, or a big avatar; the mic state is always shown. */
function CallTile({
  trackRef,
  className = "",
  small = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  className?: string;
  small?: boolean;
}) {
  const isCamera = trackRef.source === Track.Source.Camera;
  const name = trackRef.participant.name || trackRef.participant.identity;
  // "Night Owl · Interviewer" -> avatar from "Night Owl", matching the waiting room.
  const avatarName = name.split(" · ")[0];
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  return (
    <ParticipantTile trackRef={trackRef} className={`!rounded-none bg-neutral-900 ${className}`}>
      {isTrackReference(trackRef) && <VideoTrack trackRef={trackRef} className="!object-cover" />}
      {!hasVideo && (
        <div className="lk-participant-placeholder !bg-neutral-900">
          <Avatar name={avatarName} size={small ? "h-12 w-12 text-lg" : "h-28 w-28 text-4xl"} />
        </div>
      )}
      <div className="lk-participant-metadata">
        <div className="lk-participant-metadata-item">
          {isCamera ? (
            <>
              <TrackMutedIndicator
                trackRef={{ participant: trackRef.participant, source: Track.Source.Microphone }}
                show="always"
              />
              <ParticipantName />
            </>
          ) : (
            <ParticipantName>&apos;s screen</ParticipantName>
          )}
        </div>
        {!small && <ConnectionQualityIndicator className="lk-participant-metadata-item" />}
      </div>
    </ParticipantTile>
  );
}

function InviteLink({ url, alias, compact = false }: { url: string; alias: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-2">
      {!compact && <p className="text-xs text-neutral-400">Invite link</p>}
      <div className="flex items-center gap-2 rounded-2xl bg-neutral-950 px-3 py-2.5">
        <LinkIcon className="h-4 w-4 shrink-0 text-neutral-500" />
        <code className="min-w-0 flex-1 truncate text-left text-sm">{url.replace(/^https?:\/\//, "")}</code>
        <button onClick={copy} aria-label="Copy invite link" className="shrink-0 text-green-400">
          {copied ? <span className="text-xs">Copied</span> : <CopyIcon className="h-5 w-5" />}
        </button>
      </div>
      {canShare && (
        <button
          onClick={() => navigator.share({ title: `Join ${alias} on masqq`, url }).catch(() => {})}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-green-500 px-4 py-2.5 font-semibold text-black"
        >
          <ShareIcon className="h-5 w-5" /> Share invite
        </button>
      )}
    </div>
  );
}

function CallTimer({ running }: { running: boolean }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const s = Math.floor((now - start) / 1000);
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return <span className="shrink-0 font-mono text-sm tabular-nums text-neutral-300">{text}</span>;
}

function Message({ title, children, spinner }: { title: string; children?: React.ReactNode; spinner?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      {spinner && <span className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-700 border-t-white" />}
      <p className="text-xl font-medium">{title}</p>
      {children}
      <Link href="/dashboard" className="text-sm text-neutral-400 underline">
        Back to home
      </Link>
    </main>
  );
}

export type { Lobby };
