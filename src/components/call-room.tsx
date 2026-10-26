"use client";

import "@livekit/components-styles";
import {
  ConnectionQualityIndicator,
  ControlBar,
  LiveKitRoom,
  ParticipantName,
  ParticipantPlaceholder,
  ParticipantTile,
  RoomAudioRenderer,
  ScreenShareIcon,
  TrackMutedIndicator,
  VideoTrack,
  isTrackReference,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { DisconnectReason, Track } from "livekit-client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ShareButton } from "@/components/copy-button";
import { LobbyPanel } from "@/components/lobby-panel";
import { CameraRequiredGuard, MicButton, PresetSwitcher } from "@/components/mic-controls";
import { PreJoin } from "@/components/prejoin";
import { RejoinButton } from "@/components/rejoin-button";
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
    if (!confirm("End the call for everyone?")) return;
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
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
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
  if (!conn) return <Message title="Connecting…" />;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{alias}</span>
            {recording && (
              <span className="flex shrink-0 items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-xs font-medium text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                Recording
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            {isHost
              ? `You're hosting anonymously${title ? ` as ${title}` : ""}`
              : `${title ? `${title} · ` : ""}Anonymous`}
            {isHost && !voiceOn && <span className="ml-2 text-amber-300">· Real voice (disguise off)</span>}
          </div>
        </div>
        {isHost && (
          <div className="flex items-center gap-2">
            {voiceOn && <PresetSwitcher />}
            <button
              onClick={endCall}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
            >
              End call
            </button>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <LiveKitRoom
          data-lk-theme="default"
          className="flex min-h-[50vh] flex-1 flex-col"
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
          {cameraRequired && <CameraRequiredGuard alias={alias} />}
          <Stage />
          <RoomAudioRenderer />
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-neutral-800 p-2">
            <MicButton disguise={voiceOn} />
            <ControlBar
              className="!border-0 !p-0"
              controls={{
                microphone: false,
                camera: !isHost && !cameraRequired,
                screenShare: !isHost,
                chat: false,
                leave: true,
              }}
            />
          </div>
        </LiveKitRoom>
        {isHost && (
          <div className="max-h-[40vh] overflow-y-auto border-t border-neutral-800 md:max-h-none md:w-80 md:border-t-0">
            {inviteUrl && <InviteLink url={inviteUrl} />}
            <LobbyPanel callId={callId} />
          </div>
        )}
      </div>
    </div>
  );
}

function InviteLink({ url }: { url: string }) {
  return (
    <div className="border-b border-neutral-800 p-4 md:border-l">
      <div className="text-xs text-neutral-500">Invite link</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <code className="truncate text-sm">{url.replace(/^https?:\/\//, "")}</code>
        <ShareButton url={url} label="Share" />
      </div>
    </div>
  );
}

/** Every participant on screen at once (no paging), stacked on narrow screens. */
function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const n = tracks.length;
  const cols =
    n <= 1
      ? "grid-cols-1"
      : n === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : n <= 4
          ? "grid-cols-2"
          : "grid-cols-2 md:grid-cols-3";
  return (
    <div className={`grid min-h-0 flex-1 auto-rows-fr gap-2 overflow-y-auto p-2 ${cols}`}>
      {tracks.map((t) => (
        <CallTile key={`${t.participant.identity}:${t.source}`} trackRef={t} />
      ))}
    </div>
  );
}

/** LiveKit's tile, but the mic icon is always shown: on, or red when muted. */
function CallTile({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const isCamera = trackRef.source === Track.Source.Camera;
  return (
    <ParticipantTile trackRef={trackRef} className="min-h-[140px]">
      {isTrackReference(trackRef) && <VideoTrack trackRef={trackRef} />}
      <div className="lk-participant-placeholder">
        <ParticipantPlaceholder />
      </div>
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
            <>
              <ScreenShareIcon style={{ marginRight: "0.25rem" }} />
              <ParticipantName>&apos;s screen</ParticipantName>
            </>
          )}
        </div>
        <ConnectionQualityIndicator className="lk-participant-metadata-item" />
      </div>
    </ParticipantTile>
  );
}

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg">{title}</p>
      {children}
      <Link href="/dashboard" className="text-sm text-neutral-400 underline">
        Back to dashboard
      </Link>
    </main>
  );
}
