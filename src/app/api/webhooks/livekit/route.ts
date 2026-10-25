import { after, NextResponse } from "next/server";
import { EgressStatus, TrackSource, TrackType, WebhookReceiver, type WebhookEvent } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { livekitConfig, livekitConfigured } from "@/lib/livekit";
import { recordingConfigured, startMixedRecording, startTrackRecording } from "@/lib/recording";
import { maybeTranscribe } from "@/lib/transcribe/run";

// Background work (egress start, transcription) can take a while.
export const maxDuration = 300;

const nsToDate = (ns: bigint) => (ns > BigInt(0) ? new Date(Number(ns / BigInt(1_000_000))) : null);

export async function POST(req: Request) {
  if (!livekitConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const { key, secret } = livekitConfig();
  const body = await req.text();

  let event: WebhookEvent;
  try {
    event = await new WebhookReceiver(key, secret).receive(body, req.headers.get("authorization") ?? undefined);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Never block the webhook response: LiveKit retries slow endpoints.
  after(async () => {
    try {
      await handle(event);
    } catch (e) {
      console.error("LiveKit webhook handling failed", event.event, e);
    }
  });
  return NextResponse.json({ ok: true });
}

async function handle(event: WebhookEvent) {
  const roomName = event.room?.name ?? event.egressInfo?.roomName;
  if (!roomName) return;
  const call = await db.call.findUnique({
    where: { roomName },
    select: { id: true, roomName: true, status: true, recordingEnabled: true },
  });
  if (!call) return;
  const identity = event.participant?.identity;
  const participant = identity
    ? await db.participant.findUnique({ where: { livekitIdentity: identity }, select: { id: true, isHost: true, livekitIdentity: true } })
    : null;
  const record = call.recordingEnabled && call.status !== "ENDED" && recordingConfigured();

  switch (event.event) {
    case "participant_joined": {
      if (!participant) return;
      await db.participant.update({ where: { id: participant.id }, data: { leftAt: null } });
      if (participant.isHost && record) await startMixedRecording(call);
      return;
    }
    case "participant_left": {
      // Leaving (or closing the tab) is recorded; status is untouched so a page
      // refresh can reconnect, and an admitted guest can rejoin.
      if (participant) await db.participant.update({ where: { id: participant.id }, data: { leftAt: new Date() } });
      return;
    }
    case "track_published": {
      const track = event.track;
      if (!participant || !track || !record) return;
      if (track.type !== TrackType.AUDIO || track.source !== TrackSource.MICROPHONE) return;
      await startTrackRecording(call, participant, track.sid);
      return;
    }
    case "room_finished": {
      // Everyone has gone: end the call so it doesn't stay "LIVE".
      if (call.status !== "ENDED") {
        const now = new Date();
        await db.$transaction([
          db.call.update({ where: { id: call.id }, data: { status: "ENDED", endedAt: now } }),
          db.participant.updateMany({ where: { callId: call.id, status: "PENDING" }, data: { status: "DENIED" } }),
          db.participant.updateMany({
            where: { callId: call.id, isHost: false, status: "ADMITTED" },
            data: { status: "LEFT" },
          }),
          db.participant.updateMany({
            where: { callId: call.id, joinedAt: { not: null }, leftAt: null },
            data: { leftAt: now },
          }),
        ]);
      }
      await maybeTranscribe(call.id);
      return;
    }
    case "egress_started": {
      return;
    }
    case "egress_ended": {
      const info = event.egressInfo;
      if (!info) return;
      const file = info.fileResults[0];
      const ok = info.status === EgressStatus.EGRESS_COMPLETE;
      await db.recording.updateMany({
        where: { egressId: info.egressId },
        data: {
          status: ok ? "DONE" : "FAILED",
          durationSec: file ? Math.round(Number(file.duration) / 1e9) : null,
          startedAt: nsToDate(file?.startedAt ?? info.startedAt),
        },
      });
      if (!ok) console.warn("Egress did not complete", info.egressId, info.error);
      await maybeTranscribe(call.id);
      return;
    }
  }
}
