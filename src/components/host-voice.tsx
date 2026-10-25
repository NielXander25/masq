"use client";

import { useConnectionState, useRoomContext } from "@livekit/components-react";
import { ConnectionState, Track, type LocalTrackPublication } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { PRESET_LABELS, VOICE_PRESETS, isVoicePreset } from "@/lib/voice/presets";
import { useVoiceStore } from "@/lib/voice/store";

/**
 * Publishes the disguised track as the host's microphone. LiveKit is never asked
 * to open the real microphone, so the raw voice can't be published.
 */
export function HostVoicePublisher() {
  const room = useRoomContext();
  const state = useConnectionState();
  const track = useVoiceStore((s) => s.track);
  const pub = useRef<LocalTrackPublication | null>(null);
  const publishing = useRef(false);
  const [published, setPublished] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== ConnectionState.Connected || !track || publishing.current) return;
    publishing.current = true;
    room.localParticipant
      .publishTrack(track, { source: Track.Source.Microphone, name: "voice" })
      .then((p) => {
        pub.current = p;
        setPublished(true);
      })
      .catch((e: Error) => {
        publishing.current = false;
        setError(e.message);
      });
  }, [room, state, track]);

  async function toggleMute() {
    if (!pub.current) return;
    if (muted) await pub.current.unmute();
    else await pub.current.mute();
    setMuted(!muted);
  }

  return (
    <div className="flex items-center justify-center gap-3 px-2 pt-2">
      {error ? (
        <span className="text-sm text-red-400">Voice not sent: {error}</span>
      ) : (
        <button
          onClick={toggleMute}
          disabled={!published}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            muted ? "bg-red-600 text-white" : "border border-neutral-700 hover:bg-neutral-800"
          }`}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
      )}
    </div>
  );
}

export function PresetSwitcher() {
  const { preset, setPreset } = useVoiceStore();
  return (
    <select
      aria-label="Voice preset"
      value={preset}
      onChange={(e) => isVoicePreset(e.target.value) && setPreset(e.target.value)}
      className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
    >
      {VOICE_PRESETS.map((p) => (
        <option key={p} value={p}>
          {PRESET_LABELS[p]}
        </option>
      ))}
    </select>
  );
}
