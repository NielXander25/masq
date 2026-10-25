import { Prisma } from "@prisma/client";
import { env } from "@/env";
import { db } from "@/lib/db";
import { recordingReadyEmail, sendEmail } from "@/lib/email";
import { r2SignedUrl } from "@/lib/r2";
import { DeepgramTranscriber } from "./deepgram";
import { mergeTracks, transcriptText, type SpeakerTrack } from "./merge";
import type { Transcriber } from "./types";

function transcriber(): Transcriber {
  if (!env.DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY is not set");
  return new DeepgramTranscriber(env.DEEPGRAM_API_KEY);
}

/**
 * Starts transcription once the call has ended and every per-speaker recording
 * has finished. Safe to call repeatedly: the unique Transcript row means only
 * the first caller does the work.
 */
export async function maybeTranscribe(callId: string) {
  const call = await db.call.findUnique({
    where: { id: callId },
    select: {
      status: true,
      recordingEnabled: true,
      recordings: { where: { kind: "TRACK" }, select: { status: true } },
    },
  });
  if (!call || call.status !== "ENDED" || !call.recordingEnabled) return;
  if (!call.recordings.length) return;
  if (call.recordings.some((r) => r.status === "PENDING" || r.status === "PROCESSING")) return;

  try {
    await db.transcript.create({ data: { callId, status: "PROCESSING" } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return; // already started
    throw e;
  }

  try {
    await transcribeCall(callId);
  } catch (e) {
    console.error("Transcription failed", callId, e);
    await db.transcript.update({ where: { callId }, data: { status: "FAILED" } });
  }
}

async function transcribeCall(callId: string) {
  const call = await db.call.findUniqueOrThrow({
    where: { id: callId },
    select: {
      hostAlias: true,
      host: { select: { email: true } },
      recordings: {
        where: { kind: "TRACK", status: "DONE", fileKey: { not: null } },
        orderBy: { startedAt: "asc" },
        select: {
          fileKey: true,
          startedAt: true,
          participant: { select: { isHost: true, user: { select: { name: true, email: true } } } },
        },
      },
    },
  });

  const t0 = Math.min(...call.recordings.map((r) => r.startedAt?.getTime() ?? Infinity));
  const stt = transcriber();
  const tracks: SpeakerTrack[] = [];
  for (const r of call.recordings) {
    const p = r.participant;
    // Speaker labels: the alias for the host (never their account), "Name (email)" for guests.
    const speakerLabel = !p || p.isHost ? call.hostAlias : `${p.user.name ?? p.user.email} (${p.user.email})`;
    const utterances = await stt.transcribe(r2SignedUrl(r.fileKey!, { expiresIn: 3600 }));
    const offsetMs = r.startedAt && Number.isFinite(t0) ? r.startedAt.getTime() - t0 : 0;
    tracks.push({ speakerLabel, offsetMs, utterances });
  }

  const segments = mergeTracks(tracks);
  await db.transcript.update({
    where: { callId },
    data: { status: "DONE", segments, text: transcriptText(segments) },
  });

  const email = recordingReadyEmail(call.hostAlias, `${env.APP_URL}/dashboard/calls/${callId}`);
  await sendEmail(call.host.email, email.subject, email.html, email.text);
}
