import type { VoicePreset } from "./presets";

/**
 * Turns a raw microphone stream into a disguised track. The DSP version can
 * later be swapped for an ML voice model behind the same interface.
 */
export interface VoiceProcessor {
  /** Start processing. The returned track is the only one that may be published. */
  start(stream: MediaStream, preset: VoicePreset): Promise<MediaStreamTrack>;
  /** Switch preset live, without republishing. */
  setPreset(preset: VoicePreset): void;
  /** Play the disguised voice locally ("hear myself"). */
  setMonitor(on: boolean): void;
  /** Stop processing and release the microphone. */
  stop(): void;
}
