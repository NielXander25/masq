"use client";

import "@livekit/components-styles";
import {
  ConnectionQualityIndicator,
  LiveKitRoom,
  ParticipantName,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
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
import { ChatPanel, ChatPopups, useChat } from "@/components/chat";
import { DynamicIsland } from "@/components/dynamic-island";
import { LobbyPanel, useLobby, type Lobby } from "@/components/lobby-panel";
import { CameraRequiredGuard, MicButton, PresetSwitcher } from "@/components/mic-controls";
import { PreJoin } from "@/components/prejoin";
import { ReactionOverlay, ReactionTray, useReactions } from "@/components/reactions";
import { RejoinButton } from "@/components/rejoin-button";
import { ScriptEditor, ScriptOverlay, useScript } from "@/components/script-prompter";
import {
  ChatIcon,
  CopyIcon,
  LinkIcon,
  MoreIcon,
  PeopleIcon,
  PhoneOffIcon,
  ScreenShareIcon,
  ScriptIcon,
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
type Phase = "prejoin" | "connecting" | "in-call" | "left" | "removed" | "ended" | "error";

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
  // Guests go straight in once admitted (mic on, camera on only if required);
  // only the host gets a set-up screen, to check the disguised voice.
  const [phase, setPhase] = useState<Phase>(isHost ? "prejoin" : "connecting");
  const [cameraOn, setCameraOn] = useState(!isHost && cameraRequired);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);
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
    if (reason === DisconnectReason.PARTICIPANT_REMOVED) return setPhase(isHost ? "left" : "removed");
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
  if (phase === "removed") return <Message title="The host removed you from the call." />;
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
      // A blocked mic or camera shouldn't end the call: say so and carry on.
      onMediaDeviceFailure={(_failure, kind) =>
        setDeviceNotice(
          kind === "videoinput"
            ? "Your camera is blocked. Allow it in your browser settings to turn it on."
            : "Your microphone is blocked. Allow it in your browser settings so others can hear you.",
        )
      }
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
      {/* Only shows if the browser blocked sound until a tap. */}
      <StartAudio
        label="Tap to hear the call"
        className="!fixed !inset-x-6 !top-1/3 !z-50 !mx-auto !max-w-xs !rounded-full !bg-white !px-6 !py-4 !text-base !font-semibold !text-black !shadow-2xl"
      />
      {deviceNotice && (
        <button
          onClick={() => setDeviceNotice(null)}
          className="glass fixed inset-x-4 top-24 z-50 mx-auto max-w-sm rounded-2xl px-4 py-3 text-left text-sm text-amber-200"
        >
          {deviceNotice}
        </button>
      )}
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
  const [sheet, setSheet] = useState<"people" | "more" | "end" | "chat" | "script" | null>(null);
  const [canScreenShare, setCanScreenShare] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const reactions = useReactions();
  const chat = useChat(callId, sheet === "chat");
  const script = useScript();
  useEffect(() => setCanScreenShare(Boolean(navigator.mediaDevices?.getDisplayMedia)), []);

  const subtitle = isHost
    ? `You're hosting anonymously${title ? ` as ${title}` : ""}`
    : `${title ? `${title} · ` : ""}Anonymous`;

  return (
    // Our own full-screen frame: LiveKit's room styles don't lay out children as flex.
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      {/* The stage fills the screen; the island and dock float over it. */}
      <Stage alias={alias} isHost={isHost} inviteUrl={inviteUrl} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-black/60 to-transparent" />
      <ReactionOverlay items={reactions.items} />
      <ChatPopups chat={chat} onOpen={() => setSheet("chat")} />
      <ScriptOverlay script={script} onEdit={() => setSheet("script")} />

      <DynamicIsland
        alias={alias}
        subtitle={subtitle}
        running={state === ConnectionState.Connected}
        recording={recording}
        reconnecting={state === ConnectionState.Reconnecting}
        realVoice={isHost && !voiceOn}
        lobby={isHost ? lobby : undefined}
      />
      {cameraRequired && (
        <div className="absolute inset-x-0 top-16 z-30 px-3">
          <CameraRequiredGuard alias={alias} />
        </div>
      )}

      {/* Floating glass dock */}
      <div className="absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2.5 px-2">
        {trayOpen && <ReactionTray onPick={reactions.react} />}
        <div className="glass flex items-center gap-2 rounded-[34px] p-2 min-[400px]:gap-2.5 sm:gap-3 sm:p-2.5">
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
          <RoundButton label="Messages" onClick={() => setSheet("chat")} badge={chat.unread}>
            <ChatIcon />
          </RoundButton>
          {isHost && (
            <RoundButton label="People" onClick={() => setSheet("people")} badge={lobby.waiting.length}>
              <PeopleIcon />
            </RoundButton>
          )}
          <RoundButton label="More options" onClick={() => setSheet("more")}>
            <MoreIcon />
          </RoundButton>
          <button
            onClick={() => (isHost ? setSheet("end") : room.disconnect())}
            aria-label={isHost ? "Hang up" : "Leave call"}
            title={isHost ? "Hang up" : "Leave call"}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ff3b30] text-white shadow-[0_6px_20px_rgba(255,59,48,0.45)] transition active:scale-95 sm:h-14 sm:w-14"
          >
            <PhoneOffIcon />
          </button>
        </div>
      </div>

      <Sheet open={sheet === "chat"} onClose={() => setSheet(null)} title="Messages">
        <ChatPanel chat={chat} />
      </Sheet>

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
          <button
            onClick={() => setSheet("script")}
            className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5 text-left"
          >
            <ScriptIcon className="h-5 w-5" />
            <span className="flex-1">
              <span className="block font-medium">Script</span>
              <span className="block text-xs text-neutral-400">
                {script.text ? "Read it on screen · only you can see it" : "Read from your notes · only you can see it"}
              </span>
            </span>
          </button>
          {isHost && inviteUrl && <InviteLink url={inviteUrl} alias={alias} />}
          {!isHost && canScreenShare && (
            <button
              onClick={() => {
                void localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
                setSheet(null);
              }}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5"
            >
              <ScreenShareIcon className="h-5 w-5" />
              {isScreenShareEnabled ? "Stop sharing screen" : "Share screen"}
            </button>
          )}
        </div>
      </Sheet>

      <Sheet open={sheet === "script"} onClose={() => setSheet(null)} title="Script">
        <ScriptEditor script={script} onRead={() => setSheet(null)} />
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
            className="w-full rounded-full bg-white/10 px-4 py-3.5 font-semibold hover:bg-white/15"
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
        {local[0] && <CallTile trackRef={local[0]} className="call-tile-full h-full w-full" />}
        <div className="glass absolute inset-x-4 bottom-32 z-20 mx-auto max-w-sm rounded-[28px] p-4 text-center">
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
        <CallTile trackRef={others[0]} className="call-tile-full h-full w-full" />
        {local[0] && (
          <div className="absolute bottom-32 right-3 z-20 aspect-[3/4] w-28 overflow-hidden rounded-[22px] shadow-[0_12px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/20 sm:w-40">
            <CallTile trackRef={local[0]} className="h-full w-full" small />
          </div>
        )}
      </div>
    );
  }

  const all = [...others, ...local];
  // Up to 6: two columns that fill the screen. Bigger calls: three columns on
  // phones (more on wider screens) with a minimum tile height, scrolling if needed.
  const n = all.length;
  const compact = n > 6;
  const cols = n <= 6 ? "grid-cols-2" : n <= 12 ? "grid-cols-3 lg:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5";
  const minRow = n <= 4 ? "auto-rows-[minmax(160px,1fr)]" : n <= 6 ? "auto-rows-[minmax(140px,1fr)]" : "auto-rows-[minmax(118px,1fr)]";
  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain px-2 pb-28 pt-14 sm:pb-32">
      <div className={`grid min-h-full gap-2 ${cols} ${minRow}`}>
        {all.map((t) => (
          <CallTile key={key(t)} trackRef={t} className="overflow-hidden !rounded-[22px]" compact={compact} />
        ))}
      </div>
    </div>
  );
}

/** A participant: their video, or a big avatar; the mic state is always shown. */
function CallTile({
  trackRef,
  className = "",
  small = false,
  compact = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  className?: string;
  small?: boolean;
  /** Many people on screen: smaller avatar, name stays readable. */
  compact?: boolean;
}) {
  const isCamera = trackRef.source === Track.Source.Camera;
  const name = trackRef.participant.name || trackRef.participant.identity;
  // "Night Owl · Interviewer" -> avatar from "Night Owl", matching the waiting room.
  const avatarName = name.split(" · ")[0];
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  return (
    <ParticipantTile
      trackRef={trackRef}
      className={`!rounded-none bg-neutral-900 ${compact ? "call-tile-compact" : ""} ${className}`}
    >
      {isTrackReference(trackRef) && <VideoTrack trackRef={trackRef} className="!object-cover" />}
      {!hasVideo && (
        <div className="lk-participant-placeholder !bg-neutral-900">
          <Avatar
            name={avatarName}
            size={small || compact ? "h-12 w-12 text-lg" : "h-28 w-28 text-4xl"}
          />
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
        {!small && !compact && <ConnectionQualityIndicator className="lk-participant-metadata-item" />}
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
