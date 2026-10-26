"use client";

import { useConnectionState, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState, Track, type LocalTrackPublication } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { PRESET_LABELS, VOICE_PRESETS, isVoicePreset } from "@/lib/voice/presets";
import { useMicStore } from "@/lib/voice/store";

/**
 * Mute button. With `disguise`, it also publishes the disguised track itself so
 * LiveKit is never asked to open the raw microphone. Otherwise LiveKit captures
 * the mic natively (best echo cancellation) and this just toggles it.
 */
export function MicButton({ disguise, callId }: { disguise: boolean; callId: string }) {
  return disguise ? <DisguisedMicButton callId={callId} /> : <NativeMicButton />;
}

function NativeMicButton() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const state = useConnectionState();
  const [busy, setBusy] = useState(false);
  const muted = !isMicrophoneEnabled;
  return (
    <MuteToggle
      muted={muted}
      disabled={busy || state !== ConnectionState.Connected}
      onToggle={async () => {
        setBusy(true);
        try {
          await localParticipant.setMicrophoneEnabled(muted);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function DisguisedMicButton({ callId }: { callId: string }) {
  const room = useRoomContext();
  const state = useConnectionState();
  const track = useMicStore((s) => s.track);
  const pub = useRef<LocalTrackPublication | null>(null);
  const publishing = useRef(false);
  const [published, setPublished] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== ConnectionState.Connected || !track || publishing.current) return;
    publishing.current = true;
    room.localParticipant
      .publishTrack(track, { source: Track.Source.Microphone, name: "microphone" })
      .then((p) => {
        const t = p.track;
        if (t) {
          t.restartTrack = async () => {};
          t.setDeviceId = async () => true;
        }
        pub.current = p;
        setPublished(true);
      })
      .catch((e: Error) => {
        publishing.current = false;
        setError(e.message);
      });
  }, [room, state, track]);

  async function toggle() {
    // A tap: also wake the audio engine if the browser paused it.
    void useMicStore.getState().processor?.resume?.();
    const p = pub.current;
    if (!p) return;
    if (p.isMuted) await p.unmute();
    else await p.mute();
    setMuted(p.isMuted);
  }

  if (error) return <span className="text-sm text-red-400">Microphone not sent: {error}</span>;

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <MuteToggle muted={muted} disabled={!published} onToggle={toggle} />
      <VoiceHealthNotice muted={muted} callId={callId} />
    </span>
  );
}

/**
 * The disguise runs in the browser's audio engine. Phones can suspend it, or it
 * can fail on a device; say so instead of leaving the host silently unheard.
 */
function VoiceHealthNotice({ muted, callId }: { muted: boolean; callId: string }) {
  const processor = useMicStore((s) => s.processor);

  // Diagnostics: report the audio engine's state a few times so problems on a
  // particular phone show up in the server logs.
  useEffect(() => {
    if (!processor?.health) return;
    let n = 0;
    const send = () => {
      const h = processor.health!();
      void fetch("/api/diag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId,
          event: "voice-health",
          data: {
            n,
            state: h.state,
            inLevel: h.inLevel === null ? null : +h.inLevel.toFixed(4),
            outLevel: h.outLevel === null ? null : +h.outLevel.toFixed(4),
            sampleRate: h.sampleRate,
            trackState: h.trackState,
            muted,
            ua: navigator.userAgent.slice(0, 200),
          },
        }),
        keepalive: true,
      }).catch(() => {});
      n++;
    };
    const first = setTimeout(send, 3000);
    const timer = setInterval(() => n < 12 && send(), 10000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [processor, callId, muted]);
  const [suspended, setSuspended] = useState(false);
  const [silentFor, setSilentFor] = useState(0);

  useEffect(() => {
    if (!processor?.health) return;
    const timer = setInterval(() => {
      const h = processor.health!();
      setSuspended(h.state !== "running");
      // Mic hears something but the disguise outputs nothing.
      const silent = h.inLevel !== null && h.outLevel !== null && h.inLevel > 0.003 && h.outLevel < 0.0003;
      setSilentFor((n) => (silent ? n + 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [processor]);

  if (suspended) {
    return (
      <button
        onClick={() => processor?.resume?.()}
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-black"
      >
        Tap to turn your voice back on
      </button>
    );
  }
  if (!muted && silentFor >= 4) {
    return (
      <span className="max-w-xs text-center text-xs text-amber-300">
        Your disguised voice isn&apos;t coming through on this device. Try leaving and rejoining, or use Chrome on
        another phone or a computer.
      </span>
    );
  }
  return null;
}

function MuteToggle({ muted, disabled, onToggle }: { muted: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={muted}
      aria-label={muted ? "Unmute microphone" : "Mute microphone"}
      className={`lk-button flex items-center gap-2 ${muted ? "!bg-red-600 !text-white" : ""}`}
    >
      {muted ? <MicOffIcon /> : <MicIcon />}
      <span>{muted ? "Unmute" : "Mute"}</span>
    </button>
  );
}

/** If the host requires cameras, nag a guest whose camera goes off. */
export function CameraRequiredGuard({ alias }: { alias: string }) {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  const state = useConnectionState();
  const [busy, setBusy] = useState(false);
  if (state !== ConnectionState.Connected || isCameraEnabled) return null;
  return (
    <div className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-lg bg-amber-950 px-3 py-2 text-sm text-amber-200">
      <span>{alias} requires your camera to be on.</span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await localParticipant.setCameraEnabled(true);
          } finally {
            setBusy(false);
          }
        }}
        className="rounded bg-amber-200 px-2 py-1 font-medium text-black"
      >
        Turn on
      </button>
    </div>
  );
}

export function PresetSwitcher() {
  const { mode, setMode } = useMicStore();
  return (
    <select
      aria-label="Voice preset"
      value={mode}
      onChange={(e) => isVoicePreset(e.target.value) && setMode(e.target.value)}
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

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5" strokeLinecap="round" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 9v1a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7" />
      <path d="M5 10a7 7 0 0 0 11.4 5.4M19 10a7 7 0 0 1-.6 2.8M12 17v5M3 3l18 18" strokeLinecap="round" />
    </svg>
  );
}
