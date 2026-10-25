import type { TranscriptSegment } from "./types";

/** Narrow the stored JSON back to segments. */
export function readSegments(json: unknown): TranscriptSegment[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (s): s is TranscriptSegment =>
      typeof s === "object" &&
      s !== null &&
      typeof (s as TranscriptSegment).speakerLabel === "string" &&
      typeof (s as TranscriptSegment).text === "string" &&
      typeof (s as TranscriptSegment).startMs === "number",
  );
}
