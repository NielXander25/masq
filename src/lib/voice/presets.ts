export const VOICE_PRESETS = ["deep", "high", "robot", "neutral-mask"] as const;
export type VoicePreset = (typeof VOICE_PRESETS)[number];

export const PRESET_LABELS: Record<VoicePreset, string> = {
  deep: "Deep",
  high: "High",
  robot: "Robot",
  "neutral-mask": "Neutral mask",
};

export type DspParams = {
  /** Harmonic (pitch) ratio. 0.5 is an octave down. */
  pitch: number;
  /** Spectral-envelope (formant) ratio, independent of pitch. */
  formant: number;
  /** Discard phase for a flat, buzzy voice. */
  robot: boolean;
  /** Output gain, so every preset comes out at about the same loudness. */
  gain: number;
  /** Background noise suppression. */
  denoise: boolean;
};

/** A preset, or "clean": the real voice with only noise suppression applied. */
export type VoiceMode = VoicePreset | "clean";

export const DSP_PRESETS: Record<VoiceMode, DspParams> = {
  clean: { pitch: 1, formant: 1, robot: false, gain: 1, denoise: true },
  deep: { pitch: 0.72, formant: 0.82, robot: false, gain: 1, denoise: true },
  high: { pitch: 1.45, formant: 1.2, robot: false, gain: 1.7, denoise: true },
  robot: { pitch: 1, formant: 0.95, robot: true, gain: 4, denoise: true },
  // Pitch down but formants up: keeps a natural sound while breaking the
  // pitch/formant pairing that listeners use to recognise a voice.
  "neutral-mask": { pitch: 0.88, formant: 1.12, robot: false, gain: 1, denoise: true },
};

export function isVoicePreset(v: unknown): v is VoicePreset {
  return typeof v === "string" && (VOICE_PRESETS as readonly string[]).includes(v);
}
