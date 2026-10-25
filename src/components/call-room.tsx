"use client";

import "@livekit/components-styles";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { DisconnectReason, Track } from "livekit-client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LobbyPanel } from "@/components/lobby-panel";

type Props = { callId: string; isHost: boolean; alias: string };
type Phase = "connecting" | "in-call" | "left" | "ended" | "error";

export function CallRoom({ callId, isHost, alias }: Props) {
  const [conn, setConn] = useState<{ token: string; serverUrl: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [callId]);

  async function endCall() {
    if (!confirm("End the call for everyone?")) return;
    await fetch(`/api/calls/${callId}/end`, { method: "POST" });
    setPhase("ended");
  }

  function onDisconnected(reason?: DisconnectReason) {
    if (reason === DisconnectReason.ROOM_DELETED) return setPhase("ended");
    if (reason === DisconnectReason.CLIENT_INITIATED) {
      void fetch(`/api/calls/${callId}/leave`, { method: "POST" });
      return setPhase((p) => (p === "ended" ? p : "left"));
    }
    if (reason === DisconnectReason.PARTICIPANT_REMOVED) return setPhase("left");
  }

  if (phase === "ended") return <Message title="This call has ended." />;
  if (phase === "left") {
    return (
      <Message title="You left the call.">
        {isHost ? (
          <button onClick={() => location.reload()} className="underline">
            Rejoin
          </button>
        ) : null}
      </Message>
    );
  }
  if (phase === "error") return <Message title={error ?? "Something went wrong."} />;
  if (!conn) return <Message title="Connecting…" />;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{alias}</div>
          <div className="text-xs text-neutral-500">{isHost ? "You are hosting anonymously" : "Anonymous host"}</div>
        </div>
        {isHost && (
          <button
            onClick={endCall}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
          >
            End call
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <LiveKitRoom
          data-lk-theme="default"
          className="flex min-h-[50vh] flex-1 flex-col"
          token={conn.token}
          serverUrl={conn.serverUrl}
          connect
          audio
          video={!isHost}
          // The host's media only ever goes through TURN, so guests never see their IP.
          connectOptions={isHost ? { rtcConfig: { iceTransportPolicy: "relay" } } : undefined}
          onDisconnected={onDisconnected}
          onError={(e) => {
            setError(e.message);
            setPhase("error");
          }}
        >
          <Stage />
          <RoomAudioRenderer />
          <ControlBar
            controls={{ microphone: true, camera: !isHost, screenShare: !isHost, chat: false, leave: true }}
          />
        </LiveKitRoom>
        {isHost && (
          <div className="max-h-[40vh] overflow-y-auto md:max-h-none md:w-80">
            <LobbyPanel callId={callId} />
          </div>
        )}
      </div>
    </div>
  );
}

function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  return (
    <GridLayout tracks={tracks} className="min-h-0 flex-1">
      <ParticipantTile />
    </GridLayout>
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
