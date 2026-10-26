"use client";

import { useEffect, useRef, useState } from "react";
import { LevelMeter, rmsToMeter } from "@/components/level-meter";
import { DspVoiceProcessor, getMicrophone } from "@/lib/voice/dsp-processor";
import { PRESET_LABELS, VOICE_PRESETS } from "@/lib/voice/presets";
import { useMicStore } from "@/lib/voice/store";

type Props = {
  alias: string;
  title?: string | null;
  isHost: boolean;
  /** Host with the voice changer on. */
  disguise: boolean;
  /** Guest only: the host requires cameras on. */
  cameraRequired?: boolean;
  onJoin: (opts: { camera: boolean }) => void;
};

/**
 * Device check before joining. Starting the microphone here (on a tap) also
 * satisfies browsers' autoplay rules for the audio pipeline.
 */
export function PreJoin({ alias, title, isHost, disguise, cameraRequired = false, onJoin }: Props) {
  const { mode, setMode, processor, setProcessor } = useMicStore();
  const [mic, setMic] = useState<"idle" | "starting" | "ready" | "error">(processor ? "ready" : "idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [monitor, setMonitor] = useState(false);
  const [noEchoCancel, setNoEchoCancel] = useState(false);
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (video.current) video.current.srcObject = camera;
  }, [camera]);

  // Release the preview camera if the user leaves this screen.
  useEffect(() => () => camera?.getTracks().forEach((t) => t.stop()), [camera]);

  async function startMic() {
    setMic("starting");
    setMicError(null);
    try {
      const stream = await getMicrophone();
      // Some browsers ignore the request for echo cancellation: warn, since
      // without it the other side hears themselves back.
      setNoEchoCancel(stream.getAudioTracks()[0]?.getSettings().echoCancellation === false);
      const p = new DspVoiceProcessor();
      const track = await p.start(stream, mode);
      setProcessor(p, track);
      setMic("ready");
    } catch (e) {
      setMicError(e instanceof Error ? e.message : "Could not start the microphone");
      setMic("error");
    }
  }

  async function toggleCamera() {
    setCamError(null);
    if (camera) {
      camera.getTracks().forEach((t) => t.stop());
      setCamera(null);
      return;
    }
    try {
      setCamera(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }));
    } catch {
      setCamError("Camera blocked. Allow camera access in your browser settings.");
    }
  }

  function toggleMonitor() {
    processor?.setMonitor(!monitor);
    setMonitor(!monitor);
  }

  function join() {
    processor?.setMonitor(false);
    // Phones may pause the audio engine; this tap is allowed to wake it.
    void processor?.resume?.();
    const cameraOn = Boolean(camera);
    // LiveKit opens the camera itself once connected.
    camera?.getTracks().forEach((t) => t.stop());
    onJoin({ camera: cameraOn });
  }

  const canJoin = mic === "ready" && (!cameraRequired || camera);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-8">
      <div>
        <p className="text-sm text-neutral-400">{isHost ? "Hosting as" : "Call with"}</p>
        <h1 className="text-3xl font-semibold">{alias}</h1>
        {title && <p className="mt-1 text-neutral-300">{title}</p>}
      </div>

      {!isHost && (
        <section className="space-y-3 rounded-xl border border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Camera</h2>
            {cameraRequired && (
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">Required by {alias}</span>
            )}
          </div>
          <div className="aspect-video overflow-hidden rounded-lg bg-neutral-900">
            {camera ? (
              <video ref={video} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">Camera off</div>
            )}
          </div>
          <button
            onClick={toggleCamera}
            className="w-full rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
          >
            {camera ? "Turn camera off" : "Turn camera on"}
          </button>
          {camError && <p className="text-sm text-red-400">{camError}</p>}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-neutral-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{disguise ? "Your disguised voice" : "Microphone"}</h2>
          <span className="text-xs text-neutral-500">{disguise ? "Noise reduction on" : "Echo & noise cancelling on"}</span>
        </div>

        {disguise && (
          <div className="grid grid-cols-2 gap-2">
            {VOICE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setMode(p)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  p === mode ? "border-white bg-white text-black" : "border-neutral-700 hover:bg-neutral-800"
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
        )}

        {mic === "ready" && processor?.liveLevels && (
          <div className="space-y-1.5">
            <LevelMeter label="Your mic" read={() => rmsToMeter(processor.liveLevels!().input)} />
            {disguise && (
              <LevelMeter label="Guests hear" read={() => rmsToMeter(processor.liveLevels!().output)} />
            )}
            <p className="text-xs text-neutral-500">Speak: the bar{disguise ? "s" : ""} should move.</p>
          </div>
        )}

        {mic === "ready" ? (
          <button
            onClick={toggleMonitor}
            className="w-full rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
          >
            {monitor ? "Stop hearing myself" : "Hear myself"}
          </button>
        ) : (
          <button
            onClick={startMic}
            disabled={mic === "starting"}
            className="w-full rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            {mic === "starting" ? "Starting microphone…" : "Turn on microphone"}
          </button>
        )}
        {monitor && <p className="text-xs text-neutral-500">Use headphones, or you&apos;ll hear feedback.</p>}
        {noEchoCancel && (
          <p className="text-xs text-amber-300">
            This browser isn&apos;t cancelling echo. Please use headphones.
          </p>
        )}
        <p className="text-xs text-neutral-500">
          Tip: headphones give the clearest sound. Keep other devices in the call out of the room to avoid echo.
        </p>
        {micError && <p className="text-sm text-red-400">{micError}</p>}
      </section>

      <button
        onClick={join}
        disabled={!canJoin}
        className="w-full rounded-lg bg-white px-4 py-2.5 font-medium text-black hover:bg-neutral-200 disabled:opacity-40"
      >
        Join call
      </button>
      {disguise && (
        <p className="-mt-2 text-center text-xs text-neutral-500">
          Only your disguised voice is sent. Your real microphone audio never leaves this device.
        </p>
      )}
      {isHost && !disguise && (
        <p className="-mt-2 rounded-lg border border-amber-700 bg-amber-950 px-3 py-2 text-center text-sm text-amber-200">
          Voice disguise is off for this call: guests will hear your real voice.
        </p>
      )}
      {cameraRequired && !camera && (
        <p className="-mt-2 text-center text-xs text-neutral-500">Turn your camera on to join.</p>
      )}
    </main>
  );
}
