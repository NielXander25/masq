export const VOICE_PRESETS = ["deep", "high", "robot", "neutral-mask"] as const;
export type VoicePreset = (typeof VOICE_PRESETS)[number];
