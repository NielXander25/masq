"use client";

import { create } from "zustand";
import type { VoiceMode } from "./presets";
import type { VoiceProcessor } from "./types";

type MicState = {
  mode: VoiceMode;
  processor: VoiceProcessor | null;
  /** The processed track, ready to publish. Never the raw microphone. */
  track: MediaStreamTrack | null;
  setMode: (mode: VoiceMode) => void;
  setProcessor: (processor: VoiceProcessor | null, track: MediaStreamTrack | null) => void;
  /** Stop the microphone and forget the processor. */
  release: () => void;
};

export const useMicStore = create<MicState>((set, get) => ({
  mode: "clean",
  processor: null,
  track: null,
  setMode: (mode) => {
    get().processor?.setPreset(mode);
    set({ mode });
  },
  setProcessor: (processor, track) => set({ processor, track }),
  release: () => {
    get().processor?.stop();
    set({ processor: null, track: null });
  },
}));
