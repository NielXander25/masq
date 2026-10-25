"use client";

import { create } from "zustand";
import type { VoicePreset } from "./presets";
import type { VoiceProcessor } from "./types";

type VoiceState = {
  preset: VoicePreset;
  processor: VoiceProcessor | null;
  /** The disguised track, ready to publish. Never the raw microphone. */
  track: MediaStreamTrack | null;
  setPreset: (preset: VoicePreset) => void;
  setProcessor: (processor: VoiceProcessor | null, track: MediaStreamTrack | null) => void;
};

export const useVoiceStore = create<VoiceState>((set, get) => ({
  preset: "neutral-mask",
  processor: null,
  track: null,
  setPreset: (preset) => {
    get().processor?.setPreset(preset);
    set({ preset });
  },
  setProcessor: (processor, track) => set({ processor, track }),
}));
