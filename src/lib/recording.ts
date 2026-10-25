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

/** LiveKit plans cap concurrent egress sessions; it answers 429 when full. */
function isEgressLimit(e: unknown) {
  const err = e as { status?: number; code?: string; message?: string };
  return err?.status === 429 || err?.code === "resource_exhausted" || /egress sessions limit/i.test(err?.message ?? "");
}

/**
 * Per-speaker tracks matter more than the room mix (transcripts need them).
 * If the plan's egress limit is hit, stop the mix to free a slot.
 */
async function freeSlotByStoppingMix(callId: string) {
  const mix = await db.recording.findFirst({
    where: { callId, kind: "MIXED", status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true, egressId: true },
  });
  if (!mix) return false;
  try {
    await egressClient().stopEgress(mix.egressId);
  } catch {
    // Already stopping or gone.
  }
  await db.recording.update({ where: { id: mix.id }, data: { status: "FAILED" } });
  return true;
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
  const start = () =>
    egressClient().startTrackEgress(
      call.roomName,
      new DirectFileOutput({ filepath: fileKey, output: { case: "s3", value: s3() } }),
      trackSid,
    );
  let info;
  try {
    info = await start();
  } catch (e) {
    if (!isEgressLimit(e) || !(await freeSlotByStoppingMix(call.id))) throw e;
    console.warn("Egress limit reached: stopped the room mix to record a speaker", call.id);
    // The stopped session can take a moment to release.
    for (let attempt = 0; ; attempt++) {
      try {
        info = await start();
        break;
      } catch (retryError) {
        if (!isEgressLimit(retryError) || attempt >= 4) throw retryError;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
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
