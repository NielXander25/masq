"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LevelMeter, rmsToMeter } from "@/components/level-meter";
import { ChevronLeftIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from "@/components/ui/icons";
import { Avatar, RoundButton } from "@/components/ui/primitives";
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
 * Meet-style "green room". Starting the microphone here (on a tap) also
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
      <header className="flex items-center gap-2">
        <Link href="/dashboard" aria-label="Back" className="-ml-2 rounded-full p-2 text-neutral-300 hover:bg-neutral-900">
          <ChevronLeftIcon />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-neutral-400">{isHost ? "Hosting as" : "Call with"}</p>
          <h1 className="truncate text-lg font-semibold leading-tight">
            {alias}
            {title && <span className="ml-2 text-sm font-normal text-neutral-400">{title}</span>}
          </h1>
        </div>
      </header>

      {/* Preview */}
      <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-3xl bg-neutral-900 sm:aspect-video">
        {camera ? (
          <video ref={video} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-400">
            <Avatar name={alias} size="h-24 w-24 text-3xl" />
            <span className="text-sm">
              {isHost ? "Your camera stays off" : cameraRequired ? "Camera is required for this call" : "Camera is off"}
            </span>
          </div>
        )}
        {cameraRequired && (
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
            Camera required by {alias}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-4">
          {mic === "ready" ? (
            <RoundButton label="Microphone on" pressed>
              <MicIcon />
            </RoundButton>
          ) : (
            <RoundButton
              label="Turn on microphone"
              tone="off"
              onClick={startMic}
              disabled={mic === "starting"}
              className={mic === "idle" ? "animate-pulse" : ""}
            >
              <MicOffIcon />
            </RoundButton>
          )}
          {!isHost && (
            <RoundButton label={camera ? "Turn camera off" : "Turn camera on"} tone={camera ? "default" : "off"} onClick={toggleCamera}>
              {camera ? <VideoIcon /> : <VideoOffIcon />}
            </RoundButton>
          )}
        </div>
      </div>

      {/* Mic status, levels, voice */}
      <section className="mt-4 space-y-3">
        {mic !== "ready" && (
          <p className="text-center text-sm text-neutral-300">
            {mic === "starting" ? "Starting microphone…" : "Tap the microphone to turn it on"}
          </p>
        )}
        {mic === "ready" && processor?.liveLevels && (
          <div className="space-y-1.5 rounded-2xl bg-neutral-900 p-3">
            <LevelMeter label="Your mic" read={() => rmsToMeter(processor.liveLevels!().input)} />
            {disguise && <LevelMeter label="Guests hear" read={() => rmsToMeter(processor.liveLevels!().output)} />}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-neutral-500">
                {disguise ? "Noise reduction on" : "Echo & noise cancelling on"}
              </span>
              <button onClick={toggleMonitor} className={`rounded-full px-3 py-1 text-xs ${monitor ? "bg-white text-black" : "bg-neutral-800"}`}>
                {monitor ? "Stop hearing myself" : "Hear myself"}
              </button>
            </div>
            {monitor && <p className="text-xs text-neutral-500">Use headphones, or you&apos;ll hear feedback.</p>}
          </div>
        )}

        {disguise && (
          <div>
            <p className="mb-2 text-xs text-neutral-400">Your disguised voice</p>
            <div className="flex flex-wrap gap-2">
              {VOICE_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setMode(p)}
                  className={`rounded-full px-3.5 py-1.5 text-sm ${p === mode ? "bg-white text-black" : "bg-neutral-800 text-neutral-200"}`}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        )}

        {isHost && !disguise && (
          <p className="rounded-2xl border border-amber-700 bg-amber-950 px-3 py-2 text-center text-sm text-amber-200">
            Voice disguise is off for this call: guests will hear your real voice.
          </p>
        )}
        {noEchoCancel && (
          <p className="text-xs text-amber-300">This browser isn&apos;t cancelling echo. Please use headphones.</p>
        )}
        {micError && <p className="text-sm text-red-400">{micError}</p>}
        {camError && <p className="text-sm text-red-400">{camError}</p>}
      </section>

      <div className="mt-auto space-y-2 pt-5">
        <button
          onClick={join}
          disabled={!canJoin}
          className="w-full rounded-full bg-green-500 px-4 py-4 text-lg font-semibold text-black transition hover:bg-green-400 disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {isHost ? "Start call" : "Join now"}
        </button>
        <p className="text-center text-xs text-neutral-500">
          {disguise
            ? "Only your disguised voice is sent. Your real microphone audio never leaves this device."
            : cameraRequired && !camera
              ? "Turn your camera on to join."
              : "Tip: headphones give the clearest sound."}
        </p>
      </div>
    </main>
  );
}
