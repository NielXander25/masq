import type { VoiceMode } from "./presets";

/**
 * Turns a raw microphone stream into the track that gets published: a disguised
 * voice for the host, or a noise-suppressed one ("clean"). The DSP version can
 * later be swapped for an ML voice model behind the same interface.
 */
export interface VoiceProcessor {
  /** Start processing. The returned track is the only one that may be published. */
  start(stream: MediaStream, mode: VoiceMode): Promise<MediaStreamTrack>;
  /** Switch preset live, without republishing. */
  setPreset(mode: VoiceMode): void;
  /** Play the disguised voice locally ("hear myself"). */
  setMonitor(on: boolean): void;
  /** Stop processing and release the microphone. */
  stop(): void;
  /** Latest health: input/output levels and whether the audio engine is running. */
  health?(): VoiceHealth;
  /** Restart the audio engine if the browser suspended it. */
  resume?(): Promise<void>;
}

export type VoiceHealth = {
  /** "running", "suspended", "interrupted" (iOS) or "closed". */
  state: string;
  /** RMS of the microphone input over the last half-second, or null before the first report. */
  inLevel: number | null;
  /** RMS of the disguised output over the last half-second. */
  outLevel: number | null;
  sampleRate: number | null;
  /** The published track's state: "live" or "ended". */
  trackState: string | null;
};
