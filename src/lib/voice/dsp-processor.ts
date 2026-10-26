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
  private track: MediaStreamTrack | null = null;
  private inAnalyser: AnalyserNode | null = null;
  private outAnalyser: AnalyserNode | null = null;
  private meterBuf = new Float32Array(1024);

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
    // Taps for the live level meter.
    this.inAnalyser = ctx.createAnalyser();
    this.outAnalyser = ctx.createAnalyser();
    this.inAnalyser.fftSize = this.outAnalyser.fftSize = 1024;
    source.connect(this.inAnalyser);
    node.connect(this.outAnalyser);
    this.node = node;
    this.setPreset(mode);

    if (ctx.state === "suspended") await ctx.resume();
    const track = dest.stream.getAudioTracks()[0];
    if (!track) throw new Error("Could not create the disguised audio track");
    this.track = track;
    return track;
  }

  setPreset(mode: VoiceMode) {
    this.node?.port.postMessage(DSP_PRESETS[mode]);
  }

  setMonitor(on: boolean) {
    // Every tap is a chance to wake an engine the browser paused.
    void this.resume();
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
      sampleRate: this.ctx?.sampleRate ?? null,
      trackState: this.track?.readyState ?? null,
    };
  }

  liveLevels() {
    const rms = (a: AnalyserNode | null) => {
      if (!a) return 0;
      a.getFloatTimeDomainData(this.meterBuf);
      let s = 0;
      for (const v of this.meterBuf) s += v * v;
      return Math.sqrt(s / this.meterBuf.length);
    };
    return { input: rms(this.inAnalyser), output: rms(this.outAnalyser) };
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
    this.inAnalyser = null;
    this.outAnalyser = null;
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
