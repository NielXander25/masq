import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, jsonError, parseJson } from "@/lib/api";
import { findHostedCall } from "@/lib/calls";
import { muteParticipantMic, removeFromRoom } from "@/lib/livekit";
import { maxParticipants } from "@/lib/plans";

const bodySchema = z.object({ action: z.enum(["admit", "deny", "mute", "remove"]) });

class LimitReached extends Error {}

// Host only: admit or deny a waiting guest; mute or remove a guest in the call.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ callId: string; participantId: string }> },
) {
  const user = await apiUser();
  if (!user) return jsonError(401, "Unauthorized");
  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) return jsonError(400, "Invalid request");
  const { callId, participantId } = await params;

  const call = await findHostedCall(callId, user.id);
  if (!call) return jsonError(404, "Not found");
  if (call.status === "ENDED") return jsonError(409, "This call has ended");

  const participant = await db.participant.findFirst({
    where: { id: participantId, callId, isHost: false },
    select: { id: true, status: true, livekitIdentity: true },
  });
  if (!participant) return jsonError(404, "Not found");

  if (parsed.data.action === "mute" || parsed.data.action === "remove") {
    if (participant.status !== "ADMITTED") return jsonError(409, "This guest isn't in the call");
    if (parsed.data.action === "mute") {
      const muted = await muteParticipantMic(call.roomName, participant.livekitIdentity);
      if (!muted) return jsonError(409, "Their microphone is already off");
      return NextResponse.json({ status: "ADMITTED", muted: true });
    }
    // Removed guests can't rejoin on their own: DENIED blocks new tokens and rejoining.
    await db.participant.update({
      where: { id: participant.id },
      data: { status: "DENIED", leftAt: new Date() },
    });
    await removeFromRoom(call.roomName, participant.livekitIdentity);
    return NextResponse.json({ status: "DENIED" });
  }

  if (participant.status !== "PENDING") return jsonError(409, "This guest is no longer waiting");

  if (parsed.data.action === "deny") {
    await db.participant.update({ where: { id: participant.id }, data: { status: "DENIED" } });
    return NextResponse.json({ status: "DENIED" });
  }

  const limit = maxParticipants(call.host);
  try {
    await db.$transaction(
      async (tx) => {
        if (limit !== null) {
          const inCall = await tx.participant.count({ where: { callId, status: "ADMITTED" } });
          if (inCall >= limit) throw new LimitReached();
        }
        await tx.participant.update({ where: { id: participant.id }, data: { status: "ADMITTED" } });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    if (e instanceof LimitReached) {
      return jsonError(
        409,
        `Your plan allows ${limit} people per call, including you. Upgrade to PRO for more.`,
      );
    }
    throw e;
  }
  return NextResponse.json({ status: "ADMITTED" });
}
