import {
  DirectFileOutput,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from "livekit-server-sdk";
import { db } from "@/lib/db";
import { livekitConfig, livekitConfigured } from "@/lib/livekit";
import { r2Config, r2Configured } from "@/lib/r2";

// Recording via LiveKit Egress, written straight to R2.
// File keys only ever contain the call ID and LiveKit identities, which for the
// host is a random ID, so no file name can identify the host.

export function recordingConfigured() {
  return livekitConfigured() && r2Configured();
}

function egressClient() {
  const { url, key, secret } = livekitConfig();
  return new EgressClient(url.replace(/^ws/, "http"), key, secret);
}

function s3() {
  const c = r2Config();
  return new S3Upload({
    accessKey: c.accessKeyId,
    secret: c.secretAccessKey,
    region: "auto",
    endpoint: c.endpoint,
    bucket: c.bucket,
    forcePathStyle: true,
  });
}

/** One audio-only mix of the whole room. Idempotent per call. */
export async function startMixedRecording(call: { id: string; roomName: string }) {
  const existing = await db.recording.count({ where: { callId: call.id, kind: "MIXED" } });
  if (existing) return;
  const fileKey = `calls/${call.id}/mixed.ogg`;
  const info = await egressClient().startRoomCompositeEgress(
    call.roomName,
    new EncodedFileOutput({ fileType: EncodedFileType.OGG, filepath: fileKey, output: { case: "s3", value: s3() } }),
    { audioOnly: true },
  );
  await db.recording.create({
    data: { callId: call.id, kind: "MIXED", egressId: info.egressId, fileKey, status: "PROCESSING" },
  });
}

/** One file per published microphone track, for per-speaker transcripts. */
export async function startTrackRecording(
  call: { id: string; roomName: string },
  participant: { id: string; livekitIdentity: string },
  trackSid: string,
) {
  // Someone who rejoins publishes a new track, so key files by track too.
  const fileKey = `calls/${call.id}/${participant.livekitIdentity}-${trackSid}.ogg`;
  const exists = await db.recording.count({ where: { callId: call.id, fileKey } });
  if (exists) return;
  const info = await egressClient().startTrackEgress(
    call.roomName,
    new DirectFileOutput({ filepath: fileKey, output: { case: "s3", value: s3() } }),
    trackSid,
  );
  await db.recording.create({
    data: {
      callId: call.id,
      participantId: participant.id,
      kind: "TRACK",
      egressId: info.egressId,
      fileKey,
      status: "PROCESSING",
    },
  });
}
