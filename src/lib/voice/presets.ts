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
  /** Always run the vocoder: the real voice must never pass straight through. */
  disguise: boolean;
};

/** A preset, or "clean": the real voice with only noise suppression applied. */
export type VoiceMode = VoicePreset | "clean";

export const DSP_PRESETS: Record<VoiceMode, DspParams> = {
  clean: { pitch: 1, formant: 1, robot: false, gain: 1, denoise: true, disguise: false },
  deep: { pitch: 0.66, formant: 0.8, robot: false, gain: 1, denoise: true, disguise: true },
  high: { pitch: 1.5, formant: 1.25, robot: false, gain: 1.05, denoise: true, disguise: true },
  robot: { pitch: 1, formant: 0.92, robot: true, gain: 6, denoise: true, disguise: true },
  // Pitch down but formants up: keeps a natural sound while breaking the
  // pitch/formant pairing that listeners use to recognise a voice.
  "neutral-mask": { pitch: 0.84, formant: 1.16, robot: false, gain: 1, denoise: true, disguise: true },
};

export function isVoicePreset(v: unknown): v is VoicePreset {
  return typeof v === "string" && (VOICE_PRESETS as readonly string[]).includes(v);
}
