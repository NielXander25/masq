import type { TranscriptSegment, Utterance } from "./types";

export type SpeakerTrack = {
  /** The host's alias, or "Name (email)" for a guest. Never the host's account. */
  speakerLabel: string;
  /** When this track's audio starts, in ms since the earliest track started. */
  offsetMs: number;
  utterances: Utterance[];
};

/** Put every speaker's utterances on one timeline, in order. */
export function mergeTracks(tracks: SpeakerTrack[]): TranscriptSegment[] {
  return tracks
    .flatMap((t) =>
      t.utterances.map((u) => ({
        speakerLabel: t.speakerLabel,
        startMs: t.offsetMs + u.startMs,
        endMs: t.offsetMs + u.endMs,
        text: u.text,
      })),
    )
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

/** Plain-text transcript, one line per segment: "[01:23] Night Owl: Hello". */
export function transcriptText(segments: TranscriptSegment[]) {
  return segments.map((s) => `[${clock(s.startMs)}] ${s.speakerLabel}: ${s.text}`).join("\n");
}

export { clock };
