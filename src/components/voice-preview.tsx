"use client";

import { useState } from "react";
import { DspVoiceProcessor, getMicrophone } from "@/lib/voice/dsp-processor";
import { PRESET_LABELS, VOICE_PRESETS, type VoicePreset } from "@/lib/voice/presets";
import { useVoiceStore } from "@/lib/voice/store";

/** Host-only "hear myself" step. The processor it starts is handed to the call. */
export function VoicePreview({ alias, onJoin }: { alias: string; onJoin: () => void }) {
  const { preset, setPreset, processor, setProcessor } = useVoiceStore();
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "error">(
    processor ? "ready" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [monitor, setMonitor] = useState(false);

  async function start() {
    setStatus("starting");
    setError(null);
    try {
      const mic = await getMicrophone();
      const p = new DspVoiceProcessor();
      const track = await p.start(mic, preset);
      setProcessor(p, track);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the microphone");
      setStatus("error");
    }
  }

  function toggleMonitor() {
    processor?.setMonitor(!monitor);
    setMonitor(!monitor);
  }

  function join() {
    processor?.setMonitor(false);
    onJoin();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <p className="text-sm text-neutral-400">Hosting as</p>
        <h1 className="text-3xl font-semibold">{alias}</h1>
      </div>

      <section className="space-y-4 rounded-xl border border-neutral-800 p-5">
        <h2 className="font-medium">Your disguised voice</h2>
        <div className="grid grid-cols-2 gap-2">
          {VOICE_PRESETS.map((p: VoicePreset) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`rounded-lg border px-3 py-2 text-sm ${
                p === preset ? "border-white bg-white text-black" : "border-neutral-700 hover:bg-neutral-800"
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {status === "idle" || status === "error" ? (
          <button
            onClick={start}
            className="w-full rounded-lg border border-neutral-700 px-4 py-2.5 hover:bg-neutral-800"
          >
            Turn on microphone
          </button>
        ) : status === "starting" ? (
          <p className="text-sm text-neutral-400">Starting microphone…</p>
        ) : (
          <button
            onClick={toggleMonitor}
            className="w-full rounded-lg border border-neutral-700 px-4 py-2.5 hover:bg-neutral-800"
          >
            {monitor ? "Stop hearing myself" : "Hear myself"}
          </button>
        )}
        {monitor && (
          <p className="text-xs text-neutral-500">Use headphones, or you&apos;ll hear feedback.</p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      <button
        onClick={join}
        disabled={status !== "ready"}
        className="w-full rounded-lg bg-white px-4 py-2.5 font-medium text-black hover:bg-neutral-200 disabled:opacity-40"
      >
        Join call
      </button>
      <p className="-mt-3 text-center text-xs text-neutral-500">
        Only your disguised voice is ever sent. Your real microphone audio never leaves this device.
      </p>
    </main>
  );
}
