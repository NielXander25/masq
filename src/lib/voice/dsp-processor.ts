import { DSP_PRESETS, type VoiceMode } from "./presets";
import type { VoiceHealth, VoiceProcessor } from "./types";

const WORKLET_URL = "/voice/voice-shifter.js";

/** Pitch and formant shifting in an AudioWorklet (see public/voice/voice-shifter.js). */
export class DspVoiceProcessor implements VoiceProcessor {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private input: MediaStream | null = null;
  private monitoring = false;
  private levels: { in: number; out: number } | null = null;

  async start(stream: MediaStream, mode: VoiceMode) {
    if (typeof AudioWorkletNode === "undefined") {
      throw new Error("This browser can't disguise your voice. Try a recent Chrome, Edge, Firefox or Safari.");
    }
    this.input = stream;
    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;
    await ctx.audioWorklet.addModule(WORKLET_URL);

    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "voice-shifter", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      // Settings apply from the very first sample, before any message arrives.
      processorOptions: DSP_PRESETS[mode],
    });
    node.port.onmessage = (e) => {
      if (e.data?.type === "levels") this.levels = { in: e.data.in, out: e.data.out };
    };
    const dest = ctx.createMediaStreamDestination();
    source.connect(node).connect(dest);
    this.node = node;
    this.setPreset(mode);

    if (ctx.state === "suspended") await ctx.resume();
    const track = dest.stream.getAudioTracks()[0];
    if (!track) throw new Error("Could not create the disguised audio track");
    return track;
  }

  setPreset(mode: VoiceMode) {
    this.node?.port.postMessage(DSP_PRESETS[mode]);
  }

  setMonitor(on: boolean) {
    if (!this.node || !this.ctx || on === this.monitoring) return;
    if (on) this.node.connect(this.ctx.destination);
    else this.node.disconnect(this.ctx.destination);
    this.monitoring = on;
  }

  health(): VoiceHealth {
    return {
      state: this.ctx?.state ?? "closed",
      inLevel: this.levels?.in ?? null,
      outLevel: this.levels?.out ?? null,
    };
  }

  async resume() {
    if (this.ctx && this.ctx.state !== "running" && this.ctx.state !== "closed") await this.ctx.resume();
  }

  stop() {
    this.input?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.node = null;
    this.input = null;
    this.monitoring = false;
  }
}

/**
 * Microphone tuned for speech. The browser's own noise suppression runs first;
 * the worklet's spectral suppression then cleans up what's left.
 */
export function getMicrophone() {
  return navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });
}
