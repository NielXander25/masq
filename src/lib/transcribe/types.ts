export type Utterance = { startMs: number; endMs: number; text: string };

/** Speech-to-text for one speaker's audio file. Swappable (e.g. self-hosted Whisper). */
export interface Transcriber {
  transcribe(audioUrl: string): Promise<Utterance[]>;
}

export type TranscriptSegment = { speakerLabel: string; startMs: number; endMs: number; text: string };
