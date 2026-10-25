import type { Transcriber, Utterance } from "./types";

type DeepgramResponse = {
  results?: {
    utterances?: { start: number; end: number; transcript: string }[];
    channels?: { alternatives?: { transcript?: string }[] }[];
  };
};

/** Deepgram pre-recorded API: Deepgram fetches the (signed) audio URL itself. */
export class DeepgramTranscriber implements Transcriber {
  constructor(private apiKey: string) {}

  async transcribe(audioUrl: string): Promise<Utterance[]> {
    const params = new URLSearchParams({
      model: "nova-3",
      smart_format: "true",
      punctuate: "true",
      utterances: "true",
      // Auto-detection misreads short or disguised speech (e.g. as Turkish).
      language: "en",
    });
    const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
      method: "POST",
      headers: { Authorization: `Token ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: audioUrl }),
    });
    if (!res.ok) throw new Error(`Deepgram ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as DeepgramResponse;
    const utterances = data.results?.utterances ?? [];
    if (utterances.length) {
      return utterances
        .filter((u) => u.transcript.trim())
        .map((u) => ({ startMs: Math.round(u.start * 1000), endMs: Math.round(u.end * 1000), text: u.transcript.trim() }));
    }
    const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
    return text ? [{ startMs: 0, endMs: 0, text }] : [];
  }
}
