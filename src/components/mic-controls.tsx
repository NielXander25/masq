"use client";

import { useConnectionState, useLocalParticipant, useRoomContext, useTrackVolume } from "@livekit/components-react";
import { ConnectionState, Track, type LocalAudioTrack, type LocalTrackPublication } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { MicIcon, MicOffIcon } from "@/components/ui/icons";
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

/** Level (0..1) of the audio actually being sent: the disguised voice, if on. */
function useSendLevel() {
  const { microphoneTrack } = useLocalParticipant();
  const track = microphoneTrack?.track as LocalAudioTrack | undefined;
  return useTrackVolume(track);
}

function NativeMicButton() {
  const { localParticipant, isMicrophoneEnabled, microphoneTrack } = useLocalParticipant();
  const state = useConnectionState();
  const [busy, setBusy] = useState(false);

  // Coming back from another app: if the phone took the microphone away, reopen it.
  useEffect(() => {
    const track = microphoneTrack?.track as LocalAudioTrack | undefined;
    if (!track) return;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      if (track.mediaStreamTrack?.readyState === "ended" && !microphoneTrack?.isMuted) {
        void track.restartTrack().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [microphoneTrack]);
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
    // A tap: also wake the audio engine (and mic) if the phone paused them.
    const proc = useMicStore.getState().processor;
    void (proc?.recover ?? proc?.resume)?.call(proc);
    const p = pub.current;
    if (!p) return;
    if (p.isMuted) await p.unmute();
    else await p.mute();
    setMuted(p.isMuted);
  }

  if (error) return <span className="text-sm text-red-400">Microphone not sent: {error}</span>;

  return (
    <>
      <MuteToggle muted={muted} disabled={!published} onToggle={toggle} />
      <VoiceHealthNotice muted={muted} callId={callId} />
    </>
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
            inputState: h.inputState,
            recoveries: h.recoveries,
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
      setSuspended(h.state !== "running" || h.inputState === "ended");
      // Mic hears something but the disguise outputs nothing.
      const silent = h.inLevel !== null && h.outLevel !== null && h.inLevel > 0.003 && h.outLevel < 0.0003;
      setSilentFor((n) => (silent ? n + 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [processor]);

  if (suspended) {
    return (
      <button
        onClick={() => void (processor?.recover ?? processor?.resume)?.call(processor)}
        className="fixed inset-x-4 bottom-28 z-40 mx-auto max-w-sm rounded-2xl bg-amber-400 px-4 py-3 text-sm font-semibold text-black shadow-xl"
      >
        Tap to turn your voice back on
      </button>
    );
  }
  if (!muted && silentFor >= 4) {
    return (
      <p className="fixed inset-x-4 bottom-28 z-40 mx-auto max-w-sm rounded-2xl bg-neutral-900 px-4 py-3 text-center text-sm text-amber-300 shadow-xl ring-1 ring-amber-700">
        Your disguised voice isn&apos;t coming through on this device. Try leaving and rejoining, or use Chrome on
        another phone or a computer.
      </p>
    );
  }
  return null;
}

function MuteToggle({ muted, disabled, onToggle }: { muted: boolean; disabled: boolean; onToggle: () => void }) {
  const level = useSendLevel();
  const ring = useRef<HTMLSpanElement>(null);
  const latest = useRef(0);
  latest.current = muted ? 0 : level;
  // Animate the ring outside React renders.
  useEffect(() => {
    let frame = 0;
    let shown = 0;
    const tick = () => {
      const v = Math.min(1, latest.current * 3);
      shown = v > shown ? v : shown * 0.85 + v * 0.15;
      if (ring.current) ring.current.style.boxShadow = `0 0 0 ${(shown * 6).toFixed(1)}px rgba(48, 209, 88, ${(shown * 0.7).toFixed(2)})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <span ref={ring} className="rounded-full transition-[box-shadow] duration-75">
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={muted}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        title={muted ? "Unmute" : "Mute"}
        className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-xl transition active:scale-95 disabled:opacity-40 sm:h-14 sm:w-14 ${
          muted ? "bg-white text-black" : "bg-white/15 text-white hover:bg-white/25"
        }`}
      >
        {muted ? <MicOffIcon /> : <MicIcon />}
      </button>
    </span>
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
